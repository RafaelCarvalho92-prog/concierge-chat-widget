import { t } from '../core/i18n';
import type {
  Answer,
  ChatMessage,
  ChatProvider,
  KnowledgeBase,
  KnowledgeEntry,
  Language,
} from '../core/types';
import { Bm25Index } from './bm25';
import { stem, tokenize } from './text';

export interface RetrievalHit {
  entry: KnowledgeEntry;
  score: number;
  /** Share of the question's meaning (idf-weighted terms) found in this entry, 0-1. */
  coverage: number;
}

const SYNONYM_WEIGHT = 0.8;
/** Question and tags matter more than the answer body, so they are repeated in the index. */
const QUESTION_BOOST = 3;

/**
 * Offline "AI" provider: BM25 retrieval over a FAQ/docs JSON with synonym expansion.
 * It only ever answers with text that exists in the knowledge base (grounded, with a citation)
 * and says "I don't know" when the best match is not convincing enough.
 */
export class KnowledgeBaseProvider implements ChatProvider {
  readonly name = 'knowledge-base';
  private readonly index: Bm25Index;
  private readonly synonyms = new Map<string, Set<string>>();

  constructor(
    private readonly kb: KnowledgeBase,
    private readonly threshold = 0.35,
  ) {
    for (const [canonical, variants] of Object.entries(kb.synonyms ?? {})) {
      const group = [canonical, ...variants].flatMap((w) => tokenize(w, { keepStopWords: true }));
      for (const word of group) {
        const set = this.synonyms.get(word) ?? new Set<string>();
        group.forEach((g) => g !== word && set.add(g));
        this.synonyms.set(word, set);
      }
    }
    this.index = new Bm25Index(
      kb.entries.map((e) => {
        const head = tokenize([e.question, ...(e.tags ?? [])].join(' '));
        return [
          ...Array.from({ length: QUESTION_BOOST }, () => head).flat(),
          ...tokenize(e.answer),
        ];
      }),
    );
  }

  /** Query terms with weights: original terms 1.0, synonym expansions slightly less. */
  expand(question: string): { terms: Map<string, number>; original: string[] } {
    const original = [...new Set(tokenize(question))];
    const terms = new Map<string, number>(original.map((term) => [term, 1]));
    for (const term of original) {
      for (const syn of this.synonyms.get(term) ?? []) {
        if (!terms.has(syn)) terms.set(syn, SYNONYM_WEIGHT);
      }
    }
    return { terms, original };
  }

  retrieve(question: string, limit = 3): RetrievalHit[] {
    const { terms, original } = this.expand(question);
    if (!original.length) return [];
    const totalIdf = original.reduce((sum, term) => sum + this.index.idf(term), 0);
    return this.index.search(terms, limit).map(({ index, score }) => {
      const covered = original
        .filter(
          (term) =>
            this.index.contains(index, term) ||
            [...(this.synonyms.get(term) ?? [])].some((s) => this.index.contains(index, s)),
        )
        .reduce((sum, term) => sum + this.index.idf(term), 0);
      return {
        entry: this.kb.entries[index] as KnowledgeEntry,
        score,
        coverage: totalIdf ? covered / totalIdf : 0,
      };
    });
  }

  async answer(question: string, _history: ChatMessage[], language: Language): Promise<Answer> {
    const [best] = this.retrieve(question, 1);
    if (!best || best.coverage < this.threshold) {
      return {
        text: t(language, 'fallback'),
        sources: [],
        confidence: best?.coverage ?? 0,
        fallback: true,
      };
    }
    const { entry } = best;
    return {
      text: entry.answer,
      sources: [{ id: entry.id, title: entry.question, ...(entry.url ? { url: entry.url } : {}) }],
      confidence: Math.round(best.coverage * 100) / 100,
      fallback: false,
    };
  }
}

/** Re-exported for the playground's "why did it match?" inspector. */
export { stem, tokenize };
