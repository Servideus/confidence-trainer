import { useEffect, useState } from 'react'
import type { FactItem } from '../domain/types'
import { getFactItems, initializeDatabase } from '../db/repository'
import { useI18n } from '../i18n/useI18n'

export function LibraryPage() {
  const { language, copy } = useI18n()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [facts, setFacts] = useState<FactItem[]>([])

  useEffect(() => {
    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        await initializeDatabase()
        setFacts(await getFactItems(language))
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : copy.library.errorLoad
        setError(message)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [copy.library.errorLoad, language])

  if (loading) {
    return <p>{copy.library.loading}</p>
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
        <h1>{copy.library.title}</h1>
        <p>
          {copy.library.factQuestions}: {facts.length}
        </p>
      </section>

      <section className="panel">
        <h2>{copy.library.factSample}</h2>
        <ul className="list">
          {facts.slice(0, 20).map((item) => (
            <li key={item.id} className="list-item">
              <p>
                <strong>{item.prompt}</strong>
              </p>
              <p>
                {copy.library.answer}:{' '}
                {item.answer === 1 ? copy.library.trueLabel : copy.library.falseLabel}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
