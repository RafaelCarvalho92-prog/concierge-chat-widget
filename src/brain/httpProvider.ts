import type { Answer, ChatMessage, ChatProvider, Language, Source } from '../core/types';
import type { KnowledgeBaseProvider } from './knowledgeBase';

export interface HttpProviderOptions {
  /** Your server-side proxy (e.g. /.netlify/functions/chat). NEVER an LLM vendor URL with a key. */
  endpoint: string;
  businessId: string;
  /** Used to ground the LLM with the top KB passages, and as the offline fallback. */
  knowledgeBase?: KnowledgeBaseProvider;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface ProxyRequest {
  businessId: string;
  language: Language;
  messages: { role: 'user' | 'assistant'; content: string }[];
  context: { id: string; title: string; text: string }[];
}

/**
 * Talks to a tiny server proxy that holds the real API key (see /server). It accepts the
 * proxy's own shape ({ reply, sources }) as well as raw OpenAI chat-completions
 * ({ choices[0].message.content }) and Anthropic messages ({ content[0].text }) responses.
 * Any failure (timeout, HTTP error, malformed JSON) falls back to the offline KB provider.
 */
export class HttpChatProvider implements ChatProvider {
  readonly name = 'http';
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: HttpProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
  }

  buildRequest(question: string, history: ChatMessage[], language: Language): ProxyRequest {
    const hits = this.options.knowledgeBase?.retrieve(question, 3) ?? [];
    return {
      businessId: this.options.businessId,
      language,
      messages: [
        ...history
          .filter((m) => m.role !== 'system')
          .slice(-8)
          .map((m) => ({
            role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          })),
        { role: 'user', content: question },
      ],
      context: hits.map((h) => ({ id: h.entry.id, title: h.entry.question, text: h.entry.answer })),
    };
  }

  static extractReply(data: unknown): { text: string; sources: Source[] } | null {
    if (!data || typeof data !== 'object') return null;
    const d = data as Record<string, unknown>;
    if (typeof d.reply === 'string') {
      const sources = Array.isArray(d.sources) ? (d.sources as Source[]) : [];
      return { text: d.reply, sources };
    }
    const choice = Array.isArray(d.choices) ? (d.choices[0] as Record<string, unknown>) : undefined;
    const message = choice?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === 'string') return { text: message.content, sources: [] };
    const block = Array.isArray(d.content) ? (d.content[0] as Record<string, unknown>) : undefined;
    if (typeof block?.text === 'string') return { text: block.text, sources: [] };
    return null;
  }

  async answer(question: string, history: ChatMessage[], language: Language): Promise<Answer> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15_000);
    try {
      const response = await this.fetchImpl(this.options.endpoint, {
        method: 'POST',
        // Deliberately no Authorization header: the key lives only on the server.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(this.buildRequest(question, history, language)),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Proxy responded ${response.status}`);
      const reply = HttpChatProvider.extractReply(await response.json());
      if (!reply || !reply.text.trim()) throw new Error('Malformed proxy response');
      return { text: reply.text.trim(), sources: reply.sources, confidence: 1, fallback: false };
    } catch (err) {
      console.warn('[concierge] http provider failed, using knowledge base', err);
      if (this.options.knowledgeBase) {
        return this.options.knowledgeBase.answer(question, history, language);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
