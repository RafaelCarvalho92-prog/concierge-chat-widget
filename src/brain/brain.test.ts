import { describe, expect, it, vi } from 'vitest';
import { clinicKb } from '../test/kb';
import { Bm25Index } from './bm25';
import { HttpChatProvider } from './httpProvider';
import { KnowledgeBaseProvider } from './knowledgeBase';
import { fold, tokenize } from './text';

const provider = new KnowledgeBaseProvider(clinicKb, 0.35);
const topId = (q: string) => provider.retrieve(q, 1)[0]?.entry.id;

describe('text processing', () => {
  it('folds accents, drops stop words and stems plurals across languages', () => {
    expect(fold('Implantação Niños')).toBe('implantacao ninos');
    expect(tokenize('What are the prices for cleanings?')).toEqual(['price', 'cleaning']);
    expect(tokenize('Quanto custa o clareamento?')).toEqual(['quanto', 'custa', 'clareamento']);
  });
});

describe('Bm25Index', () => {
  it('ranks the document with rarer matching terms higher and normalizes by length', () => {
    const index = new Bm25Index([
      ['teeth', 'whitening', 'price'],
      ['teeth', 'cleaning', 'price'],
      ['teeth', 'teeth', 'teeth', 'implant', 'price', 'crown', 'scan', 'consultation'],
    ]);
    const results = index.search(
      new Map([
        ['whitening', 1],
        ['teeth', 1],
      ]),
    );
    expect(results[0]?.index).toBe(0);
    expect(index.idf('whitening')).toBeGreaterThan(index.idf('teeth'));
    expect(index.idf('unknown')).toBeGreaterThan(index.idf('whitening'));
  });
});

describe('KnowledgeBaseProvider retrieval', () => {
  it.each([
    ['When are you open on Saturday?', 'hours'],
    ['How much does teeth whitening cost?', 'prices-whitening'],
    ['Do you take my insurance plan?', 'insurance'],
    ['My kid needs a check up', 'children'],
    ['I have terrible toothache', 'emergency'],
    ['Can I pay in installments?', 'payment'],
    ['Is there somewhere to park my car?', 'parking'],
    ['I need to reschedule my visit', 'cancel'],
  ])('"%s" -> %s', (question, expected) => {
    expect(topId(question)).toBe(expected);
  });

  it('expands synonyms so Portuguese and Spanish questions hit English content', () => {
    expect(topId('Quanto custa o clareamento?')).toBe('prices-whitening');
    expect(topId('Vocês aceitam convênio?')).toBe('insurance');
    expect(topId('¿Dónde está la clínica? Necesito la dirección')).toBe('location');
    expect(topId('Atienden a niños?')).toBe('children');
  });

  it('returns grounded answers with a source citation', async () => {
    const answer = await provider.answer('do you have parking?', [], 'en');
    expect(answer.fallback).toBe(false);
    expect(answer.text).toContain('free parking');
    expect(answer.sources).toEqual([{ id: 'parking', title: 'Is there parking nearby?' }]);
    expect(answer.confidence).toBeGreaterThanOrEqual(0.35);
  });

  it('falls back to "I don\'t know" below the confidence threshold, in the user language', async () => {
    const offTopic = await provider.answer('Can I bring my dog to the vet?', [], 'pt');
    expect(offTopic.fallback).toBe(true);
    expect(offTopic.sources).toEqual([]);
    expect(offTopic.text).toMatch(/Quer falar com alguém/);

    const empty = await provider.answer('???', [], 'es');
    expect(empty.fallback).toBe(true);
    expect(empty.confidence).toBe(0);
  });

  it('a stricter threshold turns weak partial matches into handoffs', async () => {
    const question = 'Is parking free for bicycles?'; // ~50% of the meaningful terms match
    expect((await provider.answer(question, [], 'en')).fallback).toBe(false);
    const strict = new KnowledgeBaseProvider(clinicKb, 0.9);
    expect((await strict.answer(question, [], 'en')).fallback).toBe(true);
  });
});

describe('HttpChatProvider', () => {
  const okFetch = (body: unknown) =>
    vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status: 200 }));

  it('sends history + grounding context to the proxy without any API key', async () => {
    const fetchImpl = okFetch({
      reply: 'We open at 8.',
      sources: [{ id: 'hours', title: 'Hours' }],
    });
    const http = new HttpChatProvider({
      endpoint: '/.netlify/functions/chat',
      businessId: 'brightsmile',
      knowledgeBase: provider,
      fetchImpl,
    });
    const answer = await http.answer(
      'When do you open?',
      [{ id: '1', role: 'bot', text: 'Hi', at: 0 }],
      'en',
    );
    expect(answer).toEqual({
      text: 'We open at 8.',
      sources: [{ id: 'hours', title: 'Hours' }],
      confidence: 1,
      fallback: false,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('/.netlify/functions/chat');
    const headers = new Headers(init?.headers);
    expect(headers.has('authorization')).toBe(false);
    const body = JSON.parse(String(init?.body));
    expect(body.messages.at(-1)).toEqual({ role: 'user', content: 'When do you open?' });
    expect(body.messages[0]).toEqual({ role: 'assistant', content: 'Hi' });
    expect(body.context[0].id).toBe('hours');
  });

  it('understands OpenAI and Anthropic response shapes', () => {
    expect(HttpChatProvider.extractReply({ choices: [{ message: { content: 'A' } }] })?.text).toBe(
      'A',
    );
    expect(HttpChatProvider.extractReply({ content: [{ type: 'text', text: 'B' }] })?.text).toBe(
      'B',
    );
    expect(HttpChatProvider.extractReply({ nope: true })).toBeNull();
  });

  it('falls back to the knowledge base when the proxy fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('busy', { status: 503 }));
    const http = new HttpChatProvider({
      endpoint: '/x',
      businessId: 'b',
      knowledgeBase: provider,
      fetchImpl,
    });
    const answer = await http.answer('do you have parking?', [], 'en');
    expect(answer.sources[0]?.id).toBe('parking');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
