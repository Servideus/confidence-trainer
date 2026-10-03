import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { copyByLanguage } from './copy'
import { I18nContext, type I18nValue } from './context'
import type { Language } from './language'
import { SUPPORTED_LANGUAGES, languageToLocale } from './language'

const STORAGE_KEY = 'confidence-trainer:language'

function isSupportedLanguage(value: string): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language)
}

function detectInitialLanguage(): Language {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null && isSupportedLanguage(stored)) {
    return stored
  }

  const browserLanguage = navigator.language.toLowerCase()
  if (browserLanguage.startsWith('ru')) {
    return 'ru'
  }
  return 'en'
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(detectInitialLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const value = useMemo<I18nValue>(
    () => ({
      language,
      setLanguage,
      locale: languageToLocale(language),
      copy: copyByLanguage[language],
    }),
    [language],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
