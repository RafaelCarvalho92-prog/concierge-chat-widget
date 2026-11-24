/**
 * Example server proxy for the widget's HTTP provider (Netlify Functions, Node 18+ runtime).
 * NOT deployed in this demo. It keeps the LLM API key on the server, grounds the model in the
 * knowledge-base passages sent by the widget, and limits abuse.
 *
 * Environment variables:
 *   LLM_PROVIDER      "openai" | "anthropic"           (default "openai")
 *   LLM_API_KEY       your secret key                    (never shipped to the browser)
 *   LLM_MODEL         e.g. "gpt-4o-mini" / an Anthropic model id
 *   ALLOWED_ORIGINS   comma-separated list, e.g. "https://brightsmile.example"
 */

declare const process: { env: Record<string, string | undefined> };

interface ProxyRequest {
  businessId: string;
  language: 'en' | 'pt' | 'es';
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: { id: string; title: string; text: string }[];
}

const MAX_MESSAGES = 10;
const MAX_CHARS = 2_000;
const hits = new Map<string, { count: number; reset: number }>();

/** Naive per-IP rate limit (per warm function instance). Use a shared store in production. */
function rateLimited(ip: string, limit = 20, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || entry.reset < now) {
    hits.set(ip, { count: 1, reset: now + windowMs });
    return false;
  }
  entry.count += 1;
  return entry.count > limit;
}

function json(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
    },
  });
}

function systemPrompt(req: ProxyRequest): string {
  const sources = req.context.map((c) => `[${c.id}] ${c.title}\n${c.text}`).join('\n\n');
  return [
    `You are the friendly support assistant for the business "${req.businessId}".`,
    `Reply in ${{ en: 'English', pt: 'Portuguese', es: 'Spanish' }[req.language]}, in at most 3 short sentences.`,
    'Answer ONLY from the sources below. If they do not contain the answer, say you are not sure',
    'and offer to connect the visitor with the team. Never invent prices, hours or medical advice.',
    '',
    'Sources:',
    sources || '(none)',
  ].join('\n');
}

export default async function handler(request: Request): Promise<Response> {
  const allowed = (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const origin = request.headers.get('origin');
  const allowOrigin = origin && allowed.includes(origin) ? origin : null;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: allowOrigin
        ? {
            'Access-Control-Allow-Origin': allowOrigin,
            'Access-Control-Allow-Methods': 'POST',
            'Access-Control-Allow-Headers': 'Content-Type',
          }
        : {},
    });
  }
  if (request.method !== 'POST') return json(405, { error: 'Method not allowed' }, allowOrigin);
  if (!allowOrigin) return json(403, { error: 'Origin not allowed' }, null);

  const ip = request.headers.get('x-nf-client-connection-ip') ?? 'unknown';
  if (rateLimited(ip)) return json(429, { error: 'Too many requests' }, allowOrigin);

  let body: ProxyRequest;
  try {
    body = (await request.json()) as ProxyRequest;
  } catch {
    return json(400, { error: 'Invalid JSON' }, allowOrigin);
  }
  const messages = (body.messages ?? []).slice(-MAX_MESSAGES).map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content).slice(0, MAX_CHARS),
  }));
  if (!messages.length) return json(400, { error: 'No messages' }, allowOrigin);

  const provider = process.env.LLM_PROVIDER ?? 'openai';
  const key = process.env.LLM_API_KEY;
  if (!key) return json(500, { error: 'Server is not configured' }, allowOrigin);

  const upstream =
    provider === 'anthropic'
      ? await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: process.env.LLM_MODEL,
            max_tokens: 300,
            system: systemPrompt(body),
            messages,
          }),
        })
      : await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model: process.env.LLM_MODEL ?? 'gpt-4o-mini',
            max_tokens: 300,
            temperature: 0.2,
            messages: [{ role: 'system', content: systemPrompt(body) }, ...messages],
          }),
        });

  if (!upstream.ok) return json(502, { error: 'Upstream error' }, allowOrigin);
  const data = (await upstream.json()) as {
    choices?: { message?: { content?: string } }[];
    content?: { text?: string }[];
  };
  const reply = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? '';
  return json(
    200,
    { reply, sources: body.context.slice(0, 1).map((c) => ({ id: c.id, title: c.title })) },
    allowOrigin,
  );
}

// Netlify: expose at /api/chat
export const config = { path: '/api/chat' };
