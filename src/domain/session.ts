import { type BinaryResponse, type Difficulty, type Domain, type FactItem } from './types'

const DAY_MS = 24 * 60 * 60 * 1000
const SESSION_SIZE = 10
const MAX_CONSECUTIVE_SAME_DOMAIN = 2
type DomainCount = { domain: Domain; count: number }

export type SessionTask = { kind: 'fact'; item: FactItem }

export interface SessionPlan {
  tasks: SessionTask[]
}

export interface SessionPreferences {
  minDifficulty: Difficulty
  enabledDomains: Domain[]
  includeWarmup: boolean
}

export interface SessionGeneratorInput {
  facts: FactItem[]
  binaryResponses: BinaryResponse[]
  now: Date
  preferences?: Partial<SessionPreferences>
  rng?: () => number
}

const DEFAULT_PREFERENCES: SessionPreferences = {
  minDifficulty: 3,
  enabledDomains: ['geography', 'history', 'science'],
  includeWarmup: false,
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

function pickUnique<T>(items: T[], n: number, rng: () => number): T[] {
  if (n <= 0) {
    return []
  }
  if (items.length <= n) {
    return shuffle(items, rng)
  }
  return shuffle(items, rng).slice(0, n)
}

function normalizePreferences(
  preferences?: Partial<SessionPreferences>,
): SessionPreferences {
  const minDifficulty = preferences?.minDifficulty ?? DEFAULT_PREFERENCES.minDifficulty
  return {
    minDifficulty,
    enabledDomains:
      preferences?.enabledDomains?.length !== 0
        ? [...(preferences?.enabledDomains ?? DEFAULT_PREFERENCES.enabledDomains)]
        : [...DEFAULT_PREFERENCES.enabledDomains],
    includeWarmup: preferences?.includeWarmup ?? DEFAULT_PREFERENCES.includeWarmup,
  }
}

function buildRecentItemIds(binaryResponses: BinaryResponse[], now: Date): Set<string> {
  const sinceIso = new Date(now.getTime() - 30 * DAY_MS).toISOString()
  return new Set(
    binaryResponses
      .filter((response) => response.createdAt >= sinceIso && response.itemType === 'fact')
      .map((response) => response.itemId),
  )
}

function isEligibleFact(item: FactItem, preferences: SessionPreferences): boolean {
  if (!preferences.enabledDomains.includes(item.domain)) {
    return false
  }
  if (!preferences.includeWarmup && item.isWarmup) {
    return false
  }
  if (item.difficulty < preferences.minDifficulty) {
    return false
  }
  return true
}

function arrangeFactsByDomain(facts: FactItem[], rng: () => number): FactItem[] {
  const buckets = new Map<Domain, FactItem[]>()
  for (const fact of facts) {
    const list = buckets.get(fact.domain) ?? []
    list.push(fact)
    buckets.set(fact.domain, list)
  }

  for (const [domain, list] of buckets.entries()) {
    buckets.set(domain, shuffle(list, rng))
  }

  const arranged: FactItem[] = []
  let previousDomain: Domain | null = null
  let runLength = 0

  while (buckets.size > 0) {
    const domains: DomainCount[] = Array.from(buckets.entries())
      .map(([domain, list]) => ({ domain, count: list.length }))
      .sort((a, b) => b.count - a.count)

    const blockedDomain: Domain | null =
      runLength >= MAX_CONSECUTIVE_SAME_DOMAIN ? previousDomain : null
    const candidates: DomainCount[] = domains.filter(
      (entry: DomainCount) => entry.domain !== blockedDomain,
    )
    const source: DomainCount[] = candidates.length > 0 ? candidates : domains
    const topCount = source[0]!.count
    const top: DomainCount[] = source.filter(
      (entry: DomainCount) => entry.count === topCount,
    )
    const chosenDomain: Domain = top[Math.floor(rng() * top.length)]!.domain
    const chosenList = buckets.get(chosenDomain)!
    const next = chosenList.pop()!

    arranged.push(next)

    if (chosenList.length === 0) {
      buckets.delete(chosenDomain)
    } else {
      buckets.set(chosenDomain, chosenList)
    }

    if (previousDomain === chosenDomain) {
      runLength += 1
    } else {
      previousDomain = chosenDomain
      runLength = 1
    }
  }

  return arranged
}

export function generateTodaySession({
  facts,
  binaryResponses,
  now,
  preferences,
  rng = Math.random,
}: SessionGeneratorInput): SessionPlan {
  const prefs = normalizePreferences(preferences)
  const eligibleFacts = facts.filter((item) => isEligibleFact(item, prefs))
  if (eligibleFacts.length < SESSION_SIZE) {
    throw new Error('Not enough eligible fact items for current settings')
  }

  const recentItemIds = buildRecentItemIds(binaryResponses, now)
  const withoutRecent = eligibleFacts.filter((item) => !recentItemIds.has(item.id))
  const sourcePool =
    withoutRecent.length >= SESSION_SIZE ? withoutRecent : eligibleFacts

  const selected = pickUnique(sourcePool, SESSION_SIZE, rng)

  return {
    tasks: arrangeFactsByDomain(selected, rng).map((item) => ({
      kind: 'fact',
      item,
    })),
  }
}
