import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = 'https://query.wikidata.org/sparql'
const USER_AGENT = 'confidence-trainer/0.1 (mailto:confidence-trainer@example.com)'
const ACCEPT_ENCODING = 'gzip,deflate'
const REQUEST_DELAY_MS = 600
const MAX_RETRIES = 4
const PAGE_SIZE = 40
const MAX_ROWS_PER_QUERY = 120
const MIN_FACTS_TARGET = 1000
const CACHE_VERSION = 5
const WDQS_MAX_CONCURRENCY = 1
const WDQS_SOFT_CONCURRENCY_CAP = 2

const THRESHOLD_MULTIPLIERS = [
  0.75, 0.78, 0.81, 0.84, 0.88, 0.93, 1.07, 1.12, 1.16, 1.19, 1.22, 1.25,
]
const MIN_DELTA = 0.06
const MAX_DELTA = 0.35
const MAX_BACKOFF_MS = 60_000
const MIN_SITELINKS = {
  areaCountries: 20,
  elevationCities: 20,
  populationCountries: 20,
  lengthRivers: 20,
  historyPeople: 35,
}

const ENTITY_TYPE_MAP = {
  Q6256: { ru: 'страны', en: 'country', domain: 'geography' },
  Q515: { ru: 'города', en: 'city', domain: 'geography' },
  Q4022: { ru: 'реки', en: 'river', domain: 'geography' },
  Q8502: { ru: 'горы', en: 'mountain', domain: 'geography' },
  Q23442: { ru: 'острова', en: 'island', domain: 'geography' },
  Q5107: { ru: 'континента', en: 'continent', domain: 'geography' },
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const outDir = path.resolve(__dirname, '../../src/data/generated')
const cacheDir = path.resolve(__dirname, './cache')
const offlineFactsPath = path.join(outDir, 'facts_wikidata.json')
const historyPeopleCachePath = path.join(cacheDir, 'history_people_api.json')

const HISTORY_ENWIKI_TITLES = [
  'Albert_Einstein',
  'Isaac_Newton',
  'Galileo_Galilei',
  'Nikola_Tesla',
  'Marie_Curie',
  'Charles_Darwin',
  'Leonardo_da_Vinci',
  'William_Shakespeare',
  'Ludwig_van_Beethoven',
  'Johann_Sebastian_Bach',
  'Wolfgang_Amadeus_Mozart',
  'Napoleon',
  'Julius_Caesar',
  'Alexander_the_Great',
  'Genghis_Khan',
  'George_Washington',
  'Abraham_Lincoln',
  'Franklin_D._Roosevelt',
  'Winston_Churchill',
  'Mahatma_Gandhi',
  'Nelson_Mandela',
  'Martin_Luther_King_Jr.',
  'Mother_Teresa',
  'Pablo_Picasso',
  'Vincent_van_Gogh',
  'Frida_Kahlo',
  'Stephen_Hawking',
  'Yuri_Gagarin',
  'Neil_Armstrong',
  'Margaret_Thatcher',
  'Angela_Merkel',
  'Vladimir_Lenin',
  'Joseph_Stalin',
  'Mao_Zedong',
  'Deng_Xiaoping',
  'Queen_Victoria',
  'Elizabeth_II',
  'Cleopatra',
  'Joan_of_Arc',
  'Christopher_Columbus',
  'Thomas_Edison',
  'Henry_Ford',
  'Bill_Gates',
  'Steve_Jobs',
  'Tim_Berners-Lee',
  'Ada_Lovelace',
  'Alan_Turing',
  'Grace_Hopper',
  'Johannes_Kepler',
  'Plato',
  'Aristotle',
]

const FALLBACK_HISTORY_PEOPLE = [
  { qid: 'fallback-einstein', labelRu: 'Альберт Эйнштейн', labelEn: 'Albert Einstein', birthYear: 1879, sitelinks: 200 },
  { qid: 'fallback-newton', labelRu: 'Исаак Ньютон', labelEn: 'Isaac Newton', birthYear: 1643, sitelinks: 200 },
  { qid: 'fallback-galileo', labelRu: 'Галилео Галилей', labelEn: 'Galileo Galilei', birthYear: 1564, sitelinks: 200 },
  { qid: 'fallback-curie', labelRu: 'Мария Кюри', labelEn: 'Marie Curie', birthYear: 1867, sitelinks: 200 },
  { qid: 'fallback-darwin', labelRu: 'Чарльз Дарвин', labelEn: 'Charles Darwin', birthYear: 1809, sitelinks: 200 },
  { qid: 'fallback-shakespeare', labelRu: 'Уильям Шекспир', labelEn: 'William Shakespeare', birthYear: 1564, sitelinks: 200 },
  { qid: 'fallback-napoleon', labelRu: 'Наполеон I', labelEn: 'Napoleon', birthYear: 1769, sitelinks: 200 },
  { qid: 'fallback-washington', labelRu: 'Джордж Вашингтон', labelEn: 'George Washington', birthYear: 1732, sitelinks: 200 },
  { qid: 'fallback-lincoln', labelRu: 'Авраам Линкольн', labelEn: 'Abraham Lincoln', birthYear: 1809, sitelinks: 200 },
  { qid: 'fallback-gandhi', labelRu: 'Махатма Ганди', labelEn: 'Mahatma Gandhi', birthYear: 1869, sitelinks: 200 },
  { qid: 'fallback-mandela', labelRu: 'Нельсон Мандела', labelEn: 'Nelson Mandela', birthYear: 1918, sitelinks: 200 },
  { qid: 'fallback-gagarin', labelRu: 'Юрий Гагарин', labelEn: 'Yuri Gagarin', birthYear: 1934, sitelinks: 200 },
  { qid: 'fallback-armstrong', labelRu: 'Нил Армстронг', labelEn: 'Neil Armstrong', birthYear: 1930, sitelinks: 200 },
  { qid: 'fallback-turing', labelRu: 'Алан Тьюринг', labelEn: 'Alan Turing', birthYear: 1912, sitelinks: 200 },
  { qid: 'fallback-lovelace', labelRu: 'Ада Лавлейс', labelEn: 'Ada Lovelace', birthYear: 1815, sitelinks: 200 },
]

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getValue(binding, key) {
  return binding?.[key]?.value
}

function extractQid(uri) {
  if (typeof uri !== 'string') {
    return null
  }
  const match = uri.match(/Q\d+/)
  return match?.[0] ?? null
}

function parseIsoYear(value) {
  if (typeof value !== 'string' || value.length < 4) {
    return undefined
  }
  const year = Number(value.slice(0, 4))
  return Number.isInteger(year) ? year : undefined
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function createConcurrencyLimiter(maxConcurrent) {
  let active = 0
  const queue = []

  const runNext = () => {
    if (active >= maxConcurrent || queue.length === 0) {
      return
    }
    const next = queue.shift()
    active += 1
    next()
  }

  return async function limit(task) {
    await new Promise((resolve) => {
      queue.push(resolve)
      runNext()
    })

    try {
      return await task()
    } finally {
      active -= 1
      runNext()
    }
  }
}

function difficultyFromDelta(delta) {
  if (delta < 0.1) {
    return 5
  }
  if (delta < 0.16) {
    return 4
  }
  return 3
}

function roundToSignificant(value, significantDigits) {
  if (value === 0) {
    return 0
  }
  const abs = Math.abs(value)
  const digits = Math.floor(Math.log10(abs)) + 1
  const scale = 10 ** (digits - significantDigits)
  return Math.round(value / scale) * scale
}

function roundThresholdByScale(value) {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) {
    return roundToSignificant(value, 2)
  }
  if (abs >= 10_000) {
    return roundToSignificant(value, 3)
  }
  if (abs >= 1000) {
    return roundToSignificant(value, 3)
  }
  if (abs >= 10) {
    return roundToSignificant(value, 2)
  }
  return Number(value.toFixed(2))
}

function formatNumber(value, locale) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value)
}

