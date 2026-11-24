/** Text normalization for retrieval: accent folding, tokenizing, stop words and light stemming. */

// Small multilingual stop-word list (EN/PT/ES): words that carry no meaning for matching.
const STOP_WORDS = new Set(
  `a an and are as at be by can could do does did for from has have how i if in is it me my of on
  or our please should so that the their them there these this to us was we what when where which
  who why will with would you your yours about any get much many want need tell know
  o os as um uma uns umas e de do da dos das no na nos nas em para por com que qual quais como
  quando onde voce voces vcs eu meu minha seu sua tem ter ser sao foi pode posso gostaria quero
  preciso se nao sim mais muito ao aos
  el la los las un una unos unas y del al en por para con que cual cuales como cuando donde
  usted ustedes tu yo mi su tiene tener es son fue puede puedo quiero necesito si no mas muy hay`
    .split(/\s+/)
    .filter(Boolean),
);

/** Lowercases and strips diacritics: "Implantação" -> "implantacao". */
export function fold(text: string): string {
  // After NFD, accents are separate combining marks (Unicode category Mn); drop them.
  return text
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')
    .toLowerCase();
}

/** Very light suffix stripping that is safe across EN/PT/ES ("cleanings" -> "cleaning"). */
export function stem(token: string): string {
  if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
  if (token.length > 4 && /(oes|aes)$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

export function tokenize(text: string, { keepStopWords = false } = {}): string[] {
  return fold(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 1 || /\d/.test(t))
    .filter((t) => keepStopWords || !STOP_WORDS.has(t))
    .map(stem);
}

export function isStopWord(word: string): boolean {
  return STOP_WORDS.has(fold(word));
}
