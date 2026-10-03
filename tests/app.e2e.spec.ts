import { expect, test, type Page } from '@playwright/test'

const text = {
  lockInAnswer: /Submit/i,
  next: /Next/i,
  taskFact: /Fact/i,
  probability: /Probability/i,
  brierError: /Brier error/i,
  addForecast: /Add forecast/i,
  resolveAt: /Resolve at/i,
  prompt: /Prompt/i,
  resolveYes: /Resolve Yes/i,
  resolvedForecasts: /Resolved forecasts/i,
  outcomeValueYes: /Outcome:\s*Yes/i,
}

test.use({ locale: 'en-US', timezoneId: 'UTC' })

function looksLikeTrivialNumericComparison(prompt: string): boolean {
  const en = /^\s*(?:the number\s+)?\d+(?:[.,]\d+)?\s*(?:is\s+)?(?:greater than|less than|>|<)\s*\d+(?:[.,]\d+)?\b/i
  const ru = /^\s*\d+(?:[.,]\d+)?\s*(?:Р±РѕР»СЊС€Рµ|РјРµРЅСЊС€Рµ|>|<)\s*\d+(?:[.,]\d+)?\b/i
  return en.test(prompt) || ru.test(prompt)
}

async function currentTaskHeading(page: Page): Promise<string> {
  const heading = page
    .locator('section.panel h2')
    .filter({ hasText: text.taskFact })
    .first()
  await expect(heading).toBeVisible()
  return (await heading.textContent()) ?? ''
}

async function answerCurrentTask(page: Page, probability = 73): Promise<void> {
  await currentTaskHeading(page)
  await page.getByRole('spinbutton', { name: text.probability }).first().fill(String(probability))
  await page.getByRole('button', { name: text.lockInAnswer }).click()
  await expect(page.getByRole('button', { name: text.next })).toBeVisible()
}

test('today flow can submit a fact answer and show Brier result', async ({ page }) => {
  await page.goto('/today')
  await currentTaskHeading(page)
  await page.screenshot({ path: 'test-results/today.png', fullPage: true })
  await answerCurrentTask(page, 88)

  await expect(page.getByText(text.brierError)).toBeVisible()
  await expect(page.getByRole('button', { name: text.next })).toBeVisible()
})

test('today session has 10 fact tasks and no trivial numeric comparisons', async ({ page }) => {
  await page.goto('/today')

  for (let i = 0; i < 10; i += 1) {
    await currentTaskHeading(page)
    const prompt = (await page.locator('section.panel p').first().textContent()) ?? ''
    expect(looksLikeTrivialNumericComparison(prompt)).toBe(false)

    await answerCurrentTask(page, 60)
    if (i < 9) {
      await page.getByRole('button', { name: text.next }).click()
    }
  }
})

test('forecast can be created and resolved from forecasts page', async ({ page }) => {
  await page.goto('/forecasts')

  const prompt = 'Test forecast should resolve immediately'
  const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

  await page.getByLabel(text.prompt).fill(prompt)
  await page.getByLabel(text.resolveAt).fill(pastDate)
  await expect(page.getByLabel(text.resolveAt)).toHaveValue(pastDate)
  await page.getByRole('spinbutton', { name: text.probability }).first().fill('61')
  await expect(page.getByLabel(text.resolveAt)).toHaveValue(pastDate)
  await page.getByRole('button', { name: text.addForecast }).click()

  // Wait for the saved list entry, not the still-filled textarea during saving.
  await expect(page.locator('li').filter({ hasText: prompt })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: text.resolveYes }).first()).toBeVisible()
  await page.getByRole('button', { name: text.resolveYes }).first().click()

  await expect(page.getByRole('heading', { name: text.resolvedForecasts })).toBeVisible()
  await expect(page.getByText(text.outcomeValueYes)).toBeVisible()
})


test('production PWA reloads and accepts an answer offline', async ({ page, context }) => {
  await page.goto('/today')
  await page.evaluate(async () => { await navigator.serviceWorker.ready })
  await page.reload()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null)
  await context.setOffline(true)
  await page.reload()
  await answerCurrentTask(page, 75)
  await expect(page.getByText(text.brierError)).toBeVisible()
  await page.screenshot({ path: 'test-results/offline-result.png', fullPage: true })
})

test('language choice survives reload', async ({ page }) => {
  await page.goto('/forecasts')
  await page.getByRole('button', { name: 'RU', exact: true }).click()
  await expect(page.getByLabel('Формулировка', { exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Формулировка', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'EN', exact: true }).click()
  await expect(page.getByLabel('Prompt', { exact: true })).toBeVisible()
})