function withSentenceUnit(unitLabel) {
  return unitLabel.replace(/\.+$/, '')
}

function toPromptRu(metricLabelRu, entityKindRu, entityLabelRu, threshold, unitLabelRu, year) {
  const unit = withSentenceUnit(unitLabelRu)
  if (metricLabelRu === 'Население' && year !== undefined) {
    return `Население ${entityKindRu} ${entityLabelRu} в ${year} году было больше ${formatNumber(threshold, 'ru-RU')} ${unit}.`
  }
  return `${metricLabelRu} ${entityKindRu} ${entityLabelRu} больше ${formatNumber(threshold, 'ru-RU')} ${unit}.`
}

function toPromptEn(metricLabelEn, entityKindEn, entityLabelEn, threshold, unitLabelEn, year) {
  const unit = withSentenceUnit(unitLabelEn)
  if (metricLabelEn === 'population' && year !== undefined) {
    return `The population of ${entityLabelEn} (${entityKindEn}) in ${year} was greater than ${formatNumber(threshold, 'en-US')} ${unit}.`
  }
  return `The ${metricLabelEn} of ${entityLabelEn} (${entityKindEn}) is greater than ${formatNumber(threshold, 'en-US')} ${unit}.`
}

function computeExponentialBackoffMs(attempt) {
  const base = 2_000 * (2 ** (attempt - 1))
  const jitter = Math.floor(Math.random() * 800)
  return Math.min(base + jitter, MAX_BACKOFF_MS)
}

function parseRetryAfterMs(header) {
  if (header === null || header === undefined) {
    return null
  }
  const asSeconds = Number(header)
  if (Number.isFinite(asSeconds) && asSeconds >= 0) {
    return asSeconds * 1000
  }
  const asDate = Date.parse(header)
  if (!Number.isNaN(asDate)) {
    return Math.max(0, asDate - Date.now())
  }
  return null
}

function validateWdqsRequestConfig() {
  assert(
    typeof USER_AGENT === 'string' &&
      USER_AGENT.trim().length > 0 &&
      USER_AGENT.includes('mailto:') &&
      !/node-fetch|undici/i.test(USER_AGENT),
    'User-Agent must be explicit and include contact (mailto:...)',
  )
  assert(
    typeof ACCEPT_ENCODING === 'string' &&
      ACCEPT_ENCODING.includes('gzip') &&
      ACCEPT_ENCODING.includes('deflate'),
    'Accept-Encoding must include gzip and deflate',
  )
}

const runWdqsLimited = createConcurrencyLimiter(WDQS_MAX_CONCURRENCY)

