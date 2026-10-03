export type ItemType = 'fact' | 'forecast'

export type BinaryOutcome = 0 | 1
export type Difficulty = 1 | 2 | 3 | 4 | 5
export type Domain =
  | 'animals'
  | 'history'
  | 'geography'
  | 'science'
  | 'culture'
  | 'tech'
  | 'economy'

export const ALL_DOMAINS: Domain[] = [
  'animals',
  'history',
  'geography',
  'science',
  'culture',
  'tech',
  'economy',
]

export interface FactMeta {
  qid: string
  property: string
  trueValue: number
  threshold: number
  unit: string
  year?: number
  entityType?: string
  sitelinks?: number
}

export type FactKind = 'static' | 'threshold'

interface QuestionMetadata {
  difficulty: Difficulty
  domain: Domain
  isWarmup: boolean
  source?: string
}

export interface FactItem extends QuestionMetadata {
  id: string
  type: 'fact'
  prompt: string
  answer: BinaryOutcome
  tags: string[]
  factKind?: FactKind
  meta?: FactMeta
}

export interface ForecastItem {
  id: string
  type: 'forecast'
  prompt: string
  resolveAt: string
  tags: string[]
}

export type TrainingItem = FactItem | ForecastItem

export interface BinaryResponse {
  id: string
  itemId: string
  itemType: 'fact' | 'forecast'
  createdAt: string
  p: number
  outcome?: BinaryOutcome
  rationale?: string
}
