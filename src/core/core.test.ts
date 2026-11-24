import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, embedSnippet, parseEmbedAttributes } from './config';
import { DICTIONARIES, LANGUAGES, resolveLanguage, t } from './i18n';
import { ConversationStore, MAX_MESSAGES, TTL_MS } from './storage';
import type { ChatMessage } from './types';

describe('i18n', () => {
  it('has every key translated (and non-empty) in EN, PT and ES', () => {
    const keys = Object.keys(DICTIONARIES.en).sort();
    for (const lang of LANGUAGES) {
      expect(Object.keys(DICTIONARIES[lang]).sort()).toEqual(keys);
      for (const key of keys)
        expect(DICTIONARIES[lang][key as keyof typeof DICTIONARIES.en]).not.toBe('');
    }
  });

  it('interpolates placeholders per language and keeps unknown ones', () => {
    expect(t('en', 'unread', { count: 3 })).toBe('3 unread messages');
    expect(t('pt', 'unread', { count: 3 })).toBe('3 mensagens não lidas');
    expect(t('es', 'launcherOpen', { business: 'Brightsmile' })).toBe('Abrir chat con Brightsmile');
    expect(t('en', 'handoffSent', { name: 'Ana' })).toContain('{email}');
  });

  it('resolves BCP 47 tags to a supported language', () => {
    expect(resolveLanguage('pt-BR')).toBe('pt');
    expect(resolveLanguage('pt-PT')).toBe('pt-PT');
    expect(resolveLanguage('pt_pt')).toBe('pt-PT');
    expect(t('pt-PT', 'inputPlaceholder')).toBe('Escreva a sua pergunta...');
    expect(resolveLanguage('es_MX')).toBe('es');
    expect(resolveLanguage('fr-FR')).toBe('en');
    expect(resolveLanguage(undefined)).toBe('en');
  });
});

describe('parseEmbedAttributes', () => {
  it('reads data-* attributes from the script tag', () => {
    const config = parseEmbedAttributes({
      businessId: 'brightsmile',
      businessName: 'Brightsmile Dental',
      color: '#0EA5E9',
      position: 'left',
      language: 'es',
      greeting: '  Hola!  ',
      kbUrl: './kb.json',
      handoffEmail: 'hello@clinic.example',
      handoffWhatsapp: '+1 (555) 010-0100',
      threshold: '0.5',
      quickReplies: 'Opening hours | Prices|  |Book a visit',
      autoOpen: 'true',
    });
    expect(config).toMatchObject({
      businessId: 'brightsmile',
      color: '#0EA5E9',
      position: 'left',
      language: 'es',
      greeting: 'Hola!',
      handoffWhatsapp: '15550100100',
      threshold: 0.5,
      autoOpen: true,
      quickReplies: ['Opening hours', 'Prices', 'Book a visit'],
    });
  });

  it('falls back to safe defaults for missing or invalid values', () => {
    const config = parseEmbedAttributes(
      {
        businessId: '<script>bad</script>',
        color: 'red; background:url(x)',
        position: 'top',
        threshold: '7',
        handoffEmail: 'not-an-email',
        provider: 'http', // without an endpoint the http provider stays off
      },
      'pt-PT',
    );
    expect(config.businessId).toBe('scriptbadscript');
    expect(config.color).toBe(DEFAULT_CONFIG.color);
    expect(config.position).toBe('right');
    expect(config.language).toBe('pt-PT'); // from navigator.language
    expect(config.threshold).toBe(1);
    expect(config.handoffEmail).toBeNull();
    expect(config.provider).toBe('kb');
  });

  it('round-trips through the embed snippet', () => {
    const config = parseEmbedAttributes({
      businessId: 'x',
      businessName: 'A "quoted" name',
      color: '#123456',
    });
    const snippet = embedSnippet(config, 'https://cdn.example/concierge.js');
    expect(snippet).toContain('data-business-name="A &quot;quoted&quot; name"');
    expect(snippet).toContain('src="https://cdn.example/concierge.js"');
    expect(snippet).not.toContain('data-greeting');
  });
});

describe('ConversationStore', () => {
  const msg = (i: number): ChatMessage => ({ id: String(i), role: 'user', text: `m${i}`, at: i });

  it('persists messages and unread count per business, capped to the most recent', () => {
    const store = new ConversationStore('clinic', localStorage);
    const messages = Array.from({ length: MAX_MESSAGES + 5 }, (_, i) => msg(i));
    store.save({ messages, unread: 2 });
    const loaded = new ConversationStore('clinic', localStorage).load();
    expect(loaded.messages).toHaveLength(MAX_MESSAGES);
    expect(loaded.messages[0]?.text).toBe('m5');
    expect(loaded.unread).toBe(2);
    expect(new ConversationStore('other', localStorage).load().messages).toEqual([]);
  });

  it('expires old conversations and survives corrupted or unavailable storage', () => {
    let now = 1_000;
    const store = new ConversationStore('clinic', localStorage, () => now);
    store.save({ messages: [msg(1)], unread: 0 });
    now += TTL_MS + 1;
    expect(store.load().messages).toEqual([]);
    expect(localStorage.getItem(store.key)).toBeNull();

    localStorage.setItem(store.key, '{broken json');
    expect(store.load()).toEqual({ messages: [], unread: 0 });
    const noStorage = new ConversationStore('clinic', null);
    noStorage.save({ messages: [msg(1)], unread: 0 });
    expect(noStorage.load().messages).toEqual([]);
  });
});
