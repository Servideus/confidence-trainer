import { describe, expect, it } from 'vitest'
import {
  getFactQuestionBank,
  getFactQuestionCountAllLanguages,
} from './questionBank'

describe('question bank quality', () => {
  it('contains at least 1000 generated threshold facts across ru/en', () => {
    expect(getFactQuestionCountAllLanguages()).toBeGreaterThanOrEqual(1000)
  })

  it('contains both threshold and static fact kinds', () => {
    for (const language of ['en', 'ru'] as const) {
      const facts = getFactQuestionBank(language)
      const thresholdFacts = facts.filter((item) => item.factKind === 'threshold')
      const staticFacts = facts.filter((item) => item.factKind === 'static')
      expect(thresholdFacts.length).toBeGreaterThan(0)
      expect(staticFacts.length).toBeGreaterThan(0)
    }
  })

  it('contains readable russian prompts without placeholder question marks', () => {
    const russianFacts = getFactQuestionBank('ru')
    expect(russianFacts.some((item) => item.prompt.includes('????'))).toBe(false)
  })

  it('contains cyrillic characters in russian prompts', () => {
    const russianFacts = getFactQuestionBank('ru')
    expect(russianFacts.some((item) => /[А-Яа-яЁё]/.test(item.prompt))).toBe(true)
  })

  it('keeps easy questions (difficulty 1-2) below 10%', () => {
    for (const language of ['en', 'ru'] as const) {
      const facts = getFactQuestionBank(language)
      const easyShare =
        facts.filter((item) => item.difficulty <= 2).length / facts.length
      expect(easyShare).toBeLessThanOrEqual(0.1)
    }
  })
})
