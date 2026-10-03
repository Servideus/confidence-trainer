import { useCallback, useEffect, useMemo, useState } from 'react'
import { ALL_DOMAINS, type Difficulty, type Domain } from '../domain/types'
import { brier } from '../domain/scoring'
import {
  generateTodaySession,
  type SessionPlan,
  type SessionPreferences,
} from '../domain/session'
import {
  createFactResponse,
  getBinaryResponses,
  getFactItems,
  initializeDatabase,
} from '../db/repository'
import { useI18n } from '../i18n/useI18n'

interface TaskResult {
  responseId: string
  title: string
  summary: string
}

const QUICK_PROBABILITIES = [10, 25, 40, 50, 60, 75, 90]
const PROBABILITY_ANCHORS = [0, 5, 15, 25, 35, 45, 50, 55, 65, 75, 85, 95, 100]

function toProbabilityPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50
  }
  return Math.min(100, Math.max(0, Math.round(value)))
}

const DEFAULT_SESSION_PREFERENCES: SessionPreferences = {
  minDifficulty: 3,
  enabledDomains: ['geography', 'history', 'science'],
  includeWarmup: false,
}

function SessionTaskForm({
  taskPrompt,
  probabilityPercent,
  setProbabilityPercent,
  rationale,
  setRationale,
  onSubmit,
  saving,
  copy,
}: {
  taskPrompt: string
  probabilityPercent: number
  setProbabilityPercent: (value: number) => void
  rationale: string
  setRationale: (value: string) => void
  onSubmit: () => Promise<void>
  saving: boolean
  copy: ReturnType<typeof useI18n>['copy']
}) {
  return (
    <section className="panel">
      <h2>{copy.today.fact}</h2>
      <p>{taskPrompt}</p>

      <label>
        {copy.today.probabilityLabel}
        <input
          aria-label={copy.today.probabilityAria}
          value={probabilityPercent}
          min={0}
          max={100}
          step={1}
          onChange={(event) => setProbabilityPercent(toProbabilityPercent(Number(event.target.value)))}
          type="number"
        />
      </label>
      <div className="probability-scale">
        <input
          value={probabilityPercent}
          min={0}
          max={100}
          step={1}
          onChange={(event) => setProbabilityPercent(toProbabilityPercent(Number(event.target.value)))}
          type="range"
        />
        <div className="probability-ticks" aria-hidden>
          {PROBABILITY_ANCHORS.map((value) => (
            <span
              key={value}
              className="probability-tick"
              style={{ left: `${value}%` }}
            >
              <span className="probability-tick-mark" />
              <span className="probability-tick-label">{value}</span>
            </span>
          ))}
        </div>
      </div>
      <p className="meta">
        {copy.today.probabilityMeaningFalse}
        {' • '}
        {copy.today.probabilityMeaningUnknown}
        {' • '}
        {copy.today.probabilityMeaningTrue}
      </p>
      <div className="row">
        {QUICK_PROBABILITIES.map((value) => (
          <button
            key={value}
            type="button"
            className={`quick-prob-button${probabilityPercent === value ? ' is-active' : ''}`}
            onClick={() => setProbabilityPercent(value)}
          >
            {value}%
          </button>
        ))}
      </div>

      <label>
        {copy.today.rationaleLabel}
        <textarea
          value={rationale}
          onChange={(event) => setRationale(event.target.value.slice(0, 200))}
          maxLength={200}
          placeholder={copy.today.rationalePlaceholder}
        />
      </label>

      <button onClick={() => void onSubmit()} disabled={saving}>
        {saving ? copy.today.savingButton : copy.today.saveButton}
      </button>
    </section>
  )
}

function SessionSettingsPanel({
  copy,
  preferences,
  setPreferences,
  onApply,
}: {
  copy: ReturnType<typeof useI18n>['copy']
  preferences: SessionPreferences
  setPreferences: (next: SessionPreferences) => void
  onApply: () => void
}) {
  function toggleDomain(domain: Domain): void {
    const exists = preferences.enabledDomains.includes(domain)
    const nextDomains = exists
      ? preferences.enabledDomains.filter((item) => item !== domain)
      : [...preferences.enabledDomains, domain]

    setPreferences({
      ...preferences,
      enabledDomains: nextDomains.length === 0 ? [domain] : nextDomains,
    })
  }

  return (
    <section className="panel">
      <h2>{copy.today.settingsTitle}</h2>
      <p className="meta">{copy.today.settingsHint}</p>

      <label>
        {copy.today.minDifficultyLabel}: {preferences.minDifficulty}
        <input
          type="range"
          min={1}
          max={5}
          step={1}
          value={preferences.minDifficulty}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              minDifficulty: Number(event.target.value) as Difficulty,
            })
          }
        />
      </label>

      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={preferences.includeWarmup}
          onChange={(event) =>
            setPreferences({
              ...preferences,
              includeWarmup: event.target.checked,
            })
          }
        />
        {copy.today.includeWarmupLabel}
      </label>

      <p>{copy.today.domainsLabel}</p>
      <div className="domain-grid">
        {ALL_DOMAINS.map((domain) => (
          <label key={domain} className="checkbox-row">
            <input
              type="checkbox"
              checked={preferences.enabledDomains.includes(domain)}
              onChange={() => toggleDomain(domain)}
            />
            {copy.domainLabels[domain]}
          </label>
        ))}
      </div>

      <button type="button" onClick={onApply}>
        {copy.today.applySettingsButton}
      </button>
    </section>
  )
}

