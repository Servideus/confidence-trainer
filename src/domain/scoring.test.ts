import { describe, expect, it } from 'vitest'
import { binIndex, brier, calibrationBins, meanBrier } from './scoring'
import type { BinaryResponse } from './types'

function makeBinaryResponse(
  id: string,
  p: number,
  outcome: 0 | 1 | undefined,
): BinaryResponse {
  return {
    id,
    itemId: `item-${id}`,
    itemType: 'fact',
    createdAt: '2026-01-01T00:00:00.000Z',
    p,
    outcome,
  }
}

describe('brier', () => {
  it('returns 0 for perfect prediction', () => {
    expect(brier(1, 1)).toBe(0)
  })

  it('returns 1 for completely wrong prediction', () => {
    expect(brier(0, 1)).toBe(1)
  })

  it('returns 0.25 for p=0.5 and outcome=1', () => {
    expect(brier(0.5, 1)).toBe(0.25)
  })
})

describe('meanBrier', () => {
  it('ignores unresolved responses', () => {
    const responses: BinaryResponse[] = [
      makeBinaryResponse('1', 1, 1),
      makeBinaryResponse('2', 0.5, undefined),
      makeBinaryResponse('3', 0.2, 0),
    ]

    expect(meanBrier(responses)).toBeCloseTo((0 + 0.04) / 2)
  })

  it('returns null when no resolved responses', () => {
    const responses: BinaryResponse[] = [makeBinaryResponse('1', 0.3, undefined)]
    expect(meanBrier(responses)).toBeNull()
  })
})

describe('binIndex', () => {
  it('maps probabilities to deciles 0..9', () => {
    expect(binIndex(0)).toBe(0)
    expect(binIndex(0.09)).toBe(0)
    expect(binIndex(0.1)).toBe(1)
    expect(binIndex(0.95)).toBe(9)
    expect(binIndex(1)).toBe(9)
  })
})

describe('calibrationBins', () => {
  it('aggregates n, meanP and empirical by bin', () => {
    const responses: BinaryResponse[] = [
      makeBinaryResponse('1', 0.12, 0),
      makeBinaryResponse('2', 0.18, 1),
      makeBinaryResponse('3', 0.74, 1),
      makeBinaryResponse('4', 0.78, 1),
      makeBinaryResponse('5', 0.78, undefined),
    ]

    const bins = calibrationBins(responses)
    const bin10to20 = bins[1]
    const bin70to80 = bins[7]

    expect(bin10to20.n).toBe(2)
    expect(bin10to20.meanP).toBeCloseTo(0.15)
    expect(bin10to20.empirical).toBeCloseTo(0.5)

    expect(bin70to80.n).toBe(2)
    expect(bin70to80.meanP).toBeCloseTo(0.76)
    expect(bin70to80.empirical).toBeCloseTo(1)
  })
})
