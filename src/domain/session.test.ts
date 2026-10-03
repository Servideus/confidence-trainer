import { describe, expect, it } from 'vitest'
import { generateTodaySession } from './session'
import type { BinaryResponse, Domain, FactItem } from './types'

const DOMAINS: Domain[] = [
  'animals',
  'history',
  'geography',
  'science',
  'culture',
  'tech',
  'economy',
]

function makeFacts(count: number): FactItem[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `fact-${index + 1}`,
    type: 'fact',
    prompt: `Fact ${index + 1}`,
    answer: index % 2 === 0 ? 1 : 0,
    tags: ['test'],
    difficulty: ((index % 3) + 3) as 3 | 4 | 5,
    domain: DOMAINS[index % DOMAINS.length]!,
    isWarmup: false,
    factKind: 'threshold',
    meta: {
      qid: `Q${index + 1}`,
      property: 'P1082',
      trueValue: 1000 + index,
      threshold: 900 + index,
      unit: 'people',
    },
  }))
}

function makeBinaryResponse(itemId: string, createdAt: string): BinaryResponse {
  return {
    id: `binary-${itemId}`,
    itemId,
    itemType: 'fact',
    createdAt,
    p: 0.7,
    outcome: 1,
  }
}

describe('generateTodaySession', () => {
  it('builds a 10-item fact-only session', () => {
    const session = generateTodaySession({
      facts: makeFacts(40),
      binaryResponses: [],
      now: new Date('2026-02-22T00:00:00.000Z'),
      rng: () => 0.42,
    })

    expect(session.tasks).toHaveLength(10)
    expect(session.tasks.every((task) => task.kind === 'fact')).toBe(true)
  })

  it('avoids recent fact ids from last 30 days when possible', () => {
    const now = new Date('2026-02-22T00:00:00.000Z')
    const facts = makeFacts(24)
    const binaryResponses: BinaryResponse[] = [
      makeBinaryResponse('fact-1', '2026-02-10T00:00:00.000Z'),
      makeBinaryResponse('fact-2', '2026-02-11T00:00:00.000Z'),
      makeBinaryResponse('fact-3', '2026-01-10T00:00:00.000Z'),
    ]

    const session = generateTodaySession({
      facts,
      binaryResponses,
      now,
      rng: () => 0.31,
    })

    const ids = session.tasks.map((task) => task.item.id)
    expect(ids).not.toContain('fact-1')
    expect(ids).not.toContain('fact-2')
    expect(ids).toContain('fact-3')
  })

  it('keeps domain runs at most 2 in a row', () => {
    const session = generateTodaySession({
      facts: makeFacts(48),
      binaryResponses: [],
      now: new Date('2026-02-22T00:00:00.000Z'),
      rng: () => 0.17,
    })

    let run = 1
    for (let i = 1; i < session.tasks.length; i += 1) {
      if (session.tasks[i - 1]!.item.domain === session.tasks[i]!.item.domain) {
        run += 1
      } else {
        run = 1
      }
      expect(run).toBeLessThanOrEqual(2)
    }
  })

  it('respects warmup=false by default', () => {
    const facts = makeFacts(30)
    facts[0] = { ...facts[0]!, id: 'fact-warmup', isWarmup: true, difficulty: 1 }

    const session = generateTodaySession({
      facts,
      binaryResponses: [],
      now: new Date('2026-02-22T00:00:00.000Z'),
      rng: () => 0.33,
    })

    expect(session.tasks.some((task) => task.item.id === 'fact-warmup')).toBe(false)
  })
})
