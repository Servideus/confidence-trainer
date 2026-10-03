import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ForecastWithResponse } from '../db/repository'
import {
  createForecastPrediction,
  getForecastWithResponses,
  initializeDatabase,
  resolveForecast,
} from '../db/repository'
import { useI18n } from '../i18n/useI18n'
import { dateFromDateTimeLocal, formatDateTime, toDateTimeLocalValue } from '../utils/date'

function defaultResolveDate(): string {
  const date = new Date()
  date.setDate(date.getDate() + 7)
  return toDateTimeLocalValue(date)
}

export function ForecastsPage() {
  const { copy, locale } = useI18n()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entries, setEntries] = useState<ForecastWithResponse[]>([])

  const [prompt, setPrompt] = useState('')
  const [resolveAt, setResolveAt] = useState(defaultResolveDate())
  const [probabilityPercent, setProbabilityPercent] = useState(50)
  const [rationale, setRationale] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await initializeDatabase()
      const rows = await getForecastWithResponses()
      setEntries(rows)
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.forecasts.errorLoad
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [copy.forecasts.errorLoad])

  useEffect(() => {
    void load()
  }, [load])

  const unresolved = useMemo(
    () => entries.filter((entry) => entry.response.outcome === undefined),
    [entries],
  )
  const resolved = useMemo(
    () => entries.filter((entry) => entry.response.outcome !== undefined),
    [entries],
  )

  async function handleCreate(): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      const parsed = dateFromDateTimeLocal(resolveAt)
      if (prompt.trim().length === 0) {
        throw new Error(copy.forecasts.errorPromptEmpty)
      }
      if (parsed === null) {
        throw new Error(copy.forecasts.errorResolveDateInvalid)
      }

      await createForecastPrediction(
        prompt.trim(),
        parsed.toISOString(),
        probabilityPercent / 100,
        rationale.trim().length > 0 ? rationale.trim() : undefined,
      )

      setPrompt('')
      setResolveAt(defaultResolveDate())
      setProbabilityPercent(50)
      setRationale('')
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.forecasts.errorCreate
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve(responseId: string, outcome: 0 | 1): Promise<void> {
    setSaving(true)
    setError(null)
    try {
      await resolveForecast(responseId, outcome)
      await load()
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.forecasts.errorResolve
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p>{copy.forecasts.loading}</p>
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1>{copy.forecasts.title}</h1>
        {error && <p className="error">{error}</p>}
        <label>
          {copy.forecasts.promptLabel}
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            maxLength={200}
            placeholder={copy.forecasts.promptPlaceholder}
          />
        </label>
        <label>
          {copy.forecasts.resolveAtLabel}
          <input
            type="datetime-local"
            value={resolveAt}
            onChange={(event) => setResolveAt(event.target.value)}
          />
        </label>
        <label>
          {copy.forecasts.probabilityLabel}
          <input
            type="number"
            min={0}
            max={100}
            value={probabilityPercent}
            onChange={(event) => setProbabilityPercent(Number(event.target.value))}
          />
        </label>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={probabilityPercent}
          onChange={(event) => setProbabilityPercent(Number(event.target.value))}
        />
        <label>
          {copy.forecasts.rationaleLabel}
          <textarea
            value={rationale}
            onChange={(event) => setRationale(event.target.value.slice(0, 200))}
            maxLength={200}
          />
        </label>
        <button onClick={() => void handleCreate()} disabled={saving}>
          {saving ? copy.forecasts.savingButton : copy.forecasts.addButton}
        </button>
      </section>

      <section className="panel">
        <h2>{copy.forecasts.activeTitle}</h2>
        {unresolved.length === 0 ? (
          <p>{copy.forecasts.noActive}</p>
        ) : (
          <ul className="list">
            {unresolved.map((entry) => {
              const canResolve = entry.forecast.resolveAt <= new Date().toISOString()
              return (
                <li key={entry.response.id} className="list-item">
                  <p>
                    <strong>{entry.forecast.prompt}</strong>
                  </p>
                  <p>p={Math.round(entry.response.p * 100)}%</p>
                  <p>
                    {copy.forecasts.resolveAt}:{' '}
                    {formatDateTime(entry.forecast.resolveAt, locale)}
                  </p>
                  {canResolve ? (
                    <div className="row">
                      <button
                        disabled={saving}
                        onClick={() => void handleResolve(entry.response.id, 1)}
                      >
                        {copy.forecasts.resolveYes}
                      </button>
                      <button
                        disabled={saving}
                        onClick={() => void handleResolve(entry.response.id, 0)}
                      >
                        {copy.forecasts.resolveNo}
                      </button>
                    </div>
                  ) : (
                    <p>{copy.forecasts.resolutionAvailableAfter}</p>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2>{copy.forecasts.resolvedTitle}</h2>
        {resolved.length === 0 ? (
          <p>{copy.forecasts.noResolved}</p>
        ) : (
          <ul className="list">
            {resolved.map((entry) => (
              <li key={entry.response.id} className="list-item">
                <p>
                  <strong>{entry.forecast.prompt}</strong>
                </p>
                <p>p={Math.round(entry.response.p * 100)}%</p>
                <p>
                  {copy.forecasts.outcome}:{' '}
                  {entry.response.outcome === 1 ? copy.common.yes : copy.common.no}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
