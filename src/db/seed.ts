import type { FactItem } from '../domain/types'
import { getFactQuestionBank } from '../data/questionBank'
import { SUPPORTED_LANGUAGES, type Language } from '../i18n/language'
import type { ConfidenceTrainerDB } from './db'
import { db } from './db'

const QUESTION_BANK_SEED_KEY = 'seed:question-bank:v5'

function withLanguageTag(tags: string[], language: Language): string[] {
  const languageTag = `lang:${language}`
  return tags.includes(languageTag) ? tags : [...tags, languageTag]
}

function mapFactItems(language: Language): FactItem[] {
  return getFactQuestionBank(language).map((fact) => ({
    ...fact,
    type: 'fact',
    tags: withLanguageTag(fact.tags, language),
  }))
}

function allFactItems(): FactItem[] {
  return SUPPORTED_LANGUAGES.flatMap((language) => mapFactItems(language))
}

export async function seedQuestionBankIfNeeded(
  database: ConfidenceTrainerDB = db,
): Promise<boolean> {
  const existingSeed = await database.meta.get(QUESTION_BANK_SEED_KEY)
  if (existingSeed !== undefined) {
    return false
  }

  await database.transaction('rw', database.meta, database.factItems, async () => {
    await database.factItems.clear()
    await database.factItems.bulkPut(allFactItems())

    await database.meta.put({
      key: QUESTION_BANK_SEED_KEY,
      value: new Date().toISOString(),
    })
  })

  return true
}
