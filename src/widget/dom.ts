/** Minimal DOM helpers. Text always goes through textContent, never innerHTML. */

type Attrs = Record<string, string | boolean | number | null | undefined>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') el.className = String(value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    el.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return el;
}

const ICONS = {
  chat: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z',
  close: 'M6 6l12 12M18 6 6 18',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.4L21 8M21 3v5h-5',
} as const;

export function icon(name: keyof typeof ICONS): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICONS[name]);
  svg.append(path);
  return svg;
}

/** Only http(s), mailto and relative links are rendered as anchors. */
export function safeUrl(url: string | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (/^(https?:|mailto:)/i.test(trimmed) || /^[./#]/.test(trimmed)) return trimmed;
  if (/^[a-z][\w+.-]*:/i.test(trimmed)) return null; // javascript:, data:, etc.
  return trimmed;
}

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

export function focusables(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => !el.closest('[hidden]'),
  );
}

/** Readable text colour (black/white) for a given #rrggbb background. */
export function contrastInk(hex: string): string {
  let h6 = hex.replace('#', '');
  if (h6.length === 3) h6 = h6.replace(/./g, (c) => c + c);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h6.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return luminance > 0.4 ? '#0f172a' : '#ffffff';
}
