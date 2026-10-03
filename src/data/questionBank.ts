import type { Difficulty, Domain, FactKind, FactMeta } from '../domain/types'
import type { Language } from '../i18n/language'
import generatedFactsJson from './generated/facts_wikidata.json'

const MIN_GENERATED_FACTS_PER_LANGUAGE = 500

export interface FactSeedItem {
  id: string
  prompt: string
  answer: 0 | 1
  tags: string[]
  difficulty: Difficulty
  domain: Domain
  isWarmup: boolean
  source?: string
  factKind?: FactKind
  meta?: FactMeta
}

interface PromptByLanguage {
  ru: string
  en: string
}

interface GeneratedFactSeedItem {
  id: string
  prompt: PromptByLanguage
  answer: 0 | 1
  tags?: string[]
  difficulty: Difficulty
  domain: Domain
  isWarmup?: boolean
  source?: string
  factKind?: FactKind
  meta?: {
    qid: string
    property: string
    trueValue: number
    threshold: number
    unit: string
    year?: number
    entityType?: string
    sitelinks?: number
  }
}

interface QuestionBank {
  facts: FactSeedItem[]
}

function assertStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((part) => typeof part === 'string')
}

function isDomain(value: unknown): value is Domain {
  return (
    value === 'animals' ||
    value === 'history' ||
    value === 'geography' ||
    value === 'science' ||
    value === 'culture' ||
    value === 'tech' ||
    value === 'economy'
  )
}

function toDifficulty(value: number | undefined, fallback: Difficulty): Difficulty {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value
  }
  return fallback
}

function normalizePrompt(prompt: PromptByLanguage, language: Language, id: string): string {
  const primary = language === 'ru' ? prompt.ru : prompt.en
  const fallback = language === 'ru' ? prompt.en : prompt.ru
  const text = (primary ?? fallback ?? '').trim()
  if (text.length === 0) {
    throw new Error(`Generated fact is missing prompt text: ${id}`)
  }
  return text
}

function normalizeMeta(meta: GeneratedFactSeedItem['meta']): FactMeta | undefined {
  if (meta === undefined) {
    return undefined
  }
  if (
    typeof meta.qid !== 'string' ||
    !/^Q\d+$/.test(meta.qid) ||
    typeof meta.property !== 'string' ||
    !/^P\d+$/.test(meta.property) ||
    typeof meta.trueValue !== 'number' ||
    !Number.isFinite(meta.trueValue) ||
    typeof meta.threshold !== 'number' ||
    !Number.isFinite(meta.threshold) ||
    typeof meta.unit !== 'string' ||
    meta.unit.trim().length === 0
  ) {
    throw new Error('Invalid fact meta payload in generated facts')
  }
  return {
    qid: meta.qid,
    property: meta.property,
    trueValue: meta.trueValue,
    threshold: meta.threshold,
    unit: meta.unit.trim(),
    year: meta.year,
    entityType:
      typeof meta.entityType === 'string' && /^Q\d+$/.test(meta.entityType)
        ? meta.entityType
        : undefined,
    sitelinks:
      typeof meta.sitelinks === 'number' && Number.isFinite(meta.sitelinks)
        ? meta.sitelinks
        : undefined,
  }
}

function normalizeGeneratedFact(
  item: GeneratedFactSeedItem,
  language: Language,
): FactSeedItem {
  if (typeof item.id !== 'string' || item.id.trim().length === 0) {
    throw new Error('Generated fact id must be non-empty')
  }
  if (!isDomain(item.domain)) {
    throw new Error(`Generated fact has invalid domain: ${item.id}`)
  }
  if (item.answer !== 0 && item.answer !== 1) {
    throw new Error(`Generated fact has invalid answer: ${item.id}`)
  }

  const tags = assertStringArray(item.tags) ? item.tags : []
  const normalizedTags = tags.length === 0 ? ['generated', 'wikidata'] : tags

  return {
    id: `${item.id}-${language}`,
    prompt: normalizePrompt(item.prompt, language, item.id),
    answer: item.answer,
    tags: normalizedTags,
    difficulty: toDifficulty(item.difficulty, 3),
    domain: item.domain,
    isWarmup: item.isWarmup ?? false,
    source: item.source,
    factKind: item.factKind ?? (item.meta === undefined ? 'static' : 'threshold'),
    meta: normalizeMeta(item.meta),
  }
}

function validateFactItem(item: FactSeedItem): void {
  if (item.id.trim().length === 0) {
    throw new Error('Fact item id must be a non-empty string')
  }
  if (item.prompt.trim().length === 0) {
    throw new Error(`Fact item prompt must be non-empty: ${item.id}`)
  }
  if (item.answer !== 0 && item.answer !== 1) {
    throw new Error(`Fact item answer must be 0 or 1: ${item.id}`)
  }
  if (!assertStringArray(item.tags)) {
    throw new Error(`Fact item tags must be string[]: ${item.id}`)
  }
  if (item.factKind === 'threshold' && item.meta === undefined) {
    throw new Error(`Threshold fact must include meta: ${item.id}`)
  }
}

function validateQuestionBank(facts: FactSeedItem[], bankName: string): QuestionBank {
  const seen = new Set<string>()
  for (const fact of facts) {
    validateFactItem(fact)
    if (seen.has(fact.id)) {
      throw new Error(`Duplicate id in ${bankName}: ${fact.id}`)
    }
    seen.add(fact.id)
  }
  return { facts }
}

function buildQuestionBank(language: Language): QuestionBank {
  const generatedFacts = (generatedFactsJson as GeneratedFactSeedItem[]).map((item) =>
    normalizeGeneratedFact(item, language),
  )

  if (generatedFacts.length < MIN_GENERATED_FACTS_PER_LANGUAGE) {
    throw new Error(
      `Generated fact bank is too small for ${language}: ${generatedFacts.length} (min ${MIN_GENERATED_FACTS_PER_LANGUAGE})`,
    )
  }

  return validateQuestionBank(generatedFacts, 'facts_wikidata.json')
}

const validatedByLanguage: Record<Language, QuestionBank> = {
  en: buildQuestionBank('en'),
  ru: buildQuestionBank('ru'),
}

export function getFactQuestionBank(language: Language): FactSeedItem[] {
  return validatedByLanguage[language].facts
}

export function getFactQuestionCountAllLanguages(): number {
  return validatedByLanguage.en.facts.length + validatedByLanguage.ru.facts.length
}