async function fetchSparqlWithRetry(query, name) {
  let attempt = 1

  for (;;) {
    let response
    try {
      response = await runWdqsLimited(() =>
        fetch(ENDPOINT, {
          method: 'POST',
          headers: {
            Accept: 'application/sparql-results+json',
            'Content-Type': 'application/sparql-query',
            'Accept-Encoding': ACCEPT_ENCODING,
            'User-Agent': USER_AGENT,
          },
          body: query,
        }),
      )
    } catch (error) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`[${name}] SPARQL network error after ${attempt} attempts: ${String(error)}`)
      }
      const backoffMs = computeExponentialBackoffMs(attempt)
      console.warn(`[${name}] network error, attempt=${attempt}, waiting ${backoffMs}ms before retry...`)
      await sleep(backoffMs)
      attempt += 1
      continue
    }

    if (response.ok) {
      return response.json()
    }

    const status = response.status
    const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))

    const canRetry =
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    if (!canRetry || attempt > MAX_RETRIES) {
      const text = await response.text()
      throw new Error(`[${name}] SPARQL failed: status=${status}, attempt=${attempt}, body=${text.slice(0, 500)}`)
    }

    const backoffMs =
      status === 429 && retryAfterMs !== null
        ? retryAfterMs
        : computeExponentialBackoffMs(attempt)

    console.warn(
      `[${name}] status=${status}, attempt=${attempt}, waiting ${backoffMs}ms before retry...`,
    )
    await sleep(backoffMs)
    attempt += 1
  }
}

async function fetchJsonWithRetry(url, name) {
  let attempt = 1

  for (;;) {
    let response
    try {
      response = await runWdqsLimited(() =>
        fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': ACCEPT_ENCODING,
            'User-Agent': USER_AGENT,
          },
        }),
      )
    } catch (error) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`[${name}] network error after ${attempt} attempts: ${String(error)}`)
      }
      const backoffMs = computeExponentialBackoffMs(attempt)
      console.warn(`[${name}] network error, attempt=${attempt}, waiting ${backoffMs}ms before retry...`)
      await sleep(backoffMs)
      attempt += 1
      continue
    }

    if (response.ok) {
      return response.json()
    }

    const status = response.status
    const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'))
    const canRetry =
      status === 429 ||
      status === 500 ||
      status === 502 ||
      status === 503 ||
      status === 504
    if (!canRetry || attempt > MAX_RETRIES) {
      const text = await response.text()
      throw new Error(`[${name}] failed: status=${status}, attempt=${attempt}, body=${text.slice(0, 500)}`)
    }

    const backoffMs =
      status === 429 && retryAfterMs !== null
        ? retryAfterMs
        : computeExponentialBackoffMs(attempt)

    console.warn(`[${name}] status=${status}, attempt=${attempt}, waiting ${backoffMs}ms before retry...`)
    await sleep(backoffMs)
    attempt += 1
  }
}

function parseWikidataTimeYear(raw) {
  if (typeof raw !== 'string') {
    return undefined
  }
  const match = raw.match(/^([+-]?\d{4,})-/)
  if (match === null) {
    return undefined
  }
  const year = Number(match[1])
  return Number.isFinite(year) ? year : undefined
}

function normalizeHistoryPeopleFromApiEntities(entities) {
  const people = []
  for (const entity of entities) {
    if (typeof entity !== 'object' || entity === null || typeof entity.id !== 'string') {
      continue
    }

    const qid = entity.id
    if (!/^Q\d+$/.test(qid)) {
      continue
    }

    const labelRu = entity.labels?.ru?.value?.trim?.() ?? ''
    const labelEn = entity.labels?.en?.value?.trim?.() ?? ''
    const sitelinks = Number(Object.keys(entity.sitelinks ?? {}).length)
    const claims = entity.claims?.P569
    const birthYear = parseWikidataTimeYear(
      Array.isArray(claims)
        ? claims[0]?.mainsnak?.datavalue?.value?.time
        : undefined,
    )

    if (
      labelRu.length === 0 ||
      labelEn.length === 0 ||
      !Number.isFinite(sitelinks) ||
      sitelinks < MIN_SITELINKS.historyPeople ||
      birthYear === undefined ||
      birthYear < 1200 ||
      birthYear > 2010
    ) {
      continue
    }

    people.push({
      qid,
      labelRu,
      labelEn,
      birthYear,
      sitelinks,
      source: 'Wikidata:P569',
      domain: 'history',
    })
  }

  return people
}

async function fetchHistoryPeopleFromWikidataApi() {
  try {
    const rawCached = await readFile(historyPeopleCachePath, 'utf8')
    const cached = JSON.parse(rawCached)
    if (Array.isArray(cached) && cached.length > 0) {
      return cached
    }
  } catch {
    // ignore cache read errors
  }

  try {
    const entities = []
    const chunkSize = 25
    for (let i = 0; i < HISTORY_ENWIKI_TITLES.length; i += chunkSize) {
      const chunk = HISTORY_ENWIKI_TITLES.slice(i, i + chunkSize)
      const url = new URL('https://www.wikidata.org/w/api.php')
      url.searchParams.set('action', 'wbgetentities')
      url.searchParams.set('sites', 'enwiki')
      url.searchParams.set('titles', chunk.join('|'))
      url.searchParams.set('props', 'labels|claims|sitelinks')
      url.searchParams.set('languages', 'ru|en')
      url.searchParams.set('format', 'json')
      url.searchParams.set('origin', '*')

      const payload = await fetchJsonWithRetry(url, 'history_api')
      const batchEntities = Object.values(payload?.entities ?? {})
      entities.push(...batchEntities)
      await sleep(REQUEST_DELAY_MS)
    }

    const people = normalizeHistoryPeopleFromApiEntities(entities)
    if (people.length > 0) {
      await mkdir(cacheDir, { recursive: true })
      await writeFile(historyPeopleCachePath, `${JSON.stringify(people, null, 2)}\n`, 'utf8')
      return people
    }
  } catch (error) {
    console.warn(`history API fallback failed, using baked-in list: ${String(error)}`)
  }

  return FALLBACK_HISTORY_PEOPLE.map((item) => ({
    ...item,
    source: 'Wikidata:P569',
    domain: 'history',
  }))
}