export function TodayPage() {
  const { language, copy } = useI18n()

  const [sessionPreferences, setSessionPreferences] = useState<SessionPreferences>(
    DEFAULT_SESSION_PREFERENCES,
  )
  const [draftPreferences, setDraftPreferences] = useState<SessionPreferences>(
    DEFAULT_SESSION_PREFERENCES,
  )
  const [preferencesVersion, setPreferencesVersion] = useState(0)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  const [sessionPlan, setSessionPlan] = useState<SessionPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [taskIndex, setTaskIndex] = useState(0)
  const [taskResult, setTaskResult] = useState<TaskResult | null>(null)

  const [probabilityPercent, setProbabilityPercent] = useState(50)
  const [rationale, setRationale] = useState('')

  const loadSession = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await initializeDatabase()
      const [facts, binaryResponses] = await Promise.all([
        getFactItems(language),
        getBinaryResponses(),
      ])

      const session = generateTodaySession({
        facts,
        binaryResponses,
        preferences: sessionPreferences,
        now: new Date(),
      })

      setSessionPlan(session)
      setTaskIndex(0)
      setTaskResult(null)
      setProbabilityPercent(50)
      setRationale('')
    } catch (caught) {
      const message =
        caught instanceof Error && caught.message.includes('Not enough eligible fact')
          ? copy.today.errorNoEligibleFacts
          : caught instanceof Error
            ? caught.message
            : copy.today.errorLoad
      setError(message)
    } finally {
      setLoading(false)
    }
  }, [copy.today.errorLoad, copy.today.errorNoEligibleFacts, language, sessionPreferences])

  useEffect(() => {
    void loadSession()
  }, [loadSession, preferencesVersion])

  function applyPreferences(): void {
    setSessionPreferences(draftPreferences)
    setPreferencesVersion((value) => value + 1)
    setIsSettingsOpen(false)
  }

  const currentTask = useMemo(
    () => sessionPlan?.tasks[taskIndex],
    [sessionPlan, taskIndex],
  )

  async function handleSubmitTask(): Promise<void> {
    if (currentTask === undefined) {
      return
    }

    setSaving(true)
    setError(null)
    try {
      const p = probabilityPercent / 100
      const response = await createFactResponse(
        currentTask.item,
        p,
        rationale.trim().length > 0 ? rationale.trim() : undefined,
      )
      const score = brier(p, response.outcome as 0 | 1)
      setTaskResult({
        responseId: response.id,
        title:
          response.outcome === 1
            ? copy.today.factTrueTitle
            : copy.today.factFalseTitle,
        summary: copy.today.factSummary(probabilityPercent, score),
      })
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : copy.today.errorSave
      setError(message)
    } finally {
      setSaving(false)
    }
  }

  function handleNextTask(): void {
    setTaskResult(null)
    setTaskIndex((index) => index + 1)
    setProbabilityPercent(50)
    setRationale('')
  }

  if (loading) {
    return <p>{copy.today.loading}</p>
  }

  return (
    <div className="stack">
      <header className="row row-space">
        <h1>{copy.today.title}</h1>
        <div className="row">
          {sessionPlan !== null && currentTask !== undefined && (
            <strong>{copy.today.taskCounter(taskIndex + 1, sessionPlan.tasks.length)}</strong>
          )}
          <button
            type="button"
            className="settings-toggle-button"
            onClick={() => setIsSettingsOpen((value) => !value)}
          >
            {isSettingsOpen
              ? copy.today.hideSettingsButton
              : copy.today.openSettingsButton}
          </button>
        </div>
      </header>

      {isSettingsOpen && (
        <SessionSettingsPanel
          copy={copy}
          preferences={draftPreferences}
          setPreferences={setDraftPreferences}
          onApply={applyPreferences}
        />
      )}

      {error !== null && (
        <section className="panel">
          <h2>{copy.common.error}</h2>
          <p>{error}</p>
          <button onClick={() => void loadSession()}>{copy.common.retry}</button>
        </section>
      )}

      {sessionPlan === null ? (
        <p>{copy.today.unavailable}</p>
      ) : currentTask === undefined ? (
        <section className="panel">
          <h2>{copy.today.sessionCompleteTitle}</h2>
          <p>{copy.today.sessionCompleteText}</p>
          <button onClick={() => void loadSession()}>{copy.today.startNewSession}</button>
        </section>
      ) : taskResult !== null ? (
        <section className="panel">
          <h2>{taskResult.title}</h2>
          <p>{taskResult.summary}</p>
          <p>
            {copy.today.detailsPrefix} <code>/result/{taskResult.responseId}</code>
          </p>
          <button onClick={handleNextTask}>{copy.today.nextButton}</button>
        </section>
      ) : (
        <SessionTaskForm
          copy={copy}
          taskPrompt={currentTask.item.prompt}
          probabilityPercent={probabilityPercent}
          setProbabilityPercent={setProbabilityPercent}
          rationale={rationale}
          setRationale={setRationale}
          onSubmit={handleSubmitTask}
          saving={saving}
        />
      )}
    </div>
  )
}
