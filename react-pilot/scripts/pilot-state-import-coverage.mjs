#!/usr/bin/env node
/**
 * After XML import → merge → sanitize, classify every leaf path in `pilotState` as:
 * - **filled** — semantically has content (strings non-blank, arrays with items, booleans, etc.)
 * - **empty** — still blank / null / empty array
 * - **sameAsDefault** — equals `defaultPilotState()` at that path (import did not change the seed)
 *
 * Forms bind to these paths; this answers “what did import actually fill vs leave empty?”
 *
 * Usage:
 *   node scripts/pilot-state-import-coverage.mjs
 *   node scripts/pilot-state-import-coverage.mjs --xml fixtures/mission/navy-uxs-gmi-template-2026.xml
 *   node scripts/pilot-state-import-coverage.mjs --xml path/to/file.xml --out reports/my-coverage.json
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(ROOT, '..')

function installXmldomChildrenPolyfill() {
  const probe = new DOMParser().parseFromString('<a><b/></a>', 'application/xml').documentElement
  const proto = Object.getPrototypeOf(probe)
  if (Object.getOwnPropertyDescriptor(proto, 'children')) return
  Object.defineProperty(proto, 'children', {
    get() {
      const out = []
      const nodes = this.childNodes || []
      for (let i = 0; i < nodes.length; i += 1) {
        if (nodes[i] && nodes[i].nodeType === 1) out.push(nodes[i])
      }
      return out
    },
  })
}

installXmldomChildrenPolyfill()
globalThis.DOMParser = DOMParser

/**
 * @param {unknown} val
 * @param {string} path
 */
function isSemanticEmpty(val, path) {
  if (val === undefined || val === null) return true
  if (typeof val === 'string') return val.trim() === ''
  if (typeof val === 'boolean') return false
  if (typeof val === 'number') return false
  if (Array.isArray(val)) {
    if (val.length === 0) return true
    return false
  }
  if (typeof val === 'object') return Object.keys(val).length === 0
  return false
}

/**
 * @param {unknown} a
 * @param {unknown} b
 */
function deepEqual(a, b) {
  if (a === b) return true
  if (a === null || b === null || a === undefined || b === undefined) return a === b
  if (typeof a !== typeof b) return false
  if (typeof a === 'string' && typeof b === 'string') return a === b
  if (typeof a === 'number' || typeof a === 'boolean') return a === b
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(/** @type {object} */ (a)).sort()
    const kb = Object.keys(/** @type {object} */ (b)).sort()
    if (ka.length !== kb.length) return false
    for (let i = 0; i < ka.length; i += 1) {
      if (ka[i] !== kb[i]) return false
      if (!deepEqual(/** @type {Record<string, unknown>} */ (a)[ka[i]], /** @type {Record<string, unknown>} */ (b)[ka[i]]))
        return false
    }
    return true
  }
  return false
}

/**
 * Flatten pilotState to leaf paths (objects expanded; arrays of objects use [i] segments).
 * @param {unknown} obj
 * @param {string} prefix
 * @returns {Array<{ path: string, value: unknown }>}
 */
function flattenPilot(obj, prefix = '') {
  /** @type {Array<{ path: string, value: unknown }>} */
  const rows = []
  if (obj === null || obj === undefined) {
    rows.push({ path: prefix || '(null)', value: obj })
    return rows
  }
  if (Array.isArray(obj)) {
    if (obj.length === 0) {
      rows.push({ path: prefix, value: [] })
      return rows
    }
    for (let i = 0; i < obj.length; i += 1) {
      const item = obj[i]
      const p = `${prefix}[${i}]`
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        rows.push(...flattenPilot(item, p))
      } else {
        rows.push({ path: p, value: item })
      }
    }
    return rows
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj)
    if (keys.length === 0) {
      rows.push({ path: prefix, value: {} })
      return rows
    }
    for (const k of keys) {
      const p = prefix ? `${prefix}.${k}` : k
      const v = /** @type {Record<string, unknown>} */ (obj)[k]
      if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
        rows.push(...flattenPilot(v, p))
      } else if (Array.isArray(v)) {
        rows.push(...flattenPilot(v, p))
      } else {
        rows.push({ path: p, value: v })
      }
    }
    return rows
  }
  rows.push({ path: prefix, value: obj })
  return rows
}

/** @param {string} path */
function stepBucket(path) {
  if (path.startsWith('mission.') || path === 'mission') return '1-mission'
  if (path.startsWith('platform.')) return '2-platform'
  if (path.startsWith('sensors')) return '3-sensors'
  if (path.startsWith('spatial.')) return '4-spatial'
  if (path.startsWith('keywords')) return '5-keywords'
  if (path.startsWith('distribution.')) return '6-distribution'
  if (path.startsWith('sourceProvenance.') || path.startsWith('mode')) return 'meta'
  return 'other'
}

function parseArgs(argv) {
  let xmlArg = ''
  let outJson = ''
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--xml') xmlArg = path.resolve(ROOT, argv[++i] || '')
    else if (a === '--out') outJson = path.resolve(argv[++i] || '')
  }
  const defaults = [
    path.join(ROOT, 'fixtures/mission/navy-uxs-gmi-template-2026.xml'),
    path.join(REPO_ROOT, 'NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml'),
    path.join(ROOT, 'fixtures/mission/navy-uxs-swarm-clean.xml'),
  ]
  const xmlPath = xmlArg || defaults.find((p) => fs.existsSync(p)) || ''
  return { xmlPath, outJson }
}