const ALLOWED_TYPES_BY_PROPERTY = {
  P2046: new Set(['Q6256', 'Q23442', 'Q5107']),
  P2044: new Set(['Q515', 'Q8502']),
  P1082: new Set(['Q6256', 'Q515']),
  P2043: new Set(['Q4022']),
}

function minSitelinksForProperty(propertyId) {
  if (propertyId === 'P2046') return MIN_SITELINKS.areaCountries
  if (propertyId === 'P2044') return MIN_SITELINKS.elevationCities
  if (propertyId === 'P1082') return MIN_SITELINKS.populationCountries
  if (propertyId === 'P2043') return MIN_SITELINKS.lengthRivers
  return MIN_SITELINKS.areaCountries
}

function extractP31TypeQid(entity, propertyId) {
  const allowed = ALLOWED_TYPES_BY_PROPERTY[propertyId]
  if (allowed === undefined) {
    return null
  }

  const claims = entity?.claims?.P31
  if (!Array.isArray(claims)) {
    return null
  }

  for (const claim of claims) {
    const id = claim?.mainsnak?.datavalue?.value?.id
    if (typeof id === 'string' && allowed.has(id) && ENTITY_TYPE_MAP[id] !== undefined) {
      return id
    }
  }
  return null
}

async function fetchEntitySnapshotsByQid(qids) {
  const byQid = new Map()
  const uniqueQids = Array.from(new Set(qids.filter((qid) => /^Q\d+$/.test(qid))))
  const chunkSize = 50

  for (let i = 0; i < uniqueQids.length; i += chunkSize) {
    const chunk = uniqueQids.slice(i, i + chunkSize)
    const url = new URL('https://www.wikidata.org/w/api.php')
    url.searchParams.set('action', 'wbgetentities')
    url.searchParams.set('ids', chunk.join('|'))
    url.searchParams.set('props', 'labels|claims|sitelinks')
    url.searchParams.set('languages', 'ru|en')
    url.searchParams.set('format', 'json')
    url.searchParams.set('origin', '*')

    const payload = await fetchJsonWithRetry(url, 'entity_enrichment')
    for (const [qid, entity] of Object.entries(payload?.entities ?? {})) {
      if (!/^Q\d+$/.test(qid)) {
        continue
      }
      const labelRu = entity?.labels?.ru?.value ?? ''
      const labelEn = entity?.labels?.en?.value ?? ''
      const sitelinks = Object.keys(entity?.sitelinks ?? {}).length
      byQid.set(qid, {
        entity,
        labelRu,
        labelEn,
        sitelinks: Number.isFinite(sitelinks) ? sitelinks : 0,
      })
    }

    await sleep(REQUEST_DELAY_MS)
  }

  return byQid
}

async function enrichNumericRowsWithEntityData(rows) {
  if (rows.length === 0) {
    return rows
  }

  let snapshots
  try {
    snapshots = await fetchEntitySnapshotsByQid(rows.map((row) => row.qid))
  } catch (error) {
    console.warn(`entity enrichment failed, using un-enriched rows: ${String(error)}`)
    return rows
  }

  const enriched = []
  for (const row of rows) {
    const snapshot = snapshots.get(row.qid)
    if (snapshot === undefined) {
      continue
    }

    const minSitelinks = minSitelinksForProperty(row.propertyId)
    if (snapshot.sitelinks < minSitelinks) {
      continue
    }

    const typeQid = extractP31TypeQid(snapshot.entity, row.propertyId) ?? row.typeQid
    const type = ENTITY_TYPE_MAP[typeQid]
    if (type === undefined) {
      continue
    }

    const labelRu = (snapshot.labelRu ?? row.labelRu).trim()
    const labelEn = (snapshot.labelEn ?? row.labelEn).trim()
    if (labelRu.length === 0 || labelEn.length === 0) {
      continue
    }

    enriched.push({
      ...row,
      labelRu,
      labelEn,
      sitelinks: snapshot.sitelinks,
      typeQid,
      typePriority: entityTypePriority(typeQid),
      entityKindRu: type.ru,
      entityKindEn: type.en,
      domain: type.domain,
    })
  }

  return enriched
}

function withCursor(cursorQid) {
  if (cursorQid === null) {
    return ''
  }
  return `FILTER(?item > wd:${cursorQid})`
}

function areaQuery(limit, cursorQid) {
  return `
SELECT ?item ?instanceOf ?itemLabelRu ?itemLabelEn ?value ?sitelinks WHERE {
  ?item wdt:P31 ?instanceOf ;
        wdt:P2046 ?value ;
        wikibase:sitelinks ?sitelinks .
  VALUES ?instanceOf { wd:Q6256 wd:Q23442 wd:Q5107 }
  FILTER(?value > 5000 && ?value < 25000000)
  FILTER(?sitelinks > ${MIN_SITELINKS.areaCountries})
  ${withCursor(cursorQid)}
  OPTIONAL { ?item rdfs:label ?itemLabelRu FILTER(lang(?itemLabelRu) = "ru") }
  OPTIONAL { ?item rdfs:label ?itemLabelEn FILTER(lang(?itemLabelEn) = "en") }
}
ORDER BY ?item
LIMIT ${limit}
`
}

