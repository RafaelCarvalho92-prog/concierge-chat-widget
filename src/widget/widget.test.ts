import { describe, expect, it, vi } from 'vitest';
import { KnowledgeBaseProvider } from '../brain/knowledgeBase';
import { DEFAULT_CONFIG } from '../core/config';
import type { ChatProvider, WidgetConfig, WidgetEvent } from '../core/types';
import { clinicKb } from '../test/kb';
import { safeUrl } from './dom';
import { ConciergeWidget } from './Widget';

const config: WidgetConfig = {
  ...DEFAULT_CONFIG,
  businessId: 'brightsmile',
  businessName: 'Brightsmile Dental',
  handoffEmail: 'hello@brightsmile.example',
  handoffWhatsapp: '15550100',
  quickReplies: ['Opening hours', 'Prices'],
};

function mount(overrides: Partial<WidgetConfig> = {}, provider?: ChatProvider) {
  const widget = new ConciergeWidget(
    { ...config, ...overrides },
    provider ?? new KnowledgeBaseProvider(clinicKb),
    { typingDelayMs: 0 },
  );
  const $ = <T extends Element = HTMLElement>(sel: string) =>
    widget.root.querySelector<T & Element>(sel);
  const $$ = (sel: string) => Array.from(widget.root.querySelectorAll<HTMLElement>(sel));
  const events: WidgetEvent[] = [];
  widget.on((e) => events.push(e));
  return { widget, $, $$, events };
}

describe('ConciergeWidget', () => {
  it('renders inside a shadow root with an accessible launcher and greeting', () => {
    const { widget, $ } = mount();
    expect(widget.host.shadowRoot).toBe(widget.root);
    expect(document.body.querySelector('.launcher')).toBeNull(); // isolated from the page
    const launcher = $('.launcher')!;
    expect(launcher.getAttribute('aria-label')).toBe('Open chat with Brightsmile Dental');
    expect(launcher.getAttribute('aria-expanded')).toBe('false');
    expect($('.log')!.getAttribute('aria-live')).toBe('polite');
    expect($('.msg.bot')!.textContent).toContain('virtual assistant for Brightsmile Dental');
  });

  it('opens, answers with a cited source and emits analytics events', async () => {
    const { widget, $, $$, events } = mount();
    ($('.launcher') as HTMLButtonElement).click();
    expect(widget.opened).toBe(true);
    expect(($('.panel') as HTMLElement).hidden).toBe(false);
    expect(widget.root.activeElement).toBe($('textarea'));

    await widget.send('Do you accept dental insurance?');
    const bots = $$('.msg.bot');
    expect(bots.at(-1)!.textContent).toContain('most major dental insurance plans');
    expect(bots.at(-1)!.querySelector('.sources')!.textContent).toContain(
      'Do you accept dental insurance?',
    );
    expect(events.map((e) => e.type)).toEqual(['open', 'message', 'message', 'answer']);
  });

  it('offers a human handoff for unanswered questions and validates the contact form', async () => {
    const { widget, $, events } = mount();
    widget.open();
    await widget.send('Can I bring my dog to the vet?');
    expect(events.find((e) => e.type === 'unanswered')).toMatchObject({
      question: 'Can I bring my dog to the vet?',
    });
    ($('.inline-handoff') as HTMLButtonElement).click();
    expect(($('.handoff') as HTMLElement).hidden).toBe(false);
    expect(($('.links a') as HTMLAnchorElement).href).toContain('mailto:hello@brightsmile.example');
    expect(($('#cw-note') as HTMLTextAreaElement).value).toBe('Can I bring my dog to the vet?');

    const form = $('.handoff-form') as HTMLFormElement;
    form.requestSubmit();
    expect($('.handoff .error')!.textContent).toMatch(/valid email/);

    ($('#cw-name') as HTMLInputElement).value = 'Ana';
    ($('#cw-email') as HTMLInputElement).value = 'ana@example.com';
    form.requestSubmit();
    expect(($('.handoff') as HTMLElement).hidden).toBe(true);
    expect($('.msg.system')!.textContent).toContain('ana@example.com');
    expect(events.filter((e) => e.type === 'handoff').at(-1)).toEqual({
      type: 'handoff',
      channel: 'form',
      email: 'ana@example.com',
    });
  });

  it('quick replies send their text and disappear after the first question', async () => {
    const { widget, $$ } = mount();
    widget.open();
    const chip = $$('.chip').find((c) => c.textContent === 'Opening hours')!;
    chip.click();
    await vi.waitFor(() => expect($$('.msg.bot').length).toBe(2));
    expect($$('.msg.bot')[1]!.textContent).toContain('Monday to Friday');
    expect($$('.chip').map((c) => c.textContent)).toEqual(['Talk to a human']);
  });

  it('counts unread replies while closed and clears them on open', async () => {
    const { widget, $ } = mount();
    await widget.send('Where is the clinic located?');
    const badge = $('.badge') as HTMLElement;
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe('1');
    expect($('.launcher')!.getAttribute('aria-label')).toContain('1 unread messages');
    widget.open();
    expect(badge.hidden).toBe(true);
  });

  it('traps focus inside the panel and closes on Escape, returning focus to the launcher', () => {
    const { widget, $ } = mount();
    widget.open();
    const panel = $('.panel') as HTMLElement;
    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>('button, textarea, [tabindex="0"]'),
    ).filter((el) => !el.closest('[hidden]'));
    focusable.at(-1)!.focus();
    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(widget.root.activeElement).toBe(focusable[0]);

    panel.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(widget.opened).toBe(false);
    expect(widget.root.activeElement).toBe($('.launcher'));
  });

  it('persists the conversation across page loads and can start over', async () => {
    const first = mount();
    await first.widget.send('Do you treat children?');
    first.widget.destroy();

    const second = mount();
    expect(second.$$('.msg').map((m) => m.className)).toEqual(['msg bot', 'msg user', 'msg bot']);
    second.widget.reset();
    expect(second.$$('.msg')).toHaveLength(1);
  });

  it('renders text safely and localizes the UI', async () => {
    const evil: ChatProvider = {
      name: 'evil',
      answer: async () => ({
        text: '<img src=x onerror=alert(1)>',
        sources: [{ id: 'x', title: 'Bad link', url: 'javascript:alert(1)' }],
        confidence: 1,
        fallback: false,
      }),
    };
    const { widget, $ } = mount({ language: 'pt' }, evil);
    expect($('textarea')!.getAttribute('placeholder')).toBe('Digite sua pergunta...');
    await widget.send('oi');
    expect(widget.root.querySelector('img')).toBeNull();
    expect($('.sources a')).toBeNull(); // javascript: URLs are never linked
    expect(safeUrl('https://ok.example')).toBe('https://ok.example');
    expect(safeUrl('data:text/html,hi')).toBeNull();
  });
});
