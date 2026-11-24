/**
 * Script-tag entry point. Usage on any website:
 *
 *   <script src="https://cdn.example.com/concierge.js" data-business-id="brightsmile"
 *           data-kb-url="/kb.json" data-color="#0ea5e9" defer></script>
 *
 * Also exposes `window.Concierge` for programmatic control and analytics hooks.
 */
import { DEFAULT_CONFIG, parseEmbedAttributes } from './core/config';
import type { Listener } from './core/emitter';
import type { KnowledgeBase, WidgetConfig } from './core/types';
import { createProvider } from './widget/createProvider';
import { ConciergeWidget } from './widget/Widget';

export interface InitOptions {
  /** Inline knowledge base (skips fetching kbUrl). */
  knowledgeBase?: KnowledgeBase;
  container?: HTMLElement;
  onEvent?: Listener;
}

let current: ConciergeWidget | null = null;

export function init(
  config: Partial<WidgetConfig> = {},
  options: InitOptions = {},
): ConciergeWidget {
  current?.destroy();
  const full: WidgetConfig = { ...DEFAULT_CONFIG, ...config };
  const widget = new ConciergeWidget(full, createProvider(full, options.knowledgeBase), {
    container: options.container,
  });
  if (options.onEvent) widget.on(options.onEvent);
  current = widget;
  return widget;
}

export const open = () => current?.open();
export const close = () => current?.close();
export const on = (listener: Listener) => current?.on(listener);
export const destroy = () => {
  current?.destroy();
  current = null;
};
export const instance = () => current;

// Auto-boot from the <script> tag's data attributes (unless data-manual is present).
const script =
  typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
if (script && !('manual' in script.dataset)) {
  const boot = () => init(parseEmbedAttributes({ ...script.dataset }, navigator.language));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
}
