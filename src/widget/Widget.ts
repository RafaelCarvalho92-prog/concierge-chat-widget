import { Emitter, type Listener } from '../core/emitter';
import { t, type MessageKey } from '../core/i18n';
import { ConversationStore } from '../core/storage';
import type { ChatMessage, ChatProvider, Source, WidgetConfig } from '../core/types';
import { contrastInk, focusables, h, icon, safeUrl } from './dom';
import { STYLES } from './styles';

export interface WidgetOptions {
  /** Element to attach the widget host to (default: document.body). */
  container?: HTMLElement;
  store?: ConversationStore;
  /** Simulated "thinking" time so instant offline answers feel natural (0 in tests). */
  typingDelayMs?: number;
}

let idCounter = 0;
const uid = () => `m${Date.now().toString(36)}${(idCounter++).toString(36)}`;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The chat widget. Everything renders inside a Shadow DOM attached to one host element, so the
 * host page's CSS and the widget's CSS never interact.
 */
export class ConciergeWidget {
  readonly host: HTMLElement;
  readonly root: ShadowRoot;
  private readonly events = new Emitter();
  private readonly store: ConversationStore;
  private readonly typingDelayMs: number;
  private messages: ChatMessage[] = [];
  private unread = 0;
  private isOpen = false;
  private busy = false;
  private providerPromise: Promise<ChatProvider>;

  // Elements
  private readonly wrapper: HTMLDivElement;
  private readonly launcher: HTMLButtonElement;
  private readonly badge: HTMLSpanElement;
  private readonly panel: HTMLDivElement;
  private readonly log: HTMLDivElement;
  private readonly typing: HTMLDivElement;
  private readonly chips: HTMLDivElement;
  private readonly input: HTMLTextAreaElement;
  private readonly sendButton: HTMLButtonElement;
  private readonly chatView: HTMLDivElement;
  private readonly handoffView: HTMLDivElement;
  private readonly announcer: HTMLDivElement;

