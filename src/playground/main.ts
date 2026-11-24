import { KnowledgeBaseProvider } from '../brain/knowledgeBase';
import { DEFAULT_CONFIG, embedSnippet } from '../core/config';
import { resolveLanguage } from '../core/i18n';
import type { KnowledgeBase, Language, WidgetConfig, WidgetEvent } from '../core/types';
import { init } from '../embed';
import { isKnowledgeBase } from '../widget/createProvider';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const fields = {
  name: $<HTMLInputElement>('f-name'),
  color: $<HTMLInputElement>('f-color'),
  position: $<HTMLSelectElement>('f-position'),
  language: $<HTMLSelectElement>('f-language'),
  threshold: $<HTMLInputElement>('f-threshold'),
  greeting: $<HTMLInputElement>('f-greeting'),
  quick: $<HTMLInputElement>('f-quick'),
  email: $<HTMLInputElement>('f-email'),
  whatsapp: $<HTMLInputElement>('f-whatsapp'),
};
const kbInput = $<HTMLTextAreaElement>('kb');
const kbStatus = $<HTMLParagraphElement>('kb-status');
const snippet = $<HTMLPreElement>('snippet');
const probe = $<HTMLInputElement>('probe');
const hits = $<HTMLOListElement>('hits');
const eventsList = $<HTMLUListElement>('events');
const unansweredList = $<HTMLUListElement>('unanswered');
const unansweredEmpty = $<HTMLParagraphElement>('unanswered-empty');

let knowledgeBase: KnowledgeBase = { business: 'Brightsmile Dental', entries: [] };
const unanswered = new Map<string, number>();
const SCRIPT_URL = 'https://cdn.example.com/concierge.js';

function readConfig(): WidgetConfig {
  return {
    ...DEFAULT_CONFIG,
    businessId: 'brightsmile',
    businessName: fields.name.value.trim() || 'Brightsmile Dental',
    color: fields.color.value,
    position: fields.position.value === 'left' ? 'left' : 'right',
    language: fields.language.value as Language,
    threshold: Number(fields.threshold.value),
    greeting: fields.greeting.value.trim() || null,
    quickReplies: fields.quick.value
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4),
    handoffEmail: fields.email.value.trim() || null,
    handoffWhatsapp: fields.whatsapp.value.replace(/\D/g, '') || null,
    kbUrl: '/kb.json',
  };
}

function logEvent(event: WidgetEvent): void {
  const li = document.createElement('li');
  const pill = document.createElement('span');
  pill.className = 'pill';
  pill.textContent = event.type;
  const { type: _type, ...rest } = event;
  li.append(pill, JSON.stringify(rest));
  eventsList.prepend(li);
  while (eventsList.childElementCount > 50) eventsList.lastElementChild?.remove();

  if (event.type === 'unanswered') {
    const key = event.question.toLowerCase();
    unanswered.set(key, (unanswered.get(key) ?? 0) + 1);
    renderUnanswered();
  }
}

function renderUnanswered(): void {
  unansweredEmpty.hidden = unanswered.size > 0;
  unansweredList.replaceChildren(
    ...[...unanswered.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([question, count]) => {
        const li = document.createElement('li');
        li.textContent = `${count}x  ${question}`;
        return li;
      }),
  );
}

function renderInspector(): void {
  const provider = new KnowledgeBaseProvider(knowledgeBase, Number(fields.threshold.value));
  const results = provider.retrieve(probe.value, 3);
  if (!probe.value.trim()) {
    hits.replaceChildren();
    return;
  }
  if (!results.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No matching entries: the assistant will offer a human handoff.';
    hits.replaceChildren(li);
    return;
  }
  const threshold = Number(fields.threshold.value);
  hits.replaceChildren(
    ...results.map((hit, i) => {
      const li = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = hit.entry.question;
      const meta = document.createElement('div');
      const passes = i === 0 && hit.coverage >= threshold;
      meta.textContent = `BM25 ${hit.score.toFixed(2)} · confidence ${(hit.coverage * 100).toFixed(0)}% ${
        i === 0 ? (passes ? '· answered' : '· below threshold, hands off') : ''
      }`;
      const meter = document.createElement('div');
      meter.className = 'meter';
      const bar = document.createElement('span');
      bar.style.width = `${Math.round(hit.coverage * 100)}%`;
      meter.append(bar);
      li.append(title, meta, meter);
      return li;
    }),
  );
}

let timer: number | undefined;
function refresh(): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    const config = readConfig();
    $('f-threshold-value').textContent = `(${Math.round(config.threshold * 100)}%)`;
    snippet.textContent = embedSnippet(config, SCRIPT_URL);
    const wasOpen =
      Boolean(document.querySelector('[data-concierge]')) &&
      sessionStorage.getItem('pg-open') === '1';
    const widget = init(config, { knowledgeBase, onEvent: logEvent });
    widget.on((e) => {
      if (e.type === 'open') sessionStorage.setItem('pg-open', '1');
      if (e.type === 'close') sessionStorage.setItem('pg-open', '0');
    });
    if (wasOpen) widget.open();
    renderInspector();
  }, 250);
}

function parseKb(): void {
  try {
    const data: unknown = JSON.parse(kbInput.value);
    if (!isKnowledgeBase(data))
      throw new Error('Expected { "entries": [{ "id", "question", "answer" }] }');
    knowledgeBase = data;
    kbStatus.className = 'status ok';
    kbStatus.textContent = `Valid: ${data.entries.length} entries, ${Object.keys(data.synonyms ?? {}).length} synonym groups.`;
    kbInput.removeAttribute('aria-invalid');
    refresh();
  } catch (err) {
    kbStatus.className = 'status err';
    kbStatus.textContent = `Not applied: ${err instanceof Error ? err.message : String(err)}`;
    kbInput.setAttribute('aria-invalid', 'true');
  }
}

async function main(): Promise<void> {
  fields.name.value = 'Brightsmile Dental';
  fields.color.value = '#0e7490';
  fields.threshold.value = String(DEFAULT_CONFIG.threshold);
  fields.quick.value = 'Opening hours|Teeth whitening price|Do you accept insurance?';
  fields.email.value = 'hello@brightsmile.example';
  fields.whatsapp.value = '15550100100';
  fields.language.value = resolveLanguage(navigator.language);

  try {
    const response = await fetch('./kb/brightsmile.json');
    kbInput.value = await response.text();
  } catch {
    kbInput.value = JSON.stringify(knowledgeBase, null, 2);
  }
  parseKb();

  Object.values(fields).forEach((el) => el.addEventListener('input', refresh));
  kbInput.addEventListener('input', () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(parseKb, 400);
  });
  probe.addEventListener('input', renderInspector);
  $('copy').addEventListener('click', async () => {
    const status = $('copy-status');
    try {
      await navigator.clipboard.writeText(snippet.textContent ?? '');
      status.textContent = 'Copied!';
    } catch {
      status.textContent = 'Select the snippet and copy it manually.';
    }
  });
}

void main();
