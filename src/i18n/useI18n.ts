import { useContext } from 'react'
import { I18nContext, type I18nValue } from './context'

export function useI18n(): I18nValue {
  const context = useContext(I18nContext)
  if (context === undefined) {
    throw new Error('useI18n must be used within I18nProvider')
  }
  return context
}
