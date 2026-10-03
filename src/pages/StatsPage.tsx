import { useEffect, useMemo, useState } from 'react'
import {
  calibrationBins,
  confidenceHistogram,
  meanBrier,
} from '../domain/scoring'
import { ALL_DOMAINS, type BinaryResponse, type Domain } from '../domain/types'
import { getBinaryResponses, getFactItems, initializeDatabase } from '../db/repository'
import { useI18n } from '../i18n/useI18n'

function daysAgo(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() - days)
  return date.toISOString()
}

export function StatsPage() {
  const { copy } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [binaryResponses, setBinaryResponses] = useState<BinaryResponse[]>([])
  const [factDomainById, setFactDomainById] = useState<Record<string, Domain>>({})
  const [selectedDomain, setSelectedDomain] = useState<Domain | 'all'>('all')

  function formatBrier(value: number | null): string {
    if (value === null) {
      return copy.common.insufficientData
    }
    return value.toFixed(4)
  }

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        await initializeDatabase()
        const [responses, facts] = await Promise.all([
          getBinaryResponses(),
          getFactItems(),
        ])
        setBinaryResponses(responses)
        setFactDomainById(
          facts.reduce<Record<string, Domain>>((acc, item) => {
            acc[item.id] = item.domain
            return acc
          }, {}),
        )
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : copy.stats.errorLoad
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [copy.stats.errorLoad])

  const brier7 = useMemo(() => {
    const since = daysAgo(7)
    return meanBrier(binaryResponses.filter((response) => response.createdAt >= since))
  }, [binaryResponses])

  const brierAll = useMemo(
    () => meanBrier(binaryResponses),
    [binaryResponses],
  )

  const brier30 = useMemo(() => {
    const since = daysAgo(30)
    return meanBrier(binaryResponses.filter((response) => response.createdAt >= since))
  }, [binaryResponses])

  const brier90 = useMemo(() => {
    const since = daysAgo(90)
    return meanBrier(binaryResponses.filter((response) => response.createdAt >= since))
  }, [binaryResponses])

  const bins = useMemo(
    () => calibrationBins(binaryResponses),
    [binaryResponses],
  )

  const histogram = useMemo(
    () => confidenceHistogram(binaryResponses, 0.1),
    [binaryResponses],
  )

  const responsesByDomain = useMemo(() => {
    const map = new Map<Domain, BinaryResponse[]>()
    for (const domain of ALL_DOMAINS) {
      map.set(domain, [])
    }

    for (const response of binaryResponses) {
      if (response.itemType !== 'fact') {
        continue
      }
      const domain = factDomainById[response.itemId]
      if (domain === undefined) {
        continue
      }
      map.get(domain)?.push(response)
    }

    return map
  }, [binaryResponses, factDomainById])

  const domainRows = useMemo(
    () =>
      ALL_DOMAINS.map((domain) => {
        const responses = responsesByDomain.get(domain) ?? []
        const resolvedCount = responses.filter((item) => item.outcome !== undefined).length
        return {
          domain,
          n: resolvedCount,
          brier: meanBrier(responses),
        }
      }).sort((a, b) => {
        if (a.brier === null && b.brier === null) return 0
        if (a.brier === null) return 1
        if (b.brier === null) return -1
        return b.brier - a.brier
      }),
    [responsesByDomain],
  )

  const selectedDomainBins = useMemo(() => {
    if (selectedDomain === 'all') {
      return bins
    }
    return calibrationBins(responsesByDomain.get(selectedDomain) ?? [])
  }, [bins, responsesByDomain, selectedDomain])

  if (loading) {
    return <p>{copy.stats.loading}</p>
  }

  if (error !== null) {
    return (
      <section className="panel">
        <h2>{copy.common.error}</h2>
        <p>{error}</p>
      </section>
    )
  }

  return (
    <div className="stack">
      <section className="panel">
        <h1>{copy.stats.title}</h1>
        <div className="grid-four">
          <div>
            <strong>{copy.stats.brierOverall}</strong>
            <p>{formatBrier(brierAll)}</p>
          </div>
          <div>
            <strong>{copy.stats.brier7d}</strong>
            <p>{formatBrier(brier7)}</p>
          </div>
          <div>
            <strong>{copy.stats.brier30d}</strong>
            <p>{formatBrier(brier30)}</p>
          </div>
          <div>
            <strong>{copy.stats.brier90d}</strong>
            <p>{formatBrier(brier90)}</p>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>{copy.stats.calibrationTitle}</h2>
        <label>
          {copy.stats.domainFilterLabel}
          <select
            value={selectedDomain}
            onChange={(event) => setSelectedDomain(event.target.value as Domain | 'all')}
          >
            <option value="all">{copy.stats.domainAll}</option>
            {ALL_DOMAINS.map((domain) => (
              <option key={domain} value={domain}>
                {copy.domainLabels[domain]}
              </option>
            ))}
          </select>
        </label>
        <table>
          <thead>
            <tr>
              <th>{copy.stats.bin}</th>
              <th>{copy.stats.n}</th>
              <th>{copy.stats.meanP}</th>
              <th>{copy.stats.empirical}</th>
              <th>{copy.stats.delta}</th>
            </tr>
          </thead>
          <tbody>
            {selectedDomainBins.map((bin) => (
              <tr key={`${bin.binStart}-${bin.binEnd}`}>
                <td>
                  {Math.round(bin.binStart * 100)}-{Math.round(bin.binEnd * 100)}
                </td>
                <td>{bin.n}</td>
                <td>{bin.n === 0 ? '-' : bin.meanP.toFixed(3)}</td>
                <td>{bin.n === 0 ? '-' : bin.empirical.toFixed(3)}</td>
                <td>{bin.n === 0 ? '-' : (bin.empirical - bin.meanP).toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>{copy.stats.byDomainTitle}</h2>
        <table>
          <thead>
            <tr>
              <th>{copy.stats.domainColumn}</th>
              <th>{copy.stats.n}</th>
              <th>{copy.stats.brierOverall}</th>
            </tr>
          </thead>
          <tbody>
            {domainRows.map((row) => (
              <tr key={row.domain}>
                <td>{copy.domainLabels[row.domain]}</td>
                <td>{row.n}</td>
                <td>{formatBrier(row.brier)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>{copy.stats.confidenceDistributionTitle}</h2>
        <table>
          <thead>
            <tr>
              <th>{copy.stats.pBucket}</th>
              <th>{copy.stats.n}</th>
            </tr>
          </thead>
          <tbody>
            {histogram.map((bucket) => (
              <tr key={bucket.pBucket}>
                <td>
                  {Math.round(bucket.pBucket * 100)}-
                  {Math.round((bucket.pBucket + 0.1) * 100)}
                </td>
                <td>{bucket.n}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  )
}