function elevationQuery(limit, cursorQid) {
  return `
SELECT ?item ?instanceOf ?itemLabelRu ?itemLabelEn ?value ?sitelinks WHERE {
  ?item wdt:P31 ?instanceOf ;
        wdt:P2044 ?value ;
        wikibase:sitelinks ?sitelinks .
  VALUES ?instanceOf { wd:Q515 wd:Q8502 }
  FILTER(?value > 20 && ?value < 9500)
  FILTER(?sitelinks > ${MIN_SITELINKS.elevationCities})
  ${withCursor(cursorQid)}
  OPTIONAL { ?item rdfs:label ?itemLabelRu FILTER(lang(?itemLabelRu) = "ru") }
  OPTIONAL { ?item rdfs:label ?itemLabelEn FILTER(lang(?itemLabelEn) = "en") }
}
ORDER BY ?item
LIMIT ${limit}
`
}

function populationQuery(limit, cursorQid) {
  return `
SELECT ?item ?instanceOf ?itemLabelRu ?itemLabelEn ?value ?pointInTime ?sitelinks WHERE {
  ?item wdt:P31 ?instanceOf ;
        wikibase:sitelinks ?sitelinks .
  VALUES ?instanceOf { wd:Q6256 wd:Q515 }
  ?item p:P1082 ?statement .
  ?statement ps:P1082 ?value .
  OPTIONAL { ?statement pq:P585 ?pointInTime . }
  FILTER(?value > 50000 && ?value < 2000000000)
  FILTER(?sitelinks > ${MIN_SITELINKS.populationCountries})
  ${withCursor(cursorQid)}
  OPTIONAL { ?item rdfs:label ?itemLabelRu FILTER(lang(?itemLabelRu) = "ru") }
  OPTIONAL { ?item rdfs:label ?itemLabelEn FILTER(lang(?itemLabelEn) = "en") }
}
ORDER BY ?item
LIMIT ${limit}
`
}

const QUERY_SPECS = [
  { name: 'area_countries', propertyId: 'P2046', queryBuilder: areaQuery },
  { name: 'elevation_cities', propertyId: 'P2044', queryBuilder: elevationQuery },
  { name: 'population_countries', propertyId: 'P1082', queryBuilder: populationQuery },
]

function extractLegacyCursorQid(state) {
  if (typeof state.lastQid === 'string' && /^Q\d+$/.test(state.lastQid)) {
    return state.lastQid
  }
  if (typeof state.lastItemUri === 'string') {
    return extractQid(state.lastItemUri)
  }
  return null
}

function cachePathForQuery(name) {
  return path.join(cacheDir, `${name}.state.json`)
}

async function readQueryCache(name) {
  const filePath = cachePathForQuery(name)
  try {
    const raw = await readFile(filePath, 'utf8')
    const state = JSON.parse(raw)
    if (state.version !== CACHE_VERSION) {
      return {
        version: CACHE_VERSION,
        rows: [],
        lastQid: null,
        completed: false,
      }
    }
    return {
      version: CACHE_VERSION,
      rows: Array.isArray(state.rows) ? state.rows : [],
      lastQid: extractLegacyCursorQid(state),
      completed: state.completed === true,
    }
  } catch {
    return {
      version: CACHE_VERSION,
      rows: [],
      lastQid: null,
      completed: false,
    }
  }
}

async function readLegacyRows(name) {
  try {
    const raw = await readFile(cachePathForQuery(name), 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.rows) ? parsed.rows : []
  } catch {
    return []
  }
}

async function writeQueryCache(name, state) {
  await mkdir(cacheDir, { recursive: true })
  await writeFile(cachePathForQuery(name), `${JSON.stringify(state, null, 2)}\n`, 'utf8')
}

async function runKeysetQueryWithResume(name, queryBuilder) {
  const state = await readQueryCache(name)

  if (state.completed) {
    console.log(`[${name}] resume cache complete: ${state.rows.length} rows`)
    return state.rows
  }

  while (state.rows.length < MAX_ROWS_PER_QUERY) {
    const limit = Math.min(PAGE_SIZE, MAX_ROWS_PER_QUERY - state.rows.length)
    if (limit <= 0) {
      break
    }

    const query = queryBuilder(limit, state.lastQid)
    const payload = await fetchSparqlWithRetry(query, name)
    const batch = payload?.results?.bindings ?? []
    console.log(`[${name}] fetched ${batch.length} rows (total=${state.rows.length + batch.length})`)

    if (batch.length === 0) {
      state.completed = true
      await writeQueryCache(name, state)
      break
    }

    state.rows.push(...batch)
    const batchLastQid = extractQid(getValue(batch[batch.length - 1], 'item'))
    state.lastQid = batchLastQid ?? state.lastQid

    if (batch.length < limit || state.rows.length >= MAX_ROWS_PER_QUERY) {
      state.completed = true
    }

    await writeQueryCache(name, state)
    if (state.completed) {
      break
    }
    await sleep(REQUEST_DELAY_MS)
  }

  return state.rows
}

function entityTypePriority(typeQid) {
  if (typeQid === 'Q6256') return 5
  if (typeQid === 'Q515') return 5
  if (typeQid === 'Q4022') return 4
  if (typeQid === 'Q8502') return 4
  if (typeQid === 'Q23442') return 4
  if (typeQid === 'Q5107') return 3
  return 1
}

function getEntityType(binding, fallbackTypeQid) {
  const typeQid = extractQid(getValue(binding, 'instanceOf')) ?? fallbackTypeQid ?? null
  if (typeQid === null) {
    return null
  }
  const mapped = ENTITY_TYPE_MAP[typeQid]
  if (mapped === undefined) {
    return null
  }
  return {
    typeQid,
    ...mapped,
    typePriority: entityTypePriority(typeQid),
  }
}

function parseSitelinks(binding, fallback = 0) {
  const sitelinks = Number(getValue(binding, 'sitelinks'))
  return Number.isFinite(sitelinks) ? sitelinks : fallback
}