const { xmlPath, outJson } = parseArgs(process.argv.slice(2))

if (!xmlPath || !fs.existsSync(xmlPath)) {
  console.error('Usage: node scripts/pilot-state-import-coverage.mjs [--xml <file.xml>] [--out <report.json>]')
  process.exit(1)
}

const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
const { defaultPilotState, mergeLoadedPilotState, sanitizePilotState } = await import(
  path.join(ROOT, 'src/lib/pilotValidation.js'),
)

const rawXml = fs.readFileSync(xmlPath, 'utf8')
const parsed = importPilotPartialStateFromXml(rawXml)
if (!parsed.ok) {
  console.error('Import failed:', parsed.error)
  process.exit(1)
}

/** One snapshot so `sensors[0].localId` and other seed noise match the merge baseline. */
const defaultSnapshot = defaultPilotState()
const merged = sanitizePilotState(
  mergeLoadedPilotState(JSON.parse(JSON.stringify(defaultSnapshot)), parsed.partial),
)
const base = defaultSnapshot

const flatM = flattenPilot(merged)
const flatD = flattenPilot(base)

/** @type {Map<string, unknown>} */
const mapD = new Map(flatD.map((r) => [r.path, r.value]))
/** @type {Map<string, unknown>} */
const mapM = new Map(flatM.map((r) => [r.path, r.value]))

const allPaths = [...new Set([...mapD.keys(), ...mapM.keys()])].sort()

/** @type {Array<{ path: string, merged: unknown, default: unknown, filled: boolean, sameAsDefault: boolean }>} */
const rows = []
let filled = 0
let empty = 0
let sameAsDefault = 0

for (const p of allPaths) {
  const vm = mapM.get(p)
  const vd = mapD.get(p)
  const eq = deepEqual(vm, vd)
  const em = isSemanticEmpty(vm, p)
  if (eq) sameAsDefault += 1
  if (em) empty += 1
  else filled += 1
  rows.push({
    path: p,
    merged: vm,
    default: vd,
    filled: !em,
    sameAsDefault: eq,
  })
}

const byStep = {}
for (const r of rows) {
  const b = stepBucket(r.path)
  if (!byStep[b]) byStep[b] = { filled: 0, empty: 0, sameAsDefault: 0, total: 0 }
  byStep[b].total += 1
  if (r.filled) byStep[b].filled += 1
  else byStep[b].empty += 1
  if (r.sameAsDefault) byStep[b].sameAsDefault += 1
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceXml: path.relative(ROOT, xmlPath),
  importWarnings: parsed.warnings || [],
  summary: {
    leafPaths: allPaths.length,
    filled,
    empty,
    sameAsDefault,
    changedFromDefault: rows.filter((r) => !r.sameAsDefault).length,
  },
  byStep,
  emptyPaths: rows.filter((r) => !r.filled).map((r) => r.path),
  filledPaths: rows.filter((r) => r.filled).map((r) => r.path),
  changedPaths: rows.filter((r) => !r.sameAsDefault).map((r) => ({ path: r.path, merged: r.merged })),
  detailSample: rows.slice(0, 400),
  truncatedDetail: rows.length > 400,
}

const baseName = path.basename(xmlPath, '.xml').replace(/[^a-z0-9_-]+/gi, '-')
const outDir = path.join(ROOT, 'reports/pilot-import-coverage')
fs.mkdirSync(outDir, { recursive: true })
const jsonPath = outJson || path.join(outDir, `${baseName}-coverage.json`)

const mdLines = [
  `# Pilot state coverage after XML import`,
  ``,
  `- **Source:** \`${report.sourceXml}\``,
  `- **Leaf paths:** ${report.summary.leafPaths}`,
  `- **Filled (has semantic content):** ${report.summary.filled}`,
  `- **Empty:** ${report.summary.empty}`,
  `- **Unchanged from defaultPilotState():** ${report.summary.sameAsDefault}`,
  `- **Changed from default:** ${report.summary.changedFromDefault}`,
  ``,
  `## By wizard bucket`,
  ``,
  `| Bucket | Paths | Filled | Empty | Same as default |`,
  `|--------|------:|-------:|------:|----------------:|`,
]

for (const [k, v] of Object.entries(byStep).sort()) {
  mdLines.push(`| ${k} | ${v.total} | ${v.filled} | ${v.empty} | ${v.sameAsDefault} |`)
}

mdLines.push(
  ``,
  `_“Same as default” includes seeded defaults that match XML (e.g. bbox −180…90). Use **changedPaths** in JSON for strict diff._`,
  ``,
  `## Empty paths (${report.emptyPaths.length})`,
  ``,
  report.emptyPaths.length ? report.emptyPaths.map((p) => `- \`${p}\``).join('\n') : '_None_',
)

fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
fs.writeFileSync(jsonPath.replace(/\.json$/, '.md'), `${mdLines.join('\n')}\n`, 'utf8')

console.log(`Source: ${xmlPath}`)
console.log(
  `Leaf paths: ${report.summary.leafPaths} | filled: ${report.summary.filled} | empty: ${report.summary.empty} | unchanged vs defaultPilotState: ${report.summary.sameAsDefault} | changed: ${report.summary.changedFromDefault}`,
)
console.log(`Wrote ${jsonPath}`)
