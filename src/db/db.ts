import Dexie, { type Table } from 'dexie'
import type {
  BinaryOutcome,
  BinaryResponse,
  FactItem,
  ForecastItem,
} from '../domain/types'

export interface MetaEntry {
  key: string
  value: string
}

export interface ForecastItemRecord extends ForecastItem {
  createdAt: string
  outcome?: BinaryOutcome
}

export class ConfidenceTrainerDB extends Dexie {
  factItems!: Table<FactItem, string>
  forecastItems!: Table<ForecastItemRecord, string>
  binaryResponses!: Table<BinaryResponse, string>
  meta!: Table<MetaEntry, string>

  constructor(name = 'confidence-trainer-db') {
    super(name)

    this.version(1).stores({
      factItems: 'id',
      intervalItems: 'id',
      forecastItems: 'id, resolveAt, outcome',
      binaryResponses: 'id, createdAt, itemId, outcome',
      intervalResponses: 'id, createdAt, itemId, level',
      meta: 'key',
    })

    this.version(2).stores({
      factItems: 'id',
      intervalItems: 'id',
      forecastItems: 'id, resolveAt, createdAt, outcome',
      binaryResponses:
        'id, createdAt, itemId, itemType, outcome, [itemType+createdAt], [itemType+outcome]',
      intervalResponses: 'id, createdAt, itemId, level',
      meta: 'key',
    })

    this.version(3).stores({
      factItems: 'id, difficulty, domain, isWarmup',
      intervalItems: 'id, difficulty, domain, isWarmup',
      forecastItems: 'id, resolveAt, createdAt, outcome',
      binaryResponses:
        'id, createdAt, itemId, itemType, outcome, [itemType+createdAt], [itemType+outcome]',
      intervalResponses: 'id, createdAt, itemId, level',
      meta: 'key',
    })

    // v4 is binary-only: interval tables are deleted from schema.
    this.version(4).stores({
      factItems: 'id, difficulty, domain, isWarmup',
      intervalItems: null,
      forecastItems: 'id, resolveAt, createdAt, outcome',
      binaryResponses:
        'id, createdAt, itemId, itemType, outcome, [itemType+createdAt], [itemType+outcome]',
      intervalResponses: null,
      meta: 'key',
    })
  }
}

export const db = new ConfidenceTrainerDB()
