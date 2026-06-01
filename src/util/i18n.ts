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
  'menu.quiz': { en: 'Quiz', ru: 'Квиз' },
  'quiz.pick': { en: 'Pick a module to practice:', ru: 'Выбери модуль:' },
  'quiz.none': {
    en: 'No quiz content available yet.',
    ru: 'Контент для квиза ещё не готов.',
  },
  'quiz.started': { en: 'Quiz started! 10 questions.', ru: 'Квиз начат! 10 вопросов.' },
  'quiz.summary': { en: 'Done! Score: ', ru: 'Готово! Результат: ' },
  'quiz.missed': { en: 'Words to review:', ru: 'Слова на повтор:' },
  'quiz.again': { en: 'Practice again', ru: 'Ещё раз' },
  'quiz.pickAnother': { en: 'Pick another module', ru: 'Другой модуль' },
  'progress.title': { en: '📊 *Your progress*', ru: '📊 *Твой прогресс*' },
  'progress.empty': {
    en: 'No progress yet — tap ▶️ Practice to start!',
    ru: 'Пока нет прогресса — нажми ▶️ Практика!',
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
