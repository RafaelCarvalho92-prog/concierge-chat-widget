import { HttpChatProvider } from '../brain/httpProvider';
import { KnowledgeBaseProvider } from '../brain/knowledgeBase';
import type { ChatProvider, KnowledgeBase, WidgetConfig } from '../core/types';

export function isKnowledgeBase(value: unknown): value is KnowledgeBase {
  if (!value || typeof value !== 'object') return false;
  const kb = value as Partial<KnowledgeBase>;
  return (
    Array.isArray(kb.entries) &&
    kb.entries.every(
      (e) =>
        typeof e === 'object' &&
        e !== null &&
        typeof e.id === 'string' &&
        typeof e.question === 'string' &&
        typeof e.answer === 'string',
    )
  );
}

export async function loadKnowledgeBase(
  url: string,
  fetchImpl: typeof fetch = (...args) => fetch(...args),
): Promise<KnowledgeBase> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Knowledge base request failed (${response.status})`);
  const data: unknown = await response.json();
  if (!isKnowledgeBase(data)) throw new Error('Knowledge base JSON has an unexpected shape');
  return data;
}

/** Builds the provider described by the config. A missing/broken KB yields an empty one, so
 * the widget still works (every question becomes a polite handoff). */
export async function createProvider(
  config: WidgetConfig,
  kb?: KnowledgeBase,
): Promise<ChatProvider> {
  let knowledge = kb;
  if (!knowledge && config.kbUrl) {
    try {
      knowledge = await loadKnowledgeBase(config.kbUrl);
    } catch (err) {
      console.error('[concierge]', err);
    }
  }
  const kbProvider = new KnowledgeBaseProvider(
    knowledge ?? { business: config.businessName, entries: [] },
    config.threshold,
  );
  if (config.provider === 'http' && config.endpoint) {
    return new HttpChatProvider({
      endpoint: config.endpoint,
      businessId: config.businessId,
      knowledgeBase: kbProvider,
    });
  }
  return kbProvider;
}
