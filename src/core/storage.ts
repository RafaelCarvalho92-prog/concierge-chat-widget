import type { ChatMessage } from './types';

const VERSION = 1;
export const MAX_MESSAGES = 60;
export const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Persisted {
  v: number;
  savedAt: number;
  messages: ChatMessage[];
  unread: number;
}

export interface ConversationState {
  messages: ChatMessage[];
  unread: number;
}

/**
 * Conversation persistence in localStorage, namespaced per business. Storage can be
 * unavailable (private mode, blocked cookies) or contain garbage; every path degrades to an
 * empty conversation instead of throwing into the host page.
 */
export class ConversationStore {
  constructor(
    private readonly businessId: string,
    private readonly storage: Storage | null = safeLocalStorage(),
    private readonly now: () => number = Date.now,
  ) {}

  get key(): string {
    return `concierge:${this.businessId}:v${VERSION}`;
  }

  load(): ConversationState {
    const empty = { messages: [], unread: 0 };
    if (!this.storage) return empty;
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return empty;
      const data = JSON.parse(raw) as Partial<Persisted>;
      if (data.v !== VERSION || !Array.isArray(data.messages) || typeof data.savedAt !== 'number') {
        return empty;
      }
      if (this.now() - data.savedAt > TTL_MS) {
        this.clear();
        return empty;
      }
      const messages = data.messages.filter(
        (m): m is ChatMessage =>
          typeof m === 'object' &&
          m !== null &&
          typeof m.text === 'string' &&
          typeof m.role === 'string',
      );
      return { messages, unread: Math.max(0, Number(data.unread) || 0) };
    } catch {
      return empty;
    }
  }

  save(state: ConversationState): void {
    if (!this.storage) return;
    const payload: Persisted = {
      v: VERSION,
      savedAt: this.now(),
      messages: state.messages.slice(-MAX_MESSAGES),
      unread: state.unread,
    };
    try {
      this.storage.setItem(this.key, JSON.stringify(payload));
    } catch {
      /* quota exceeded or storage blocked: the chat still works, it just won't persist */
    }
  }

  clear(): void {
    try {
      this.storage?.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    return null;
  }
}
