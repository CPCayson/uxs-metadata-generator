/**
 * Swarm: audit a raw ISO mission XML as it lands in the Mission form.
 * — importPilotPartialStateFromXml → mergeLoadedPilotState → validatePilotState (lenient/strict/catalog)
 * — groups blocking issues by wizard step for fix checklists
 *
 * Node needs DOMParser + iterable Element.children (browser has both; xmldom does not).
 *
 * Usage:
 *   node scripts/swarm/audit-mission-import.mjs
 *   node scripts/swarm/audit-mission-import.mjs --xml ../path/to/file.xml
 *   node scripts/swarm/audit-mission-import.mjs --report-out fixtures/mission/_import-audit.json
 *   node scripts/swarm/audit-mission-import.mjs --fail-on-errors   # exit 1 if catalog errCount > 0
 *
 * @module scripts/swarm/audit-mission-import
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')
const USX_ROOT = path.resolve(REACT_PILOT, '..')

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

const STEP_DEFS = [
  { id: 'mission', label: '1. Mission', match: (f) => f === 'mission' || f.startsWith('mission.') },
  { id: 'platform', label: '2. Platform', match: (f) => f.startsWith('platform.') },
  { id: 'sensors', label: '3. Sensors', match: (f) => f === 'sensors' || f.startsWith('sensors[') },
  { id: 'spatial', label: '4. Spatial', match: (f) => f.startsWith('spatial.') },
  { id: 'keywords', label: '5. Keywords', match: (f) => f === 'keywords' || f.startsWith('keywords.') },
  { id: 'distribution', label: '6. Distribution', match: (f) => f.startsWith('distribution.') },
]

function parseArgs(argv) {
  const out = {
    xmlPath: '',
    reportOut: path.join(REACT_PILOT, 'fixtures/mission/_import-audit-report.json'),
    failOnErrors: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--xml') out.xmlPath = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--report-out') out.reportOut = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--fail-on-errors') out.failOnErrors = true
  }
  if (!out.xmlPath) {
    const cleanFixture = path.join(REACT_PILOT, 'fixtures/mission/navy-uxs-swarm-clean.xml')
    const defaultNavy = path.join(
      USX_ROOT,
      'NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml',
    )
    out.xmlPath = fs.existsSync(cleanFixture) ? cleanFixture : ''
    if (!out.xmlPath && fs.existsSync(defaultNavy)) out.xmlPath = defaultNavy
  }
  return out
}

function nonEmptyKeys(obj) {
  if (!obj || typeof obj !== 'object') return []
  return Object.keys(obj).filter((k) => {
    const v = obj[k]
    if (v === undefined || v === null) return false
    if (typeof v === 'string') return v.trim() !== ''
    if (Array.isArray(v)) return v.length > 0
    if (typeof v === 'object') return Object.keys(v).length > 0
    return true
  })
}

function summarizeMappedState(state) {
  const kw = state.keywords && typeof state.keywords === 'object' ? state.keywords : {}
  return {
    mission: nonEmptyKeys(state.mission),
    platform: nonEmptyKeys(state.platform),
    spatial: nonEmptyKeys(state.spatial),
    keywordFacetCounts: Object.fromEntries(
      Object.entries(kw).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0]),
    ),
    sensorRows: Array.isArray(state.sensors) ? state.sensors.length : 0,
    distribution: nonEmptyKeys(state.distribution),
  }
}

function groupIssuesByStep(issues, severity = 'e') {
  /** @type {Record<string, { label: string, errors: Array<{ field: string, message: string, xpath?: string }> }>} */
  const by = {}
  for (const def of STEP_DEFS) {
    by[def.id] = { label: def.label, errors: [] }
  }
  const orphan = { label: 'Other', errors: [] }
  for (const iss of issues) {
    if (iss.severity !== severity) continue
    const f = String(iss.field || '')
    const def = STEP_DEFS.find((d) => d.match(f))
    const bucket = def ? by[def.id] : orphan
    bucket.errors.push({
      field: f,
      message: iss.message,
      ...(iss.xpath ? { xpath: iss.xpath } : {}),
    })
  }
  const out = { ...by }
  if (orphan.errors.length) out._other = orphan
  return out
}

function buildFixChecklist(byStepCatalog) {
  const rows = []
  for (const def of STEP_DEFS) {
    const bucket = byStepCatalog[def.id]
    if (!bucket?.errors?.length) continue
    for (const e of bucket.errors) {
      rows.push({ step: def.label, stepId: def.id, field: e.field, message: e.message })
    }
  }
  if (byStepCatalog._other?.errors?.length) {
    for (const e of byStepCatalog._other.errors) {
      rows.push({ step: 'Other', stepId: '_other', field: e.field, message: e.message })
    }
  }
  return rows
}

const args = parseArgs(process.argv.slice(2))

if (!args.xmlPath || !fs.existsSync(args.xmlPath)) {
  console.error('Usage: node scripts/swarm/audit-mission-import.mjs --xml <file.xml> [--report-out <path>] [--fail-on-errors]')
  console.error('Default navy template not found. Pass --xml explicitly.')
  process.exit(1)
}

const xml = fs.readFileSync(args.xmlPath, 'utf8')

const { importPilotPartialStateFromXml } = await import('../../src/lib/xmlPilotImport.js')
const { defaultPilotState, mergeLoadedPilotState, validatePilotState } = await import(
  '../../src/lib/pilotValidation.js',
)

const parsed = importPilotPartialStateFromXml(xml)
const report = {
  generatedAt: new Date().toISOString(),
  sourceFile: path.relative(REACT_PILOT, args.xmlPath),
  import: parsed.ok
    ? { ok: true, warnings: parsed.warnings || [] }
    : { ok: false, error: parsed.error, warnings: parsed.warnings || [] },
}

if (!parsed.ok) {
  fs.mkdirSync(path.dirname(args.reportOut), { recursive: true })
  fs.writeFileSync(args.reportOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.error(`Import failed: ${parsed.error}`)
  console.error(`Wrote ${args.reportOut}`)
  process.exit(1)
}

const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
report.mappedSummary = summarizeMappedState(merged)

const modes = ['lenient', 'strict', 'catalog']
report.validation = {}
for (const mode of modes) {
  const v = validatePilotState(mode, merged)
  report.validation[mode] = {
    errCount: v.errCount,
    warnCount: v.warnCount,
    byStep: groupIssuesByStep(v.issues, 'e'),
    issues: v.issues.map((i) => ({
      severity: i.severity,
      field: i.field,
      message: i.message,
      ...(i.xpath ? { xpath: i.xpath } : {}),
    })),
  }
}

report.fixChecklist = buildFixChecklist(report.validation.catalog.byStep)
report.catalogReady = report.validation.catalog.errCount === 0

fs.mkdirSync(path.dirname(args.reportOut), { recursive: true })
fs.writeFileSync(args.reportOut, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

console.log(`Wrote ${args.reportOut}`)
console.log(
  `Catalog: ${report.validation.catalog.errCount} errors, ${report.validation.catalog.warnCount} warnings | checklist rows: ${report.fixChecklist.length}`,
)

if (args.failOnErrors && report.validation.catalog.errCount > 0) {
  process.exit(1)
}