function pickBetterNumericCandidate(existing, candidate) {
  if (candidate.propertyId === 'P1082') {
    const candidateYear = candidate.year ?? 0
    const existingYear = existing.year ?? 0
    if (candidateYear !== existingYear) {
      return candidateYear > existingYear ? candidate : existing
    }
  }

  if (candidate.sitelinks !== existing.sitelinks) {
    return candidate.sitelinks > existing.sitelinks ? candidate : existing
  }

  if (candidate.typePriority !== existing.typePriority) {
    return candidate.typePriority > existing.typePriority ? candidate : existing
  }

  return candidate.value > existing.value ? candidate : existing
}

function normalizeRows(areaRows, elevationRows, populationRows, lengthRows = []) {
  const numericCandidates = []

  for (const row of areaRows) {
    const qid = extractQid(getValue(row, 'item'))
    const type = getEntityType(row, 'Q6256')
    const value = Number(getValue(row, 'value'))
    const sitelinks = parseSitelinks(row, MIN_SITELINKS.areaCountries)
    if (qid === null || type === null || !Number.isFinite(value) || value <= 0 || sitelinks < MIN_SITELINKS.areaCountries) {
      continue
    }
    numericCandidates.push({
      qid,
      propertyId: 'P2046',
      value,
      labelRu: getValue(row, 'itemLabelRu') ?? '',
      labelEn: getValue(row, 'itemLabelEn') ?? '',
      source: 'Wikidata:P2046',
      domain: type.domain,
      unitRu: 'км²',
      unitEn: 'km2',
      metricRu: 'Площадь',
      metricEn: 'area',
      entityKindRu: type.ru,
      entityKindEn: type.en,
      typeQid: type.typeQid,
      typePriority: type.typePriority,
      sitelinks,
      year: undefined,
    })
  }

  for (const row of elevationRows) {
    const qid = extractQid(getValue(row, 'item'))
    const type = getEntityType(row, 'Q515')
    const value = Number(getValue(row, 'value'))
    const sitelinks = parseSitelinks(row, MIN_SITELINKS.elevationCities)
    if (
      qid === null ||
      type === null ||
      !Number.isFinite(value) ||
      value <= 0 ||
      sitelinks < MIN_SITELINKS.elevationCities
    ) {
      continue
    }
    numericCandidates.push({
      qid,
      propertyId: 'P2044',
      value,
      labelRu: getValue(row, 'itemLabelRu') ?? '',
      labelEn: getValue(row, 'itemLabelEn') ?? '',
      source: 'Wikidata:P2044',
      domain: type.domain,
      unitRu: 'м',
      unitEn: 'm',
      metricRu: 'Высота',
      metricEn: 'elevation',
      entityKindRu: type.ru,
      entityKindEn: type.en,
      typeQid: type.typeQid,
      typePriority: type.typePriority,
      sitelinks,
      year: undefined,
    })
  }

  for (const row of populationRows) {
    const qid = extractQid(getValue(row, 'item'))
    const type = getEntityType(row, 'Q6256')
    const value = Number(getValue(row, 'value'))
    const sitelinks = parseSitelinks(row, MIN_SITELINKS.populationCountries)
    if (
      qid === null ||
      type === null ||
      !Number.isFinite(value) ||
      value <= 0 ||
      sitelinks < MIN_SITELINKS.populationCountries
    ) {
      continue
    }
    numericCandidates.push({
      qid,
      propertyId: 'P1082',
      value,
      labelRu: getValue(row, 'itemLabelRu') ?? '',
      labelEn: getValue(row, 'itemLabelEn') ?? '',
      source: 'Wikidata:P1082',
      domain: type.domain,
      unitRu: 'чел.',
      unitEn: 'people',
      metricRu: 'Население',
      metricEn: 'population',
      entityKindRu: type.ru,
      entityKindEn: type.en,
      typeQid: type.typeQid,
      typePriority: type.typePriority,
      sitelinks,
      year: parseIsoYear(getValue(row, 'pointInTime')),
    })
  }

  for (const row of lengthRows) {
    const qid = extractQid(getValue(row, 'item'))
    const type = getEntityType(row, 'Q4022')
    const value = Number(getValue(row, 'value'))
    const sitelinks = parseSitelinks(row, MIN_SITELINKS.lengthRivers)
    if (
      qid === null ||
      type === null ||
      !Number.isFinite(value) ||
      value <= 50 ||
      value >= 10000 ||
      sitelinks < MIN_SITELINKS.lengthRivers
    ) {
      continue
    }
    numericCandidates.push({
      qid,
      propertyId: 'P2043',
      value,
      labelRu: getValue(row, 'itemLabelRu') ?? '',
      labelEn: getValue(row, 'itemLabelEn') ?? '',
      source: 'Wikidata:P2043',
      domain: type.domain,
      unitRu: 'км',
      unitEn: 'km',
      metricRu: 'Длина',
      metricEn: 'length',
      entityKindRu: type.ru,
      entityKindEn: type.en,
      typeQid: type.typeQid,
      typePriority: type.typePriority,
      sitelinks,
      year: undefined,
    })
  }

  const numericByKey = new Map()
  for (const candidate of numericCandidates) {
    if (candidate.labelRu.trim().length === 0 || candidate.labelEn.trim().length === 0) {
      continue
    }

    const key = `${candidate.propertyId}:${candidate.qid}`
    const existing = numericByKey.get(key)
    if (existing === undefined) {
      numericByKey.set(key, candidate)
      continue
    }
    numericByKey.set(key, pickBetterNumericCandidate(existing, candidate))
  }

  return Array.from(numericByKey.values())
}

