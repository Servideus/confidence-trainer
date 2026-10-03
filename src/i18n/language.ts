export type Language = 'ru' | 'en'

export const SUPPORTED_LANGUAGES: Language[] = ['ru', 'en']

export function languageToLocale(language: Language): string {
  return language === 'ru' ? 'ru-RU' : 'en-US'
}
