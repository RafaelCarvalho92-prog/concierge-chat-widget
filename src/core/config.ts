import { resolveLanguage } from './i18n';
import type { WidgetConfig } from './types';

export const DEFAULT_CONFIG: WidgetConfig = {
  businessId: 'demo',
  businessName: 'our team',
  color: '#0f766e',
  position: 'right',
  language: 'en',
  greeting: null,
  kbUrl: null,
  provider: 'kb',
  endpoint: null,
  handoffEmail: null,
  handoffWhatsapp: null,
  threshold: 0.35,
  autoOpen: false,
  quickReplies: [],
};

const HEX = /^#(?:[0-9a-f]{3}){1,2}$/i;

function bool(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined;
  return value === '' || /^(true|1|yes)$/i.test(value);
}

/**
 * Builds a config from a script tag's data-* attributes (``el.dataset``), e.g.
 * ``<script src=".../concierge.js" data-business-id="brightsmile" data-color="#0ea5e9">``.
 * Invalid values fall back to safe defaults rather than breaking the host page.
 */
export function parseEmbedAttributes(
  dataset: Record<string, string | undefined>,
  navigatorLanguage?: string,
): WidgetConfig {
  const d = dataset;
  const threshold = Number(d.threshold);
  const position = d.position === 'left' ? 'left' : 'right';
  const provider = d.provider === 'http' && d.endpoint ? 'http' : 'kb';
  const whatsapp = d.handoffWhatsapp?.replace(/\D/g, '') || null;
  const email =
    d.handoffEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.handoffEmail) ? d.handoffEmail : null;

  return {
    ...DEFAULT_CONFIG,
    businessId:
      (d.businessId ?? DEFAULT_CONFIG.businessId).replace(/[^\w-]/g, '').slice(0, 64) || 'demo',
    businessName: d.businessName?.trim() || DEFAULT_CONFIG.businessName,
    color: d.color && HEX.test(d.color) ? d.color : DEFAULT_CONFIG.color,
    position,
    language: resolveLanguage(d.language ?? navigatorLanguage),
    greeting: d.greeting?.trim() || null,
    kbUrl: d.kbUrl ?? null,
    provider,
    endpoint: provider === 'http' ? (d.endpoint ?? null) : null,
    handoffEmail: email,
    handoffWhatsapp: whatsapp && whatsapp.length >= 8 ? whatsapp : null,
    threshold: Number.isFinite(threshold)
      ? Math.min(1, Math.max(0, threshold))
      : DEFAULT_CONFIG.threshold,
    autoOpen: bool(d.autoOpen) ?? false,
    quickReplies: (d.quickReplies ?? '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4),
  };
}

/** The embed snippet for a config (used by the playground). */
export function embedSnippet(config: WidgetConfig, scriptUrl: string): string {
  const attrs: [string, string | null][] = [
    ['data-business-id', config.businessId],
    ['data-business-name', config.businessName],
    ['data-color', config.color],
    ['data-position', config.position],
    ['data-language', config.language],
    ['data-greeting', config.greeting],
    ['data-kb-url', config.kbUrl],
    ['data-handoff-email', config.handoffEmail],
    ['data-handoff-whatsapp', config.handoffWhatsapp],
    ['data-quick-replies', config.quickReplies.join('|') || null],
  ];
  const escape = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  const lines = attrs
    .filter((a): a is [string, string] => Boolean(a[1]))
    .map(([k, v]) => `  ${k}="${escape(v)}"`);
  return `<script\n  src="${escape(scriptUrl)}"\n${lines.join('\n')}\n  defer\n></script>`;
}
