import type { BinaryResponse } from './types'

export interface CalibrationBin {
  binStart: number
  binEnd: number
  n: number
  meanP: number
  empirical: number
}

export interface ConfidenceBucket {
  pBucket: number
  n: number
}

function assertProbability(p: number): void {
  if (Number.isNaN(p) || p < 0 || p > 1) {
    throw new RangeError(`Probability must be in [0, 1]. Received: ${p}`)
  }
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

export function brier(p: number, outcome: 0 | 1): number {
  assertProbability(p)
  return (p - outcome) ** 2
}

export function meanBrier(responses: BinaryResponse[]): number | null {
  const scored = responses.filter((response) => response.outcome !== undefined)
  if (scored.length === 0) {
    return null
  }

  const scores = scored.map((response) => brier(response.p, response.outcome as 0 | 1))
  return mean(scores)
}

export function binIndex(p: number, binSize = 0.1): number {
  assertProbability(p)
  if (binSize <= 0 || binSize > 1) {
    throw new RangeError(`binSize must be in (0, 1]. Received: ${binSize}`)
  }

  const binsCount = Math.round(1 / binSize)
  return Math.min(Math.floor(p / binSize), binsCount - 1)
}

export function calibrationBins(
  responses: BinaryResponse[],
  binSize = 0.1,
): CalibrationBin[] {
  if (binSize <= 0 || binSize > 1) {
    throw new RangeError(`binSize must be in (0, 1]. Received: ${binSize}`)
  }

  const binsCount = Math.round(1 / binSize)
  const resolved = responses.filter((response) => response.outcome !== undefined)

  return Array.from({ length: binsCount }, (_, index) => {
    const start = Number((index * binSize).toFixed(10))
    const end =
      index === binsCount - 1
        ? 1
        : Number(((index + 1) * binSize).toFixed(10))
    const items = resolved.filter(
      (response) => binIndex(response.p, binSize) === index,
    )

    return {
      binStart: start,
      binEnd: end,
      n: items.length,
      meanP: items.length === 0 ? 0 : mean(items.map((item) => item.p)),
      empirical:
        items.length === 0
          ? 0
          : mean(items.map((item) => item.outcome as 0 | 1)),
    }
  })
}

export function confidenceHistogram(
  responses: BinaryResponse[],
  bucketSize = 0.1,
): ConfidenceBucket[] {
  if (bucketSize <= 0 || bucketSize > 1) {
    throw new RangeError(`bucketSize must be in (0, 1]. Received: ${bucketSize}`)
  }

  const bucketsCount = Math.round(1 / bucketSize)

  return Array.from({ length: bucketsCount }, (_, index) => {
    const bucketStart = Number((index * bucketSize).toFixed(10))
    const n = responses.filter(
      (response) => binIndex(response.p, bucketSize) === index,
    ).length

    return {
      pBucket: bucketStart,
      n,
    }
  })
}