function toFactId(qid, propertyId, multiplierIndex) {
  return `fact-wd-${propertyId.toLowerCase()}-${qid.toLowerCase()}-m${String(multiplierIndex + 1).padStart(2, '0')}`
}

function buildThresholdFacts(rows) {
  const facts = []
  for (const row of rows) {
    for (const [index, multiplier] of THRESHOLD_MULTIPLIERS.entries()) {
      const delta = Math.abs(multiplier - 1)
      if (delta < MIN_DELTA || delta > MAX_DELTA) {
        continue
      }

      const rawThreshold = row.value * multiplier
      const threshold = roundThresholdByScale(rawThreshold)
      if (!Number.isFinite(threshold) || threshold <= 0 || threshold === row.value) {
        continue
      }

      const answer = row.value > threshold ? 1 : 0
      const promptRu = toPromptRu(
        row.metricRu,
        row.entityKindRu,
        row.labelRu,
        threshold,
        row.unitRu,
        row.year,
      )
      const promptEn = toPromptEn(
        row.metricEn,
        row.entityKindEn,
        row.labelEn,
        threshold,
        row.unitEn,
        row.year,
      )

      facts.push({
        id: toFactId(row.qid, row.propertyId, index),
        prompt: {
          ru: promptRu,
          en: promptEn,
        },
        answer,
        domain: row.domain,
        difficulty: difficultyFromDelta(delta),
        tags: [
          'generated',
          'wikidata',
          'threshold',
          row.propertyId.toLowerCase(),
          row.metricEn,
          row.domain,
        ],
        factKind: 'threshold',
        isWarmup: false,
        source: row.source,
        meta: {
          qid: row.qid,
          property: row.propertyId,
          trueValue: Number(row.value.toFixed(6)),
          threshold: Number(threshold.toFixed(6)),
          unit: row.unitEn,
          year: row.year,
          entityType: row.typeQid,
          sitelinks: row.sitelinks,
        },
      })
    }
  }

  const byId = new Map()
  for (const fact of facts) {
    if (!byId.has(fact.id)) {
      byId.set(fact.id, fact)
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
}

const HISTORY_PAIR_OFFSETS = [1, 2, 3, 4, 5, 6, 8, 10, 12, 15]
const MAX_HISTORY_FACTS = 700

function historyDifficultyFromYearGap(gapYears) {
  if (gapYears < 6) {
    return 5
  }
  if (gapYears < 12) {
    return 4
  }
  return 3
}

function buildHistoryFacts(people) {
  const sorted = [...people].sort(
    (a, b) => a.birthYear - b.birthYear || a.qid.localeCompare(b.qid),
  )
  const facts = []

  for (let i = 0; i < sorted.length; i += 1) {
    const left = sorted[i]
    for (const offset of HISTORY_PAIR_OFFSETS) {
      const j = i + offset
      if (j >= sorted.length) {
        continue
      }
      const right = sorted[j]
      const gapYears = Math.abs(left.birthYear - right.birthYear)
      if (gapYears < 3 || gapYears > 120) {
        continue
      }

      const useNaturalOrder = (i + offset) % 2 === 0
      const first = useNaturalOrder ? left : right
      const second = useNaturalOrder ? right : left
      const answer = first.birthYear < second.birthYear ? 1 : 0

      facts.push({
        id: `fact-wd-p569-${first.qid.toLowerCase()}-${second.qid.toLowerCase()}`,
        prompt: {
          ru: `Исторический деятель ${first.labelRu} родился раньше, чем исторический деятель ${second.labelRu}.`,
          en: `Historical figure ${first.labelEn} was born earlier than historical figure ${second.labelEn}.`,
        },
        answer,
        domain: 'history',
        difficulty: historyDifficultyFromYearGap(gapYears),
        tags: ['generated', 'wikidata', 'history', 'comparison', 'birth-date', 'p569'],
        factKind: 'static',
        isWarmup: false,
        source: 'Wikidata:P569',
      })

      if (facts.length >= MAX_HISTORY_FACTS) {
        break
      }
    }
    if (facts.length >= MAX_HISTORY_FACTS) {
      break
    }
  }

  const byId = new Map()
  for (const fact of facts) {
    if (!byId.has(fact.id)) {
      byId.set(fact.id, fact)
    }
  }
  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
}

function summarizeRawQueries(areaRows, elevationRows, populationRows, lengthRows, historyCount) {
  return [
    { name: 'area_countries', propertyId: 'P2046', rawRows: areaRows.length },
    { name: 'elevation_cities', propertyId: 'P2044', rawRows: elevationRows.length },
    { name: 'population_countries', propertyId: 'P1082', rawRows: populationRows.length },
    { name: 'length_rivers', propertyId: 'P2043', rawRows: lengthRows.length },
    { name: 'history_birth_people', propertyId: 'P569', rawRows: historyCount },
  ]
}

async function loadRowsFromQueryCaches() {
  const states = await Promise.all(
    QUERY_SPECS.map(async (spec) => {
      const state = await readQueryCache(spec.name)
      const rows =
        Array.isArray(state.rows) && state.rows.length > 0
          ? state.rows
          : await readLegacyRows(spec.name)
      return { spec, rows }
    }),
  )
  const byName = new Map(
    states.map((entry) => [entry.spec.name, entry.rows]),
  )

  const areaRows = byName.get('area_countries') ?? []
  const elevationRows = byName.get('elevation_cities') ?? []
  const populationRows = byName.get('population_countries') ?? []
  const lengthRows = await readLegacyRows('length_rivers_or_roads')
  const numericRows = await enrichNumericRowsWithEntityData(
    normalizeRows(areaRows, elevationRows, populationRows, lengthRows),
  )
  const historyPeople = await fetchHistoryPeopleFromWikidataApi()

  return {
    numericRows,
    historyPeople,
    queries: summarizeRawQueries(
      areaRows,
      elevationRows,
      populationRows,
      lengthRows,
      historyPeople.length,
    ),
  }
}

async function loadOfflineFactBank() {
  try {
    const raw = await readFile(offlineFactsPath, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch (error) {
    console.warn(`Offline fact bank unavailable: ${String(error)}`)
    return []
  }
}

function mergeFactBanks(preferredFacts, fallbackFacts) {
  const byId = new Map()

  for (const fact of preferredFacts) {
    if (typeof fact?.id === 'string') {
      byId.set(fact.id, fact)
    }
  }

  for (const fact of fallbackFacts) {
    if (typeof fact?.id === 'string' && !byId.has(fact.id)) {
      byId.set(fact.id, fact)
    }
  }

  return Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id))
}

async function collectSourceRows() {
  if (process.env.WDQS_DISABLE === '1') {
    console.warn('WDQS disabled via WDQS_DISABLE=1, using local query cache state.')
    const cached = await loadRowsFromQueryCaches()
    return {
      numericRows: cached.numericRows,
      historyPeople: cached.historyPeople,
      mode: 'cached-forced',
      queries: cached.queries,
    }
  }

  try {
    console.log(`Fetching Wikidata rows for threshold facts (concurrency=${WDQS_MAX_CONCURRENCY})...`)

    const rawRowsByName = new Map()
    for (const [index, spec] of QUERY_SPECS.entries()) {
      const rows = await runKeysetQueryWithResume(spec.name, spec.queryBuilder)
      rawRowsByName.set(spec.name, rows)
      if (index < QUERY_SPECS.length - 1) {
        await sleep(REQUEST_DELAY_MS)
      }
    }

    const areaRows = rawRowsByName.get('area_countries') ?? []
    const elevationRows = rawRowsByName.get('elevation_cities') ?? []
    const populationRows = rawRowsByName.get('population_countries') ?? []
    const lengthRows = await readLegacyRows('length_rivers_or_roads')
    const numericRows = await enrichNumericRowsWithEntityData(
      normalizeRows(areaRows, elevationRows, populationRows, lengthRows),
    )
    const historyPeople = await fetchHistoryPeopleFromWikidataApi()

    return {
      numericRows,
      historyPeople,
      mode: 'live',
      queries: summarizeRawQueries(
        areaRows,
        elevationRows,
        populationRows,
        lengthRows,
        historyPeople.length,
      ),
    }
  } catch (error) {
    console.warn(`WDQS unstable, switching to cached query state: ${String(error)}`)
    const cached = await loadRowsFromQueryCaches()
    return {
      numericRows: cached.numericRows,
      historyPeople: cached.historyPeople,
      mode:
        cached.numericRows.length > 0 || cached.historyPeople.length > 0
          ? 'cached-partial'
          : 'cached-empty',
      queries: cached.queries,
    }
  }
}

async function main() {
  validateWdqsRequestConfig()
  assert(
    WDQS_MAX_CONCURRENCY >= 1 && WDQS_MAX_CONCURRENCY <= WDQS_SOFT_CONCURRENCY_CAP,
    `WDQS_MAX_CONCURRENCY must be between 1 and ${WDQS_SOFT_CONCURRENCY_CAP}`,
  )
  const collected = await collectSourceRows()
  const generatedThresholdFacts = buildThresholdFacts(collected.numericRows)
  const generatedHistoryFacts = buildHistoryFacts(collected.historyPeople)
  const generatedFacts = [...generatedThresholdFacts, ...generatedHistoryFacts]
  let facts = generatedFacts
  let supplementedFromOffline = 0

  if (generatedFacts.length < MIN_FACTS_TARGET) {
    const offlineFacts = await loadOfflineFactBank()
    facts = mergeFactBanks(generatedFacts, offlineFacts)
    supplementedFromOffline = Math.max(0, facts.length - generatedFacts.length)
  }

  const mode =
    supplementedFromOffline > 0 ? `${collected.mode}+offline-fallback` : collected.mode

  assert(
    facts.length >= MIN_FACTS_TARGET,
    `Generated fact bank too small: ${facts.length} (expected >= ${MIN_FACTS_TARGET})`,
  )

  await mkdir(outDir, { recursive: true })
  await writeFile(
    path.join(outDir, 'facts_wikidata.json'),
    `${JSON.stringify(facts, null, 2)}\n`,
    'utf8',
  )
  await writeFile(
    path.join(outDir, 'build_meta.json'),
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: 'wikidata',
        mode,
        totalFacts: facts.length,
        generatedFromRows: generatedFacts.length,
        generatedThresholdFacts: generatedThresholdFacts.length,
        generatedHistoryFacts: generatedHistoryFacts.length,
        supplementedFromOffline,
        queries: collected.queries.map((entry) => ({
          ...entry,
          producedFactsEstimate:
            entry.propertyId === 'P569'
              ? Math.min(MAX_HISTORY_FACTS, Math.floor(entry.rawRows * 2))
              : THRESHOLD_MULTIPLIERS.length * entry.rawRows,
        })),
      },
      null,
      2,
    )}\n`,
    'utf8',
  )

  console.log(`Generated facts: ${facts.length}`)
  for (const entry of collected.queries) {
    console.log(`${entry.name}: raw=${entry.rawRows}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
