import type {
  BinaryOutcome,
  BinaryResponse,
  FactItem,
} from '../domain/types'
import type { Language } from '../i18n/language'
import { db, type ForecastItemRecord } from './db'
import { seedQuestionBankIfNeeded } from './seed'

const DAY_MS = 24 * 60 * 60 * 1000

export interface ForecastWithResponse {
  forecast: ForecastItemRecord
  response: BinaryResponse
}

function createId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function ensureProbability(p: number): void {
  if (Number.isNaN(p) || p < 0 || p > 1) {
    throw new RangeError(`Probability must be in [0, 1]. Received: ${p}`)
  }
}

function ensureResolveAt(resolveAt: string): void {
  const parsed = Date.parse(resolveAt)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid resolveAt datetime: ${resolveAt}`)
  }
}

function hasLanguageTag(tags: string[], language: Language): boolean {
  return tags.includes(`lang:${language}`)
}

export async function initializeDatabase(): Promise<void> {
  await seedQuestionBankIfNeeded()
}

export async function getFactItems(language?: Language): Promise<FactItem[]> {
  const items = await db.factItems.toArray()
  if (language === undefined) {
    return items
  }
  return items.filter((item) => hasLanguageTag(item.tags, language))
}

export async function getBinaryResponses(): Promise<BinaryResponse[]> {
  return db.binaryResponses.orderBy('createdAt').toArray()
}

export async function getAnsweredItemIdsSince(days: number): Promise<Set<string>> {
  const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString()
  const binary = await db.binaryResponses.where('createdAt').aboveOrEqual(sinceIso).toArray()
  return new Set(binary.map((response) => response.itemId))
}

export async function createFactResponse(
  item: FactItem,
  p: number,
  rationale?: string,
): Promise<BinaryResponse> {
  ensureProbability(p)
  const response: BinaryResponse = {
    id: createId('binary'),
    itemId: item.id,
    itemType: 'fact',
    createdAt: new Date().toISOString(),
    p,
    outcome: item.answer,
    rationale,
  }

  await db.binaryResponses.add(response)
  return response
}

export async function createForecastPrediction(
  prompt: string,
  resolveAt: string,
  p: number,
  rationale?: string,
  tags: string[] = [],
): Promise<ForecastWithResponse> {
  ensureProbability(p)
  ensureResolveAt(resolveAt)
  if (prompt.trim().length === 0) {
    throw new Error('Forecast prompt cannot be empty')
  }

  const now = new Date().toISOString()
  const forecast: ForecastItemRecord = {
    id: createId('forecast'),
    type: 'forecast',
    prompt: prompt.trim(),
    resolveAt,
    tags,
    createdAt: now,
  }

  const response: BinaryResponse = {
    id: createId('binary'),
    itemId: forecast.id,
    itemType: 'forecast',
    createdAt: now,
    p,
    rationale,
  }

  await db.transaction('rw', db.forecastItems, db.binaryResponses, async () => {
    await db.forecastItems.add(forecast)
    await db.binaryResponses.add(response)
  })

  return { forecast, response }
}

export async function resolveForecast(
  responseId: string,
  outcome: BinaryOutcome,
  nowIso = new Date().toISOString(),
): Promise<BinaryResponse> {
  const response = await db.binaryResponses.get(responseId)
  if (response === undefined || response.itemType !== 'forecast') {
    throw new Error(`Forecast response not found: ${responseId}`)
  }
  if (response.outcome !== undefined) {
    throw new Error(`Forecast response already resolved: ${responseId}`)
  }

  const forecast = await db.forecastItems.get(response.itemId)
  if (forecast === undefined) {
    throw new Error(`Forecast item not found: ${response.itemId}`)
  }

  if (forecast.resolveAt > nowIso) {
    throw new Error('Cannot resolve forecast before resolveAt')
  }

  const updatedResponse: BinaryResponse = {
    ...response,
    outcome,
  }

  await db.transaction('rw', db.forecastItems, db.binaryResponses, async () => {
    await db.binaryResponses.put(updatedResponse)
    await db.forecastItems.put({
      ...forecast,
      outcome,
    })
  })

  return updatedResponse
}

export async function getForecastWithResponses(): Promise<ForecastWithResponse[]> {
  const forecastResponses = await db.binaryResponses
    .where('itemType')
    .equals('forecast')
    .toArray()

  const forecastIds = forecastResponses.map((response) => response.itemId)
  const forecasts = await db.forecastItems.bulkGet(forecastIds)
  const byId = new Map<string, ForecastItemRecord>()

  forecasts.forEach((forecast) => {
    if (forecast !== undefined) {
      byId.set(forecast.id, forecast)
    }
  })

  return forecastResponses
    .map((response) => {
      const forecast = byId.get(response.itemId)
      if (forecast === undefined) {
        return null
      }
      return { forecast, response }
    })
    .filter((entry): entry is ForecastWithResponse => entry !== null)
    .sort((a, b) => a.forecast.resolveAt.localeCompare(b.forecast.resolveAt))
}

export async function getActiveForecasts(nowIso = new Date().toISOString()): Promise<ForecastWithResponse[]> {
  const items = await getForecastWithResponses()
  return items.filter(
    (entry) => entry.response.outcome === undefined && entry.forecast.resolveAt >= nowIso,
  )
}

export async function getDueForecastsToResolve(
  nowIso = new Date().toISOString(),
): Promise<ForecastWithResponse[]> {
  const items = await getForecastWithResponses()
  return items.filter(
    (entry) => entry.response.outcome === undefined && entry.forecast.resolveAt <= nowIso,
  )
}

export async function getResponseById(
  responseId: string,
): Promise<BinaryResponse | undefined> {
  return db.binaryResponses.get(responseId)
}

export async function getFactItemById(itemId: string): Promise<FactItem | undefined> {
  return db.factItems.get(itemId)
}

export async function getForecastById(itemId: string): Promise<ForecastItemRecord | undefined> {
  return db.forecastItems.get(itemId)
}
