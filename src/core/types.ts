/** 'pt' = Brazilian Portuguese, 'pt-PT' = European Portuguese. */
export type Language = 'en' | 'pt' | 'pt-PT' | 'es';
export type Position = 'right' | 'left';

export interface WidgetConfig {
  businessId: string;
  businessName: string;
  /** Accent colour as #rrggbb. */
  color: string;
  position: Position;
  language: Language;
  /** Overrides the localized default greeting when set. */
  greeting: string | null;
  /** URL of the knowledge base JSON (relative to the host page). */
  kbUrl: string | null;
  /** "kb" = offline retrieval; "http" = server proxy to an LLM (falls back to kb on error). */
  provider: 'kb' | 'http';
  /** Server-side proxy endpoint for the http provider. Never an LLM API key. */
  endpoint: string | null;
  handoffEmail: string | null;
  /** WhatsApp number in international format, digits only. */
  handoffWhatsapp: string | null;
  /** 0-1: answers below this retrieval confidence trigger the "I don't know" fallback. */
  threshold: number;
  /** Open the panel automatically on first visit. */
  autoOpen: boolean;
  quickReplies: string[];
}

export interface Source {
  id: string;
  title: string;
  url?: string;
}

export type Role = 'user' | 'bot' | 'system';

export interface ChatMessage {
  id: string;
  role: Role;
  text: string;
  at: number;
  sources?: Source[];
  /** True when the bot could not answer and offered a human handoff. */
  fallback?: boolean;
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  /** Extra phrasings / keywords that should match this entry. */
  tags?: string[];
  url?: string;
}

export interface KnowledgeBase {
  business: string;
  language?: Language;
  entries: KnowledgeEntry[];
  /** Canonical term -> equivalent terms, e.g. { "price": ["cost", "fee"] }. */
  synonyms?: Record<string, string[]>;
}

export interface Answer {
  text: string;
  sources: Source[];
  /** 0-1 retrieval confidence (1 for LLM answers). */
  confidence: number;
  fallback: boolean;
}

export interface ChatProvider {
  readonly name: string;
  answer(question: string, history: ChatMessage[], language: Language): Promise<Answer>;
}

export type WidgetEvent =
  | { type: 'open' }
  | { type: 'close' }
  | { type: 'message'; role: Role; text: string }
  | { type: 'answer'; question: string; confidence: number; sources: string[] }
  | { type: 'unanswered'; question: string; confidence: number }
  | { type: 'handoff'; channel: 'form' | 'email' | 'whatsapp'; email?: string };