  constructor(
    readonly config: WidgetConfig,
    provider: ChatProvider | Promise<ChatProvider>,
    options: WidgetOptions = {},
  ) {
    this.providerPromise = Promise.resolve(provider);
    this.store = options.store ?? new ConversationStore(config.businessId);
    this.typingDelayMs = options.typingDelayMs ?? 650;

    this.host = h('div', { 'data-concierge': config.businessId });
    this.root = this.host.attachShadow({ mode: 'open' });
    const style = h('style');
    style.textContent = STYLES;

    const tr = (key: MessageKey, vars: Record<string, string | number> = {}) =>
      t(config.language, key, { business: config.businessName, ...vars });

    this.badge = h('span', { class: 'badge', 'aria-hidden': 'true', hidden: true });
    this.launcher = h(
      'button',
      {
        class: 'launcher',
        type: 'button',
        'aria-expanded': 'false',
        'aria-controls': 'cw-panel',
        'aria-label': tr('launcherOpen'),
      },
      icon('chat'),
      this.badge,
    );

    this.log = h('div', {
      class: 'log',
      role: 'log',
      'aria-live': 'polite',
      'aria-relevant': 'additions',
      'aria-label': tr('title'),
      tabindex: '0',
    });
    this.typing = h(
      'div',
      { class: 'typing', role: 'status', hidden: true },
      h('span', { 'aria-hidden': 'true' }),
      h('span', { 'aria-hidden': 'true' }),
      h('span', { 'aria-hidden': 'true' }),
      h('span', { class: 'sr' }, tr('typing')),
    );
    this.chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'Suggestions' });
    this.input = h('textarea', {
      rows: 1,
      placeholder: tr('inputPlaceholder'),
      'aria-label': tr('inputLabel'),
      maxlength: 500,
    });
    this.sendButton = h(
      'button',
      { class: 'send', type: 'submit', 'aria-label': tr('send') },
      icon('send'),
    );
    const composer = h('form', { class: 'composer' }, this.input, this.sendButton);

    this.chatView = h(
      'div',
      { class: 'chat', style: 'display:contents' },
      this.log,
      this.chips,
      composer,
    );
    this.handoffView = h('div', { class: 'handoff', hidden: true });

    const closeBtn = h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': tr('launcherClose') },
      icon('close'),
    );
    const resetBtn = h(
      'button',
      { class: 'icon-btn', type: 'button', 'aria-label': tr('clear'), title: tr('clear') },
      icon('refresh'),
    );
    this.panel = h(
      'div',
      {
        class: 'panel',
        id: 'cw-panel',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'cw-title',
        hidden: true,
      },
      h(
        'header',
        {},
        h(
          'div',
          { class: 'avatar', 'aria-hidden': 'true' },
          config.businessName.charAt(0).toUpperCase(),
        ),
        h(
          'div',
          { class: 'titles' },
          h('p', { class: 'title', id: 'cw-title' }, tr('title')),
          h('p', { class: 'subtitle' }, tr('subtitle')),
        ),
        resetBtn,
        closeBtn,
      ),
      this.chatView,
      this.handoffView,
      this.typing,
      h('footer', {}, tr('poweredBy')),
    );
    // The typing indicator belongs inside the log visually.
    this.log.after(this.typing);

    this.announcer = h('div', { class: 'sr', 'aria-live': 'assertive' });
    this.wrapper = h(
      'div',
      { class: `root ${config.position}` },
      this.panel,
      this.launcher,
      this.announcer,
    );
    this.wrapper.style.setProperty('--accent', config.color);
    this.wrapper.style.setProperty('--accent-ink', contrastInk(config.color));
    this.root.append(style, this.wrapper);

    // ---- wiring ---------------------------------------------------------------------------
    this.launcher.addEventListener('click', () => this.toggle());
    closeBtn.addEventListener('click', () => this.close());
    resetBtn.addEventListener('click', () => this.reset());
    composer.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.send(this.input.value);
    });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.send(this.input.value);
      }
    });
    this.panel.addEventListener('keydown', (e) => this.onPanelKeydown(e));

    (options.container ?? document.body).append(this.host);
    this.restore();
    if (config.autoOpen && this.messages.length <= 1) this.open();
  }

  // ---- public API -------------------------------------------------------------------------

  on(listener: Listener): () => void {
    return this.events.on(listener);
  }

  get opened(): boolean {
    return this.isOpen;
  }

  get conversation(): readonly ChatMessage[] {
    return this.messages;
  }

  setProvider(provider: ChatProvider | Promise<ChatProvider>): void {
    this.providerPromise = Promise.resolve(provider);
  }

  open(): void {
    if (this.isOpen) return;
    this.isOpen = true;
    this.panel.hidden = false;
    this.wrapper.classList.add('open');
    this.launcher.setAttribute('aria-expanded', 'true');
    this.launcher.setAttribute('aria-label', this.tr('launcherClose'));
    this.setUnread(0);
    this.log.scrollTop = this.log.scrollHeight;
    this.input.focus();
    this.events.emit({ type: 'open' });
  }

  close(): void {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.panel.hidden = true;
    this.wrapper.classList.remove('open');
    this.launcher.setAttribute('aria-expanded', 'false');
    this.updateLauncherLabel();
    this.launcher.focus();
    this.events.emit({ type: 'close' });
  }

  toggle(): void {
    if (this.isOpen) this.close();
    else this.open();
  }

  reset(): void {
    this.messages = [];
    this.log.replaceChildren();
    this.store.clear();
    this.greet();
    this.showChat();
  }

  destroy(): void {
    this.host.remove();
  }

  /** Sends a user message and renders the answer. Resolves when the bot has replied. */
  async send(raw: string): Promise<void> {
    const text = raw.trim().slice(0, 500);
    if (!text || this.busy) return;
    this.busy = true;
    this.input.value = '';
    this.sendButton.disabled = true;
    this.addMessage({ role: 'user', text });
    this.typing.hidden = false;
    this.log.scrollTop = this.log.scrollHeight;
    try {
      const provider = await this.providerPromise;
      const [answer] = await Promise.all([
        provider.answer(text, this.messages.slice(0, -1), this.config.language),
        new Promise((r) => setTimeout(r, this.typingDelayMs)),
      ]);
      this.addMessage({
        role: 'bot',
        text: answer.text,
        sources: answer.sources,
        fallback: answer.fallback,
      });
      if (answer.fallback) {
        this.events.emit({ type: 'unanswered', question: text, confidence: answer.confidence });
      } else {
        this.events.emit({
          type: 'answer',
          question: text,
          confidence: answer.confidence,
          sources: answer.sources.map((s) => s.id),
        });
      }
    } catch (err) {
      console.error('[concierge] provider error', err);
      this.addMessage({ role: 'bot', text: this.tr('error'), fallback: true });
      this.events.emit({ type: 'unanswered', question: text, confidence: 0 });
    } finally {
      this.typing.hidden = true;
      this.busy = false;
      this.sendButton.disabled = false;
    }
  }

  showHandoff(): void {
    this.chatView.hidden = true;
    this.chatView.style.display = 'none';
    this.handoffView.hidden = false;
    this.renderHandoff();
    focusables(this.handoffView)[0]?.focus();
    this.events.emit({ type: 'handoff', channel: 'form' });
  }

  // ---- internals ----------------------------------------------------------------------------

  private tr(key: MessageKey, vars: Record<string, string | number> = {}): string {
    return t(this.config.language, key, { business: this.config.businessName, ...vars });
  }

  private restore(): void {
    const saved = this.store.load();
    this.messages = saved.messages;
    this.messages.forEach((m) => this.renderMessage(m));
    this.setUnread(saved.unread);
    if (!this.messages.length) this.greet();
    this.renderChips();
  }

  private greet(): void {
    this.addMessage(
      { role: 'bot', text: this.config.greeting ?? this.tr('greeting') },
      { countUnread: false },
    );
  }

  private addMessage(
    partial: Omit<ChatMessage, 'id' | 'at'>,
    { countUnread = true }: { countUnread?: boolean } = {},
  ): ChatMessage {
    const message: ChatMessage = { id: uid(), at: Date.now(), ...partial };
    this.messages.push(message);
    this.renderMessage(message);
    if (message.role === 'bot' && !this.isOpen && countUnread) {
      this.setUnread(this.unread + 1);
      this.announcer.textContent = this.tr('newMessage');
    }
    this.events.emit({ type: 'message', role: message.role, text: message.text });
    this.store.save({ messages: this.messages, unread: this.unread });
    this.renderChips();
    return message;
  }

  private renderMessage(message: ChatMessage): void {
    const bubble = h('div', { class: `msg ${message.role}` }, message.text);
    if (message.sources?.length) {
      const list = h('ul', { class: 'sources', 'aria-label': this.tr('sources') });
      for (const source of message.sources) list.append(this.renderSource(source));
      bubble.append(list);
    }
    if (message.fallback) {
      const btn = h('button', { type: 'button', class: 'inline-handoff' }, this.tr('talkToHuman'));
      btn.addEventListener('click', () => this.showHandoff());
      bubble.append(btn);
    }
    this.log.append(bubble);
    this.log.scrollTop = this.log.scrollHeight;
  }

  private renderSource(source: Source): HTMLLIElement {
    const url = safeUrl(source.url);
    const label = `${this.tr('sources')}: ${source.title}`;
    return h(
      'li',
      {},
      url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, label) : label,
    );
  }

  private renderChips(): void {
    const userHasSpoken = this.messages.some((m) => m.role === 'user');
    const replies = userHasSpoken ? [] : this.config.quickReplies;
    const chips = replies.map((text) => {
      const chip = h('button', { type: 'button', class: 'chip' }, text);
      chip.addEventListener('click', () => void this.send(text));
      return chip;
    });
    if (this.config.handoffEmail || this.config.handoffWhatsapp) {
      const human = h('button', { type: 'button', class: 'chip' }, this.tr('talkToHuman'));
      human.addEventListener('click', () => this.showHandoff());
      chips.push(human);
    }
    this.chips.replaceChildren(...chips);
    this.chips.hidden = chips.length === 0;
  }

  private renderHandoff(): void {
    const { handoffEmail, handoffWhatsapp, businessName } = this.config;
    const error = h('p', { class: 'error', role: 'alert' });
    const name = h('input', { id: 'cw-name', autocomplete: 'name', required: true });
    const email = h('input', {
      id: 'cw-email',
      type: 'email',
      autocomplete: 'email',
      required: true,
    });
    const note = h('textarea', { id: 'cw-note', rows: 3 });
    const lastQuestion = [...this.messages].reverse().find((m) => m.role === 'user')?.text ?? '';
    note.value = lastQuestion;

    const form = h(
      'form',
      {
        class: 'handoff-form',
        novalidate: true,
        style: 'display:flex;flex-direction:column;gap:10px',
      },
      h('label', { class: 'field', for: 'cw-name' }, this.tr('handoffName'), name),
      h('label', { class: 'field', for: 'cw-email' }, this.tr('handoffEmail'), email),
      h('label', { class: 'field', for: 'cw-note' }, this.tr('handoffMessage'), note),
      error,
      h('button', { class: 'primary', type: 'submit' }, this.tr('handoffSubmit')),
    );
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (name.value.trim().length < 2 || !EMAIL_RE.test(email.value.trim())) {
        error.textContent = this.tr('handoffInvalid');
        email.setAttribute('aria-invalid', String(!EMAIL_RE.test(email.value.trim())));
        return;
      }
      this.events.emit({ type: 'handoff', channel: 'form', email: email.value.trim() });
      this.showChat();
      this.addMessage(
        {
          role: 'system',
          text: this.tr('handoffSent', { name: name.value.trim(), email: email.value.trim() }),
        },
        { countUnread: false },
      );
      this.input.focus();
    });

    const subject = encodeURIComponent(`Question for ${businessName}`);
    const body = encodeURIComponent(lastQuestion);
    const links = h('div', { class: 'links' });
    if (handoffEmail) {
      const a = h(
        'a',
        { href: `mailto:${handoffEmail}?subject=${subject}&body=${body}` },
        this.tr('handoffEmailLink'),
      );
      a.addEventListener('click', () => this.events.emit({ type: 'handoff', channel: 'email' }));
      links.append(a);
    }
    if (handoffWhatsapp) {
      const a = h(
        'a',
        {
          href: `https://wa.me/${handoffWhatsapp}?text=${body}`,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        this.tr('handoffWhatsapp'),
      );
      a.addEventListener('click', () => this.events.emit({ type: 'handoff', channel: 'whatsapp' }));
      links.append(a);
    }
    const back = h('button', { type: 'button', class: 'link-btn' }, `← ${this.tr('back')}`);
    back.addEventListener('click', () => {
      this.showChat();
      this.input.focus();
    });

    this.handoffView.replaceChildren(
      back,
      h('h3', {}, this.tr('handoffTitle')),
      h('p', {}, this.tr('handoffIntro')),
      ...(links.childElementCount ? [links] : []),
      form,
    );
  }

  private showChat(): void {
    this.handoffView.hidden = true;
    this.chatView.hidden = false;
    this.chatView.style.display = 'contents';
  }

  private setUnread(count: number): void {
    this.unread = count;
    this.badge.hidden = count === 0;
    this.badge.textContent = count > 9 ? '9+' : String(count);
    this.updateLauncherLabel();
    this.store.save({ messages: this.messages, unread: this.unread });
  }

  private updateLauncherLabel(): void {
    if (this.isOpen) return;
    const base = this.tr('launcherOpen');
    this.launcher.setAttribute(
      'aria-label',
      this.unread ? `${base}. ${this.tr('unread', { count: this.unread })}` : base,
    );
  }

  /** Escape closes; Tab/Shift+Tab cycle within the dialog (focus trap). */
  private onPanelKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.stopPropagation();
      this.close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables(this.panel);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    const active = this.root.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }
}
