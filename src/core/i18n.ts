import type { Language } from './types';

const en = {
  launcherOpen: 'Open chat with {business}',
  launcherClose: 'Close chat',
  title: '{business}',
  subtitle: 'Typically replies instantly',
  greeting: 'Hi! I am the virtual assistant for {business}. How can I help you today?',
  inputPlaceholder: 'Type your question...',
  inputLabel: 'Your message',
  send: 'Send',
  typing: 'Assistant is typing',
  sources: 'Sources',
  fallback:
    "I'm not sure about that one, and I'd rather not guess. Would you like to talk to someone from our team?",
  talkToHuman: 'Talk to a human',
  handoffTitle: 'Talk to our team',
  handoffIntro: 'Leave your details and we will get back to you, or reach us directly.',
  handoffName: 'Name',
  handoffEmail: 'Email',
  handoffMessage: 'How can we help?',
  handoffSubmit: 'Send request',
  handoffSent: 'Thanks, {name}! Our team will contact you at {email} soon.',
  handoffInvalid: 'Please enter your name and a valid email address.',
  handoffEmailLink: 'Email us',
  handoffWhatsapp: 'WhatsApp',
  back: 'Back to chat',
  unread: '{count} unread messages',
  newMessage: 'New message from the assistant',
  clear: 'Start a new conversation',
  poweredBy: 'Powered by Concierge (demo)',
  error: 'Sorry, something went wrong. Please try again.',
} as const;

export type MessageKey = keyof typeof en;
type Dictionary = Record<MessageKey, string>;

const pt: Dictionary = {
  launcherOpen: 'Abrir chat com {business}',
  launcherClose: 'Fechar chat',
  title: '{business}',
  subtitle: 'Normalmente responde na hora',
  greeting: 'Olá! Sou o assistente virtual da {business}. Como posso ajudar?',
  inputPlaceholder: 'Digite sua pergunta...',
  inputLabel: 'Sua mensagem',
  send: 'Enviar',
  typing: 'O assistente está digitando',
  sources: 'Fontes',
  fallback:
    'Não tenho certeza sobre isso e prefiro não chutar. Quer falar com alguém da nossa equipe?',
  talkToHuman: 'Falar com uma pessoa',
  handoffTitle: 'Fale com a nossa equipe',
  handoffIntro: 'Deixe seus dados que retornamos em breve, ou fale direto conosco.',
  handoffName: 'Nome',
  handoffEmail: 'E-mail',
  handoffMessage: 'Como podemos ajudar?',
  handoffSubmit: 'Enviar pedido',
  handoffSent: 'Obrigado, {name}! Nossa equipe vai entrar em contato pelo e-mail {email}.',
  handoffInvalid: 'Informe seu nome e um e-mail válido.',
  handoffEmailLink: 'Enviar e-mail',
  handoffWhatsapp: 'WhatsApp',
  back: 'Voltar ao chat',
  unread: '{count} mensagens não lidas',
  newMessage: 'Nova mensagem do assistente',
  clear: 'Começar nova conversa',
  poweredBy: 'Feito com Concierge (demo)',
  error: 'Desculpe, algo deu errado. Tente novamente.',
};

const es: Dictionary = {
  launcherOpen: 'Abrir chat con {business}',
  launcherClose: 'Cerrar chat',
  title: '{business}',
  subtitle: 'Normalmente responde al instante',
  greeting: '¡Hola! Soy el asistente virtual de {business}. ¿En qué puedo ayudarte?',
  inputPlaceholder: 'Escribe tu pregunta...',
  inputLabel: 'Tu mensaje',
  send: 'Enviar',
  typing: 'El asistente está escribiendo',
  sources: 'Fuentes',
  fallback:
    'No estoy seguro de eso y prefiero no adivinar. ¿Quieres hablar con alguien de nuestro equipo?',
  talkToHuman: 'Hablar con una persona',
  handoffTitle: 'Habla con nuestro equipo',
  handoffIntro: 'Déjanos tus datos y te contactaremos, o escríbenos directamente.',
  handoffName: 'Nombre',
  handoffEmail: 'Correo electrónico',
  handoffMessage: '¿Cómo podemos ayudarte?',
  handoffSubmit: 'Enviar solicitud',
  handoffSent: '¡Gracias, {name}! Nuestro equipo te escribirá a {email} pronto.',
  handoffInvalid: 'Introduce tu nombre y un correo válido.',
  handoffEmailLink: 'Escríbenos',
  handoffWhatsapp: 'WhatsApp',
  back: 'Volver al chat',
  unread: '{count} mensajes sin leer',
  newMessage: 'Nuevo mensaje del asistente',
  clear: 'Empezar una nueva conversación',
  poweredBy: 'Con tecnología de Concierge (demo)',
  error: 'Lo siento, algo salió mal. Inténtalo de nuevo.',
};

/** European Portuguese (Portugal): "equipa", "telemóvel", "escreva", "contactar". */
const ptPT: Dictionary = {
  launcherOpen: 'Abrir conversa com {business}',
  launcherClose: 'Fechar conversa',
  title: '{business}',
  subtitle: 'Normalmente responde de imediato',
  greeting: 'Olá! Sou o assistente virtual da {business}. Em que posso ajudar?',
  inputPlaceholder: 'Escreva a sua pergunta...',
  inputLabel: 'A sua mensagem',
  send: 'Enviar',
  typing: 'O assistente está a escrever',
  sources: 'Fontes',
  fallback:
    'Não tenho a certeza sobre isso e prefiro não adivinhar. Quer falar com alguém da nossa equipa?',
  talkToHuman: 'Falar com uma pessoa',
  handoffTitle: 'Fale com a nossa equipa',
  handoffIntro: 'Deixe os seus dados e entraremos em contacto, ou fale connosco diretamente.',
  handoffName: 'Nome',
  handoffEmail: 'E-mail',
  handoffMessage: 'Como podemos ajudar?',
  handoffSubmit: 'Enviar pedido',
  handoffSent: 'Obrigado, {name}! A nossa equipa vai contactá-lo(a) através de {email} em breve.',
  handoffInvalid: 'Indique o seu nome e um e-mail válido.',
  handoffEmailLink: 'Enviar e-mail',
  handoffWhatsapp: 'WhatsApp',
  back: 'Voltar à conversa',
  unread: '{count} mensagens por ler',
  newMessage: 'Nova mensagem do assistente',
  clear: 'Começar nova conversa',
  poweredBy: 'Com tecnologia Concierge (demo)',
  error: 'Pedimos desculpa, algo correu mal. Tente novamente.',
};

export const DICTIONARIES: Record<Language, Dictionary> = { en, pt, 'pt-PT': ptPT, es };
export const LANGUAGES = Object.keys(DICTIONARIES) as Language[];

/** Translates a key, replacing {placeholders} with values. Unknown placeholders are kept. */
export function t(
  lang: Language,
  key: MessageKey,
  vars: Record<string, string | number> = {},
): string {
  const template = DICTIONARIES[lang][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/**
 * Picks a supported language from a BCP 47 tag, defaulting to English.
 * "pt-PT" / "pt_pt" -> European Portuguese; any other "pt-*" -> Brazilian Portuguese.
 */
export function resolveLanguage(tag: string | null | undefined): Language {
  const normalized = (tag ?? '').toLowerCase().replace('_', '-');
  if (normalized === 'pt-pt' || normalized.startsWith('pt-pt-')) return 'pt-PT';
  const base = normalized.split('-')[0] ?? '';
  return base === 'en' || base === 'pt' || base === 'es' ? base : 'en';
}
