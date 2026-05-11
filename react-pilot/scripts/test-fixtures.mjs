#!/usr/bin/env node
/**
 * Parses every fixture XML through the full import → merge → validate pipeline
 * and reports field coverage, sensor rows, provenance stamp, and validation issues.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}

const probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const elementProto = Object.getPrototypeOf(probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
  Object.defineProperty(elementProto, 'children', {
    configurable: true, enumerable: true,
    get() { return Array.from(this.childNodes || []).filter(n => n && n.nodeType === 1) },
  })
}

const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
const { defaultPilotState, mergeLoadedPilotState, validatePilotState } = await import(path.join(ROOT, 'src/lib/pilotValidation.js'))
const { applyPilotAutoFixes } = await import(path.join(ROOT, 'src/lib/pilotAutoFix.js'))

const FIXTURE_DIR = path.join(ROOT, 'fixtures/mission')
const xmlFiles = fs.readdirSync(FIXTURE_DIR).filter(f => f.endsWith('.xml')).sort()

const KEY_FIELDS = [
  ['mission','fileId'],['mission','title'],['mission','abstract'],['mission','purpose'],
  ['mission','startDate'],['mission','endDate'],
  ['mission','west'],['mission','east'],['mission','south'],['mission','north'],
  ['mission','vmin'],['mission','vmax'],
  ['mission','individualName'],['mission','org'],['mission','email'],
  ['mission','status'],['mission','language'],['mission','doi'],['mission','accession'],
  ['mission','dataLicensePreset'],
  ['platform','platformId'],['platform','platformDesc'],['platform','platformType'],
]

let hasRealErrors = false
const results = []

for (const file of xmlFiles) {
  const xml = fs.readFileSync(path.join(FIXTURE_DIR, file), 'utf8')
  let parseResult, merged, validated

  try {
    parseResult = importPilotPartialStateFromXml(xml, { originalFilename: file })
  } catch(e) {
    results.push({ file, status: 'PARSE_ERROR', error: `${e.message}\n${e.stack?.split('\n').slice(1,3).join(' ')}` })
    hasRealErrors = true
    continue
  }

  if (!parseResult || !parseResult.partial) {
    results.push({ file, status: 'PARSE_ERROR', error: `importPilotPartialStateFromXml returned no partial (ok=${parseResult?.ok})` })
    hasRealErrors = true
    continue
  }

  try {
    const base = defaultPilotState()
    merged = mergeLoadedPilotState(base, parseResult.partial)
    if (!merged) throw new Error('mergeLoadedPilotState returned falsy')
    const { pilot: fixed } = applyPilotAutoFixes('lenient', merged)
    validated = validatePilotState('lenient', fixed)
    if (!validated) throw new Error('validatePilotState returned falsy')
  } catch(e) {
    results.push({ file, status: 'MERGE_ERROR', error: `${e.message}\n${e.stack?.split('\n').slice(1,3).join(' ')}` })
    hasRealErrors = true
    continue
  }

  const fields = {}
  for (const [section, key] of KEY_FIELDS) {
    const val = merged[section]?.[key]
    if (val !== undefined && val !== '' && val !== null) {
      fields[`${section}.${key}`] = String(val).slice(0, 50)
    }
  }

  const sensors = (merged.sensors || [])
    .filter(s => s.sensorId || s.modelId || s.type)
    .map(s => `${s.type || '?'} / ${s.modelId || s.sensorId || '?'} / ${s.variable || '?'}`)

  const kwCounts = Object.fromEntries(
    Object.entries(merged.keywords || {})
      .filter(([,v]) => Array.isArray(v) && v.length)
      .map(([k,v]) => [k, v.length])
  )

  const issues = validated.issues || []
  const errors = issues.filter(i => i.severity === 'e').map(i => `${i.field}: ${i.message}`)
  const warnings = issues.filter(i => i.severity === 'w').map(i => `${i.field}: ${i.message}`)

  const prov = merged.sourceProvenance
  const provStr = prov
    ? `${prov.sourceType}${prov.originalFilename ? ' | ' + prov.originalFilename : ''}${prov.importedAt ? ' | imported ' + new Date(prov.importedAt).toLocaleTimeString() : ''}`
    : '(none)'

  results.push({ file, status: errors.length ? 'HAS_ERRORS' : 'CLEAN', fields, sensors, kwCounts, prov: provStr, errors, warnings })
}

for (const r of results) {
  const badge = r.status === 'CLEAN' ? '✅' : r.status === 'HAS_ERRORS' ? '⚠️ ' : '💥'
  console.log(`\n${badge}  ${r.file}`)

  if (r.error) {
    console.log(`    PIPELINE ERROR: ${r.error}`)
    continue
  }

  console.log(`    provenance  : ${r.prov}`)

  const populated = Object.entries(r.fields)
  const missing   = KEY_FIELDS.map(([s,k])=>`${s}.${k}`).filter(f => !r.fields[f])

  console.log(`    fields      : ${populated.length}/${KEY_FIELDS.length} populated`)
  for (const [k,v] of populated) {
    console.log(`                  ${k.padEnd(28)} = ${v}`)
  }
  if (missing.length) {
    console.log(`    missing     : ${missing.join('  ')}`)
  }

  if (r.sensors.length) {
    console.log(`    sensors(${r.sensors.length})  :`)
    r.sensors.forEach(s => console.log(`                  ${s}`))
  } else {
    console.log(`    sensors     : (none parsed)`)
  }

  if (Object.keys(r.kwCounts).length) {
    console.log(`    keywords    : ${Object.entries(r.kwCounts).map(([k,n])=>`${k}:${n}`).join('  ')}`)
  }

  if (r.errors.length) {
    console.log(`    ERRORS (${r.errors.length}):`)
    r.errors.forEach(e => console.log(`      ✗ ${e}`))
  }
  if (r.warnings.length) {
    console.log(`    warnings(${r.warnings.length}):`)
    r.warnings.slice(0, 4).forEach(w => console.log(`      ~ ${w}`))
    if (r.warnings.length > 4) console.log(`      ... +${r.warnings.length - 4} more`)
  }
}

console.log('\n' + '─'.repeat(68))
const clean = results.filter(r => r.status === 'CLEAN').length
const withErrors = results.filter(r => r.status === 'HAS_ERRORS').length
const crashed = results.filter(r => r.status === 'PARSE_ERROR' || r.status === 'MERGE_ERROR').length
console.log(`Fixtures: ${results.length}  ✅ clean: ${clean}  ⚠️  validation errors: ${withErrors}  💥 crash: ${crashed}`)
if (hasRealErrors) {
  console.log('💥  PIPELINE CRASHES DETECTED — fix before demo')
  process.exit(1)
} else {
  console.log('✅  No parser/merge crashes. Validation errors above are expected for demo error fixtures.')
}
