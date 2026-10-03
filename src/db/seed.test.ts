import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getFactQuestionCountAllLanguages } from '../data/questionBank'
import { ConfidenceTrainerDB } from './db'
import { seedQuestionBankIfNeeded } from './seed'

let testDb: ConfidenceTrainerDB

describe('seedQuestionBankIfNeeded', () => {
  beforeEach(() => {
    testDb = new ConfidenceTrainerDB(`confidence-trainer-test-${crypto.randomUUID()}`)
  })

  afterEach(async () => {
    await testDb.delete()
  })

  it('seeds fact question bank only once', async () => {
    const seededFirstTime = await seedQuestionBankIfNeeded(testDb)
    const seededSecondTime = await seedQuestionBankIfNeeded(testDb)

    const factCount = await testDb.factItems.count()

    expect(seededFirstTime).toBe(true)
    expect(seededSecondTime).toBe(false)
    expect(factCount).toBe(getFactQuestionCountAllLanguages())
  })
})
