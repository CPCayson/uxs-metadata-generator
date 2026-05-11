#!/usr/bin/env node
/**
 * Batch XML audit — parse → merge → validate using the same code path as the live app.
 *
 * Usage:
 *   node scripts/audit-xml.mjs path/to/file.xml [file2.xml ...]
 *   node scripts/audit-xml.mjs "public/demo-records/*.xml"
 *   node scripts/audit-xml.mjs path/to/file.xml --patch scripts/patches/mdbc.patch.json
 *   node scripts/audit-xml.mjs path/to/file.xml --mode strict
 *   node scripts/audit-xml.mjs path/to/file.xml --json
 *   node scripts/audit-xml.mjs path/to/file.xml --fields
 *
 * Flags:
 *   --patch <file.json>             JSON partial-state to merge AFTER XML parse.
 *                                   XML fields always win; patch only fills gaps.
 *   --write-patch <file.json>       Instead of running, scaffold a blank patch file
 *                                   pre-populated with the error fields from every
 *                                   input XML so you know exactly what to fill in.
 *   --mode lenient|catalog|strict   validation mode (default: lenient)
 *   --json                          machine-readable JSON output
 *   --fields                        show every parsed field value (verbose)
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { DOMParser } from '@xmldom/xmldom'

// ─── Browser API polyfills ────────────────────────────────────────────────────

globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}
const _probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const _elProto = Object.getPrototypeOf(_probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(_elProto, 'children')) {
  Object.defineProperty(_elProto, 'children', {
    configurable: true, enumerable: true,
    get() { return Array.from(this.childNodes || []).filter(n => n?.nodeType === 1) },
  })
}

import {
  defaultPilotState,
  mergeLoadedPilotState,
  validatePilotState,
} from '../src/lib/pilotValidation.js'
import { importPilotPartialStateFromXml } from '../src/lib/xmlPilotImport.js'

// ─── CLI args ────────────────────────────────────────────────────────────────

const argv = process.argv.slice(2)

function popFlag(flag, hasArg = false) {
  const i = argv.indexOf(flag)
  if (i === -1) return hasArg ? null : false
  return hasArg ? argv.splice(i, 2)[1] : (argv.splice(i, 1), true)
}

const mode        = popFlag('--mode', true)        || 'lenient'
const patchFile   = popFlag('--patch', true)
const writePatch  = popFlag('--write-patch', true)
const jsonOut     = popFlag('--json')
const verbose     = popFlag('--fields')
const files       = argv.filter(a => !a.startsWith('--'))

if (!files.length) {
  console.error([
    'Usage: node scripts/audit-xml.mjs <file.xml> [file2.xml ...]',
    '       [--patch <patch.json>] [--write-patch <out.json>]',
    '       [--mode lenient|catalog|strict] [--json] [--fields]',
  ].join('\n'))
  process.exit(2)
}

// ─── Load patch ───────────────────────────────────────────────────────────────

let patch = null
if (patchFile) {
  const abs = path.resolve(process.cwd(), patchFile)
  if (!fs.existsSync(abs)) {
    console.error(`Patch file not found: ${abs}`)
    process.exit(2)
  }
  try {
    patch = JSON.parse(fs.readFileSync(abs, 'utf8'))
  } catch (e) {
    console.error(`Could not parse patch JSON: ${e.message}`)
    process.exit(2)
  }
}

// ─── Colours ─────────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY
const c = {
  reset:  isTTY ? '\x1b[0m'  : '',
  bold:   isTTY ? '\x1b[1m'  : '',
  dim:    isTTY ? '\x1b[2m'  : '',
  red:    isTTY ? '\x1b[31m' : '',
  green:  isTTY ? '\x1b[32m' : '',
  yellow: isTTY ? '\x1b[33m' : '',
  cyan:   isTTY ? '\x1b[36m' : '',
  magenta:isTTY ? '\x1b[35m' : '',
}

const PASS = `${c.green}✓${c.reset}`
const FAIL = `${c.red}✗${c.reset}`
const WARN = `${c.yellow}⚠${c.reset}`
const PATCH = `${c.magenta}◈${c.reset}`

// ─── Helpers ─────────────────────────────────────────────────────────────────

function flatFields(obj, prefix = '') {
  const out = []
  if (!obj || typeof obj !== 'object') return out
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flatFields(v, key))
    } else if (Array.isArray(v)) {
      if (v.length) out.push({ key, value: `[${v.length} items]` })
    } else if (v !== '' && v !== null && v !== undefined && v !== false) {
      out.push({ key, value: String(v) })
    }
  }
  return out
}

function keySet(partial) {
  return new Set(flatFields(partial).map(f => f.key))
}

function truncate(s, max = 72) {
  const str = String(s ?? '').replace(/\s+/g, ' ').trim()
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

// ─── Per-file audit ───────────────────────────────────────────────────────────

function auditFile(filePath) {
  const abs = path.resolve(process.cwd(), filePath)
  if (!fs.existsSync(abs)) return { file: filePath, error: 'File not found' }

  const xml = fs.readFileSync(abs, 'utf8')
  const parsed = importPilotPartialStateFromXml(xml)
  if (!parsed.ok) return { file: filePath, error: parsed.error, warnings: parsed.warnings }

  const xmlKeys = keySet(parsed.partial)

  // Merge order: patch fills the base, then XML data wins on top.
  // This means XML-specific fields (title, fileId, sensors, dates) are never
  // overwritten, while shared catalog fields (keywords, distribution, license)
  // come from the patch when absent from the XML.
  let base = defaultPilotState()
  if (patch) base = mergeLoadedPilotState(base, patch)
  const merged = mergeLoadedPilotState(base, parsed.partial)

  // Track which fields came from the patch (present in merged, not in XML)
  const patchedFields = patch ? flatFields(patch).filter(f => !xmlKeys.has(f.key)) : []

  const { issues, score: valScore } = validatePilotState(mode, merged)
  const errors   = issues.filter(i => i.severity === 'e')
  const warnings = issues.filter(i => i.severity === 'w')

  // Baseline (no patch) for delta display
  let baseScore = null
  let baseErrCount = null
  if (patch) {
    const baseOnly = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
    const { issues: baseIssues, score: bs } = validatePilotState(mode, baseOnly)
    baseScore = bs
    baseErrCount = baseIssues.filter(i => i.severity === 'e').length
  }

  return {
    file: filePath,
    importWarnings: parsed.warnings || [],
    importedSections: Object.keys(parsed.partial || {}),
    parsedFields: flatFields(parsed.partial),
    patchedFields,
    errors,
    warnings,
    score: valScore,
    baseScore,
    baseErrCount,
  }
}

// ─── --write-patch mode ───────────────────────────────────────────────────────

if (writePatch) {
  const allErrors = new Set()
  for (const f of files) {
    const abs = path.resolve(process.cwd(), f)
    if (!fs.existsSync(abs)) continue
    const xml = fs.readFileSync(abs, 'utf8')
    const parsed = importPilotPartialStateFromXml(xml)
    if (!parsed.ok) continue
    const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
    const { issues } = validatePilotState(mode, merged)
    for (const iss of issues.filter(i => i.severity === 'e')) allErrors.add(iss.field)
  }

  // Build scaffold with null placeholders for every erroring field
  const scaffold = {}
  const fieldToSection = {
    'mission.': 'mission',
    'spatial.': 'spatial',
    'platform.': 'platform',
    'sensors': 'sensors',
    'keywords.': 'keywords',
    'distribution.': 'distribution',
  }
  for (const field of [...allErrors].sort()) {
    let section = 'mission'
    for (const [prefix, sec] of Object.entries(fieldToSection)) {
      if (field.startsWith(prefix)) { section = sec; break }
    }
    const key = field.replace(`${section}.`, '')
    if (!scaffold[section]) scaffold[section] = {}
    if (section === 'keywords') {
      // keywords are arrays of {label, uuid}
      scaffold[section][key] = [{ label: '', uuid: '' }]
    } else {
      scaffold[section][key] = ''
    }
  }

  const outAbs = path.resolve(process.cwd(), writePatch)
  fs.mkdirSync(path.dirname(outAbs), { recursive: true })
  fs.writeFileSync(outAbs, JSON.stringify(scaffold, null, 2))
  console.log(`Patch scaffold written to: ${outAbs}`)
  console.log(`Fill in the values, then re-run with: --patch ${writePatch}`)
  process.exit(0)
}

// ─── Run audit ────────────────────────────────────────────────────────────────

const results = files.map(auditFile)

if (jsonOut) {
  console.log(JSON.stringify(results, null, 2))
  process.exit(results.some(r => r.error || r.errors?.length) ? 1 : 0)
}

let anyFailed = false

for (const r of results) {
  const name = path.basename(r.file)
  console.log(`\n${c.bold}${c.cyan}━━━  ${name}  ━━━${c.reset}`)
  console.log(`${c.dim}${r.file}${c.reset}`)

  if (r.error) {
    console.log(`${FAIL} ${c.red}${r.error}${c.reset}`)
    anyFailed = true
    continue
  }

  if (r.importWarnings.length) {
    for (const w of r.importWarnings) console.log(`${WARN} ${c.yellow}Import: ${w}${c.reset}`)
  }

  console.log(`\n${c.bold}Imported sections${c.reset}: ${r.importedSections.join(', ') || '(none)'}`)
  console.log(`${c.bold}Parsed fields${c.reset}: ${r.parsedFields.length}${r.patchedFields.length ? `  ${PATCH} ${c.magenta}+${r.patchedFields.length} from patch${c.reset}` : ''}`)

  if (verbose) {
    if (r.parsedFields.length) {
      console.log(`\n  ${c.bold}From XML:${c.reset}`)
      const maxKey = Math.max(...r.parsedFields.map(f => f.key.length))
      for (const { key, value } of r.parsedFields) {
        console.log(`  ${c.dim}${key.padEnd(maxKey)}${c.reset}  ${truncate(value)}`)
      }
    }
    if (r.patchedFields.length) {
      console.log(`\n  ${c.bold}${c.magenta}From patch:${c.reset}`)
      const maxKey = Math.max(...r.patchedFields.map(f => f.key.length))
      for (const { key, value } of r.patchedFields) {
        console.log(`  ${c.magenta}${key.padEnd(maxKey)}${c.reset}  ${truncate(value)}`)
      }
    }
  }

  console.log(`\n${c.bold}Validation (mode: ${mode})${c.reset}`)

  const totalIssues = r.errors.length + r.warnings.length
  if (!totalIssues) {
    console.log(`  ${PASS} ${c.green}All checks passed${c.reset}`)
  } else {
    if (r.errors.length) {
      console.log(`  ${FAIL} ${c.red}${r.errors.length} error(s)${c.reset}`)
      for (const e of r.errors) {
        console.log(`     ${c.red}✗${c.reset} ${c.bold}${e.field}${c.reset}  ${c.dim}${truncate(e.message, 90)}${c.reset}`)
      }
    }
    if (r.warnings.length) {
      console.log(`  ${WARN} ${c.yellow}${r.warnings.length} warning(s)${c.reset}`)
      for (const w of r.warnings) {
        console.log(`     ${c.yellow}⚠${c.reset} ${c.bold}${w.field}${c.reset}  ${c.dim}${truncate(w.message, 90)}${c.reset}`)
      }
    }
    anyFailed = true
  }

  // Score line — show delta when patch is active
  if (patch && r.baseScore !== null) {
    const delta = r.score - r.baseScore
    const errDelta = r.baseErrCount - r.errors.length
    const deltaStr = delta > 0
      ? `${c.green}+${delta}${c.reset}`
      : delta < 0 ? `${c.red}${delta}${c.reset}` : `${c.dim}±0${c.reset}`
    const errStr = errDelta > 0 ? ` ${c.green}(fixed ${errDelta} error${errDelta > 1 ? 's' : ''})${c.reset}` : ''
    console.log(`\n  Score: ${c.bold}${r.score}${c.reset}/100  ${PATCH} ${deltaStr} vs no-patch (was ${r.baseScore})${errStr}`)
  } else {
    console.log(`\n  Score: ${c.bold}${r.score}${c.reset}/100`)
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

if (results.length > 1) {
  console.log(`\n${c.bold}${c.cyan}━━━  Summary  ━━━${c.reset}`)
  const pad = Math.max(...results.map(r => path.basename(r.file).length))
  for (const r of results) {
    if (r.error) {
      console.log(`  ${FAIL}  ${path.basename(r.file).padEnd(pad)}  ERROR: ${r.error}`)
      continue
    }
    const icon = r.errors.length ? FAIL : r.warnings.length ? WARN : PASS
    const detail = r.errors.length
      ? `${c.red}${r.errors.length} err${c.reset}`
      : r.warnings.length
        ? `${c.yellow}${r.warnings.length} warn${c.reset}`
        : `${c.green}clean${c.reset}`
    const delta = (patch && r.baseScore !== null && r.score !== r.baseScore)
      ? `  ${PATCH} ${r.baseScore}→${c.bold}${r.score}${c.reset}`
      : `  score ${c.bold}${r.score}${c.reset}`
    console.log(`  ${icon}  ${path.basename(r.file).padEnd(pad)}  ${detail}${delta}`)
  }
}

console.log()
process.exit(anyFailed ? 1 : 0)
