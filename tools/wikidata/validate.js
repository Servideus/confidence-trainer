import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataDir = path.resolve(__dirname, '../../src/data/generated')

const MIN_FACTS = 1000
const MIN_THRESHOLD_SITELINKS = 20

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function isDifficulty(value) {
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 5
}

function isDomain(value) {
  return (
    value === 'animals' ||
    value === 'history' ||
    value === 'geography' ||
    value === 'science' ||
    value === 'culture' ||
    value === 'tech' ||
    value === 'economy'
  )
}

function looksLikeTrivialNumericComparison(prompt) {
  const en = /^\s*(?:the number\s+)?\d+(?:[.,]\d+)?\s*(?:is\s+)?(?:greater than|less than|>|<)\s*\d+(?:[.,]\d+)?\b/i
  const ru = /^\s*\d+(?:[.,]\d+)?\s*(?:больше|меньше|>|<)\s*\d+(?:[.,]\d+)?\b/i
  return en.test(prompt) || ru.test(prompt)
}

function hasRuObjectType(prompt) {
  return /(страны|города|горы|реки|озера|острова|континента|исторический деятель)/iu.test(prompt)
}

async function loadJson(fileName) {
  const filePath = path.join(dataDir, fileName)
  const raw = await readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

function validateFactRow(item, index, seen) {
  assert(typeof item === 'object' && item !== null, `fact row #${index} must be object`)
  assert(typeof item.id === 'string' && item.id.length > 0, `fact row #${index} id`)
  assert(!seen.has(item.id), `duplicate fact id: ${item.id}`)
  seen.add(item.id)

  assert(typeof item.prompt === 'object' && item.prompt !== null, `fact ${item.id} prompt object`)
  assert(typeof item.prompt.ru === 'string' && item.prompt.ru.trim().length > 0, `fact ${item.id} prompt.ru`)
  assert(typeof item.prompt.en === 'string' && item.prompt.en.trim().length > 0, `fact ${item.id} prompt.en`)
  assert(item.prompt.ru.includes('????') === false, `fact ${item.id} ru prompt contains ????`)
  assert(/[А-Яа-яЁё]/.test(item.prompt.ru), `fact ${item.id} ru prompt must contain cyrillic`)
  assert(!looksLikeTrivialNumericComparison(item.prompt.ru), `fact ${item.id} trivial ru comparison`)
  assert(!looksLikeTrivialNumericComparison(item.prompt.en), `fact ${item.id} trivial en comparison`)

  assert(item.answer === 0 || item.answer === 1, `fact ${item.id} answer`)
  assert(Array.isArray(item.tags), `fact ${item.id} tags`)
  assert(isDomain(item.domain), `fact ${item.id} domain`)
  assert(isDifficulty(item.difficulty), `fact ${item.id} difficulty`)
  assert(item.factKind === 'threshold' || item.factKind === 'static', `fact ${item.id} factKind`)

  if (item.factKind === 'threshold') {
    assert(typeof item.meta === 'object' && item.meta !== null, `fact ${item.id} meta`)
    assert(typeof item.meta.qid === 'string' && /^Q\d+$/.test(item.meta.qid), `fact ${item.id} meta.qid`)
    assert(
      typeof item.meta.property === 'string' && /^P\d+$/.test(item.meta.property),
      `fact ${item.id} meta.property`,
    )
    assert(
      typeof item.meta.trueValue === 'number' && Number.isFinite(item.meta.trueValue),
      `fact ${item.id} meta.trueValue`,
    )
    assert(
      typeof item.meta.threshold === 'number' && Number.isFinite(item.meta.threshold),
      `fact ${item.id} meta.threshold`,
    )
    assert(typeof item.meta.unit === 'string' && item.meta.unit.trim().length > 0, `fact ${item.id} meta.unit`)
    assert(
      typeof item.meta.entityType === 'string' && /^Q\d+$/.test(item.meta.entityType),
      `fact ${item.id} meta.entityType`,
    )
    assert(
      typeof item.meta.sitelinks === 'number' &&
        Number.isFinite(item.meta.sitelinks) &&
        item.meta.sitelinks >= MIN_THRESHOLD_SITELINKS,
      `fact ${item.id} meta.sitelinks`,
    )
  }
}

function validateFacts(facts) {
  assert(Array.isArray(facts), 'facts_wikidata.json must be an array')
  assert(facts.length >= MIN_FACTS, `facts_wikidata.json must contain at least ${MIN_FACTS} rows`)

  const seen = new Set()
  let easy = 0
  let typedRu = 0
  const domains = new Set()

  for (const [index, item] of facts.entries()) {
    validateFactRow(item, index, seen)
    if (item.difficulty <= 2) {
      easy += 1
    }
    if (hasRuObjectType(item.prompt.ru)) {
      typedRu += 1
    }
    domains.add(item.domain)
  }

  const easyShare = easy / facts.length
  const typedRuShare = typedRu / facts.length
  assert(easyShare <= 0.1, `easy fact share is too high: ${easyShare.toFixed(3)}`)
  assert(typedRuShare >= 0.95, `typed ru prompt share is too low: ${typedRuShare.toFixed(3)}`)
  assert(domains.has('geography'), 'bank must contain geography domain')
  assert(domains.has('history'), 'bank must contain history domain')

  return {
    count: facts.length,
    easyShare,
    typedRuShare,
  }
}

function validateMeta(meta, factCount) {
  assert(typeof meta === 'object' && meta !== null, 'build_meta.json must be object')
  assert(typeof meta.generatedAt === 'string', 'build_meta.generatedAt must be string')
  assert(meta.source === 'wikidata', 'build_meta.source must be "wikidata"')
  assert(meta.totalFacts === factCount, 'build_meta.totalFacts mismatch')
  assert(Array.isArray(meta.queries), 'build_meta.queries must be array')
}

async function main() {
  const [facts, meta] = await Promise.all([
    loadJson('facts_wikidata.json'),
    loadJson('build_meta.json'),
  ])

  const summary = validateFacts(facts)
  validateMeta(meta, summary.count)

  console.log(
    `Validation passed: facts=${summary.count}, easyShare=${summary.easyShare.toFixed(3)}, typedRuShare=${summary.typedRuShare.toFixed(3)}`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
