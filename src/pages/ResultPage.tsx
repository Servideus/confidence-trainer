import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { brier } from '../domain/scoring'
import type { BinaryResponse } from '../domain/types'
import {
  getFactItemById,
  getForecastById,
  getResponseById,
  initializeDatabase,
} from '../db/repository'
import { useI18n } from '../i18n/useI18n'
import { formatDateTime } from '../utils/date'

interface LoadedResult {
  response: BinaryResponse
  prompt: string
}

export function ResultPage() {
  const { responseId } = useParams()
  const { copy, locale } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<LoadedResult | null>(null)

  useEffect(() => {
    async function load(): Promise<void> {
      if (responseId === undefined) {
        setError(copy.result.errorMissingId)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        await initializeDatabase()
        const response = await getResponseById(responseId)
        if (response === undefined) {
          throw new Error(copy.result.errorNotFound)
        }

        if (response.itemType === 'fact') {
          const item = await getFactItemById(response.itemId)
          setResult({
            response,
            prompt: item?.prompt ?? response.itemId,
          })
        } else {
          const item = await getForecastById(response.itemId)
          setResult({
            response,
            prompt: item?.prompt ?? response.itemId,
          })
        }
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : copy.result.errorLoad
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    void load()
  }, [
    copy.result.errorLoad,
    copy.result.errorMissingId,
    copy.result.errorNotFound,
    responseId,
  ])

  if (loading) {
    return <p>{copy.result.loading}</p>
  }

  if (error !== null) {
    return (
      <section className="panel">
        <h2>{copy.common.error}</h2>
        <p>{error}</p>
        <Link to="/today">{copy.result.backToday}</Link>
      </section>
    )
  }

  if (result === null) {
    return <p>{copy.result.noData}</p>
  }

  const { response, prompt } = result

  return (
    <section className="panel">
      <h1>{copy.result.title}</h1>
      <p>{prompt}</p>
      <p>
        {copy.result.created}: {formatDateTime(response.createdAt, locale)}
      </p>
      <p>
        {copy.result.confidence}: {Math.round(response.p * 100)}%
      </p>
      <p>
        {copy.result.type}: {response.itemType}
      </p>
      {response.outcome === undefined ? (
        <p>{copy.result.statusPending}</p>
      ) : (
        <>
          <p>
            {copy.result.outcome}:{' '}
            {response.outcome === 1 ? copy.common.yes : copy.common.no}
          </p>
          <p>
            {copy.result.brierError}: {brier(response.p, response.outcome).toFixed(3)}
          </p>
        </>
      )}

      {response.rationale && (
        <p>
          {copy.result.rationale}: {response.rationale}
        </p>
      )}

      <div className="row">
        <Link to="/today">{copy.result.backToday}</Link>
        <Link to="/stats">{copy.result.openStats}</Link>
      </div>
    </section>
  )
}
