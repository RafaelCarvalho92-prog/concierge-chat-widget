/**
 * Okapi BM25 over a small in-memory corpus. Each document is a bag of tokens; the score of a
 * document for a query is the sum over query terms of idf(t) * saturated term frequency,
 * normalized by document length.
 */
export interface Bm25Options {
  /** Term-frequency saturation (typical 1.2-2.0). */
  k1?: number;
  /** Length normalization (0 = none, 1 = full). */
  b?: number;
}

export interface ScoredDoc {
  index: number;
  score: number;
}

export class Bm25Index {
  private readonly k1: number;
  private readonly b: number;
  private readonly termFreqs: Map<string, number>[];
  private readonly docLengths: number[];
  private readonly docFreq = new Map<string, number>();
  private readonly avgLength: number;

  constructor(documents: string[][], options: Bm25Options = {}) {
    this.k1 = options.k1 ?? 1.4;
    this.b = options.b ?? 0.6;
    this.termFreqs = documents.map((tokens) => {
      const tf = new Map<string, number>();
      for (const token of tokens) tf.set(token, (tf.get(token) ?? 0) + 1);
      for (const term of tf.keys()) this.docFreq.set(term, (this.docFreq.get(term) ?? 0) + 1);
      return tf;
    });
    this.docLengths = documents.map((d) => d.length);
    const total = this.docLengths.reduce((a, b) => a + b, 0);
    this.avgLength = documents.length ? total / documents.length : 0;
  }

  get size(): number {
    return this.termFreqs.length;
  }

  /** BM25+ style idf that never goes negative. Unknown terms get the maximum idf. */
  idf(term: string): number {
    const n = this.size;
    const df = this.docFreq.get(term) ?? 0;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
  }

  contains(index: number, term: string): boolean {
    return (this.termFreqs[index]?.get(term) ?? 0) > 0;
  }

  /** Scores one document. `weights` lets synonym expansions count less than original terms. */
  scoreDoc(index: number, terms: Map<string, number>): number {
    const tf = this.termFreqs[index];
    const length = this.docLengths[index] ?? 0;
    if (!tf || !this.avgLength) return 0;
    let score = 0;
    for (const [term, weight] of terms) {
      const f = tf.get(term) ?? 0;
      if (!f) continue;
      const norm = f + this.k1 * (1 - this.b + (this.b * length) / this.avgLength);
      score += weight * this.idf(term) * ((f * (this.k1 + 1)) / norm);
    }
    return score;
  }

  search(terms: Map<string, number>, limit = 5): ScoredDoc[] {
    const results: ScoredDoc[] = [];
    for (let i = 0; i < this.size; i++) {
      const score = this.scoreDoc(i, terms);
      if (score > 0) results.push({ index: i, score });
    }
    return results.sort((a, b) => b.score - a.score || a.index - b.index).slice(0, limit);
  }
}
