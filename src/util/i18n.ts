type Locale = 'en' | 'ru';

const strings = {
  'start.welcome': {
    en: 'Welcome! I help you learn Indonesian by chatting. /menu for options.',
    ru: 'Привет! Я помогаю учить индонезийский через диалоги. /menu — варианты.',
  },
  'menu.title': {
    en: '*Menu*\nChoose what you want to do:',
    ru: '*Меню*\nВыбери, что хочешь сделать:',
  },
  'menu.scenarios': { en: 'Scenarios', ru: 'Сценарии' },
  'menu.lang': { en: 'Language', ru: 'Язык' },
  'menu.subscribe': { en: 'Subscribe', ru: 'Подписка' },
  'menu.help': { en: 'Help', ru: 'Помощь' },
  'lang.picked.en': { en: 'Interface language: English', ru: 'Interface language: English' },
  'lang.picked.ru': { en: 'Язык интерфейса: русский', ru: 'Язык интерфейса: русский' },
  'lang.prompt': {
    en: 'Pick interface language:',
    ru: 'Выбери язык интерфейса:',
  },
  'error.generic': {
    en: '⚠️ Something went wrong. Try again in a moment.',
    ru: '⚠️ Что-то пошло не так. Попробуй через минуту.',
  },
} as const;

export type StringKey = keyof typeof strings;

export function t(key: StringKey, en: boolean): string {
  const entry = strings[key];
  const locale: Locale = en ? 'en' : 'ru';
  return entry[locale] || entry.en;
}

export function isEn(locale: string | undefined): boolean {
  return locale !== 'ru';
}
