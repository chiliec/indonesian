type Locale = 'en' | 'ru';

const strings = {
  'start.welcome': {
    en: 'Welcome! I help you learn Indonesian. Tap ▶️ Practice to begin, or 🎭 Scenarios to chat.',
    ru: 'Привет! Помогаю учить индонезийский. Жми ▶️ Практика или 🎭 Сценарии.',
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
  'quiz.pick': { en: 'Pick a module to practice:', ru: 'Выбери модуль:' },
  'quiz.none': {
    en: 'No quiz content available yet.',
    ru: 'Контент для квиза ещё не готов.',
  },
  'progress.title': { en: '📊 *Your progress*', ru: '📊 *Твой прогресс*' },
  'progress.empty': {
    en: 'No progress yet — tap ▶️ Practice to start!',
    ru: 'Пока нет прогресса — нажми ▶️ Практика!',
  },
  'settings.title': { en: '⚙️ *Settings*', ru: '⚙️ *Настройки*' },
  'settings.lang': { en: '🌐 Language', ru: '🌐 Язык' },
  'settings.subscribe': { en: '⭐ Subscribe', ru: '⭐ Подписка' },
  'settings.modules': { en: '🎯 Pick a module', ru: '🎯 Выбрать модуль' },
  'settings.help': { en: '❓ Help', ru: '❓ Помощь' },
  'settings.helpText': {
    en: 'Tap ▶️ Practice for vocabulary drills, 🎭 Scenarios to roleplay in Indonesian. 📊 Progress shows your mastery. That\'s it — no commands to remember!',
    ru: 'Жми ▶️ Практика для тренировки слов, 🎭 Сценарии — ролевые диалоги. 📊 Прогресс — твоё мастерство. Всё — команды не нужны!',
  },
  'session.correct': { en: '✅ Benar!', ru: '✅ Benar!' },
  'session.almost': { en: '✅ Almost — correct spelling:', ru: '✅ Почти — правильно пишется:' },
  'session.wrong': { en: '❌ Not quite. Correct answer:', ru: '❌ Не совсем. Правильный ответ:' },
  'session.next': { en: '▶️ Next', ru: '▶️ Дальше' },
  'session.undo': { en: '↩️ Undo', ru: '↩️ Отмена' },
  'session.soFar': { en: 'So far:', ru: 'Пока:' },
  'session.done': { en: '🏁 Session done!', ru: '🏁 Сессия завершена!' },
  'session.review': { en: 'Words to review:', ru: 'Слова на повтор:' },
  'session.again': { en: '▶️ Practice again', ru: '▶️ Ещё раз' },
  'session.expired': { en: '⌛ Session expired.', ru: '⌛ Сессия истекла.' },
  'session.expiredToast': {
    en: 'Session expired — tap ▶️ Practice',
    ru: 'Сессия истекла — жми ▶️ Практика',
  },
  'settings.speakOn': { en: '🎤 Speaking: ON', ru: '🎤 Голос: ВКЛ' },
  'settings.speakOff': { en: '🎤 Speaking: OFF', ru: '🎤 Голос: ВЫКЛ' },
  'settings.length': { en: '🔢 Session length: ', ru: '🔢 Длина сессии: ' },
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
