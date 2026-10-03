import { createContext } from 'react'
import { copyByLanguage } from './copy'
import type { Language } from './language'

export interface I18nValue {
  language: Language
  setLanguage: (language: Language) => void
  locale: string
  copy: (typeof copyByLanguage)[Language]
}

export const I18nContext = createContext<I18nValue | undefined>(undefined)
