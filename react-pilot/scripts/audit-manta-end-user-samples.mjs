#!/usr/bin/env node
/**
 * Audit each XML under MANTA End User Testing/samples:
 * import → merge → lenient validate → buildXmlPreview (ISO 19115-2 mission output)
 * and report ISO-19115-2 structural sanity on the **preview** (aligned with verify-pilot).
 *
 * Usage:
 *   node scripts/audit-manta-end-user-samples.mjs
 *   SAMPLE_DIR=/path/to/samples node scripts/audit-manta-end-user-samples.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_SAMPLES = path.resolve(ROOT, '..', 'MANTA End User Testing', 'samples')
const REPO_ROOT = path.resolve(ROOT, '..')
const OUT_DIR = path.join(REPO_ROOT, 'MANTA End User Testing', 'reports')

const SAMPLE_DIR = process.env.SAMPLE_DIR || DEFAULT_SAMPLES
const SAMPLE_DIR_REL = path.relative(REPO_ROOT, path.resolve(SAMPLE_DIR)) || '.'

globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}

const probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const elementProto = Object.getPrototypeOf(probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
  Object.defineProperty(elementProto, 'children', {
    configurable: true,
    enumerable: true,
    get() {
      return Array.from(this.childNodes || []).filter((n) => n && n.nodeType === 1)
    },
  })
}

const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
const { defaultPilotState, mergeLoadedPilotState, validatePilotState } = await import(
  path.join(ROOT, 'src/lib/pilotValidation.js'),
)
const { applyPilotAutoFixes } = await import(path.join(ROOT, 'src/lib/pilotAutoFix.js'))
const { buildXmlPreview } = await import(path.join(ROOT, 'src/lib/xmlPreviewBuilder.js'))
const { missionSteps } = await import(path.join(ROOT, 'src/profiles/mission/missionProfile.js'))

/** Same routing as {@link import('../../src/core/workflow/WorkflowEngine.js').WorkflowEngine} but unknown fields → `other`. */
function stepIdForField(field) {
  if (!field || typeof field !== 'string') return 'other'
  for (const step of missionSteps) {
    for (const prefix of step.ownedFieldPrefixes) {
      if (field === prefix || field.startsWith(prefix)) return step.id
    }
  }
  return 'other'
}

/** @returns {Record<string, { e: number, w: number }>} */
function tallyIssuesByStep(issues) {
  /** @type {Record<string, { e: number, w: number }>} */
  const out = {}
  const ids = [...missionSteps.map((s) => s.id), 'other']
  for (const id of ids) out[id] = { e: 0, w: 0 }
  for (const iss of issues || []) {
    const sid = stepIdForField(iss.field)
    if (!out[sid]) out[sid] = { e: 0, w: 0 }
    if (iss.severity === 'e') out[sid].e += 1
    else if (iss.severity === 'w') out[sid].w += 1
  }
  return out
}

function formatStepTally(tally) {
  return missionSteps
    .map((s) => {
      const t = tally[s.id]
      if (!t.e && !t.w) return null
      return `${s.id}:${t.e}e/${t.w}w`
    })
    .filter(Boolean)
    .concat(tally.other?.e || tally.other?.w ? [`other:${tally.other.e}e/${tally.other.w}w`] : [])
    .join(' · ')
}

/** @param {string} xml */
function xmlHasBoundingBoxDecimal_(xml, localName) {
  const prefixed = new RegExp(`<\\w+:${localName}\\b[^>]*>\\s*<\\w+:Decimal\\b`, 'i')
  const unprefixed = new RegExp(`<${localName}\\b[^>]*>\\s*<Decimal\\b`, 'i')
  return prefixed.test(xml) || unprefixed.test(xml)
}

/** Mission preview XML from buildXmlPreview — ISO 19115-2 gmi emission */
function iso191152PreviewSanityFailures(xml) {
  const checks = [
    { id: 'root.prefixed', passed: /<gmi:MI_Metadata\b/.test(xml) },
    {
      id: 'root.namespace.gmi',
      passed: /xmlns:gmi="http:\/\/www\.isotc211\.org\/2005\/gmi"/.test(xml),
    },
    {
      id: 'schema.gmi',
      passed:
        /http:\/\/www\.isotc211\.org\/2005\/gmi\s+http:\/\/schemas\.opengis\.net\/iso\/19115\/-2\/gmi\/1\.0\/gmi\.xsd/.test(
          xml,
        ),
    },
    {
      id: 'bbox.decimalTyped',
      passed:
        xmlHasBoundingBoxDecimal_(xml, 'westBoundLongitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'eastBoundLongitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'southBoundLatitude') &&
        xmlHasBoundingBoxDecimal_(xml, 'northBoundLatitude'),
    },
  ]
  return checks.filter((c) => !c.passed).map((c) => c.id)
}

/** @param {string} raw */
function detectSourceShape(raw) {
  const head = raw.slice(0, 12000)
  if (/<mdb:MD_Metadata\b/i.test(head) || /standards\.iso\.org\/iso\/19115\/-3\/mdb/i.test(head))
    return 'ISO 19115-3 (mdb / -3)'
  if (/<MD_Metadata\b[^>]*19115\/-3/i.test(head)) return 'ISO 19115-3 (MD_Metadata)'
  if (/<gmi:MI_Metadata\b/i.test(head)) return 'ISO 19115-2 style (gmi:MI_Metadata)'
  if (/<gmd:MD_Metadata\b/i.test(head)) return 'ISO 19139 style (gmd:MD_Metadata)'
  return 'unknown'
}

function main() {
  if (!fs.existsSync(SAMPLE_DIR)) {
    console.error(`Samples directory not found: ${SAMPLE_DIR}`)
    process.exit(1)
  }

  const xmlFiles = fs.readdirSync(SAMPLE_DIR).filter((f) => f.endsWith('.xml')).sort()
  /** @type {object[]} */
  const rows = []

  for (const file of xmlFiles) {
    const full = path.join(SAMPLE_DIR, file)
    const raw = fs.readFileSync(full, 'utf8')
    const sourceShape = detectSourceShape(raw)

    /** @type {Record<string, unknown>} */
    const row = {
      file,
      sourceShape,
      importOk: false,
      mergeOk: false,
      parseOk: false,
      lenientErrors: 0,
      lenientWarns: 0,
      strictErrors: 0,
      strictWarns: 0,
      pipelineError: null,
      iso2PreviewFails: /** @type {string[]} */ ([]),
      previewLen: 0,
      lenientByStep: /** @type {Record<string, { e: number, w: number }>|null} */ (null),
      strictByStep: /** @type {Record<string, { e: number, w: number }>|null} */ (null),
    }

    let parseResult
    try {
      parseResult = importPilotPartialStateFromXml(raw, { originalFilename: file })
    } catch (e) {
      row.pipelineError = `import throw: ${e instanceof Error ? e.message : String(e)}`
      rows.push(row)
      continue
    }

    row.parseOk = !!(parseResult && parseResult.partial)
    row.importOk = parseResult?.ok === true
    if (!parseResult?.partial) {
      row.pipelineError = `import no partial (ok=${parseResult?.ok})`
      rows.push(row)
      continue
    }

    try {
      const base = defaultPilotState()
      const merged = mergeLoadedPilotState(base, parseResult.partial)
      if (!merged) throw new Error('merge falsy')
      const { pilot: fixed } = applyPilotAutoFixes('lenient', merged)

      const vrL = validatePilotState('lenient', fixed)
      row.lenientErrors = (vrL.issues || []).filter((i) => i.severity === 'e').length
      row.lenientWarns = (vrL.issues || []).filter((i) => i.severity === 'w').length
      row.lenientByStep = tallyIssuesByStep(vrL.issues || [])

      const vrS = validatePilotState('strict', fixed)
      row.strictErrors = (vrS.issues || []).filter((i) => i.severity === 'e').length
      row.strictWarns = (vrS.issues || []).filter((i) => i.severity === 'w').length
      row.strictByStep = tallyIssuesByStep(vrS.issues || [])

      row.mergeOk = true

      const preview = buildXmlPreview(fixed)
      row.previewLen = String(preview).length
      row.iso2PreviewFails = iso191152PreviewSanityFailures(preview)
    } catch (e) {
      row.pipelineError = `merge/preview: ${e instanceof Error ? e.message : String(e)}`
    }

    rows.push(row)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, 'manta-samples-iso2-audit.json')
  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ sampleDir: SAMPLE_DIR, sampleDirRelative: SAMPLE_DIR_REL, generated: new Date().toISOString(), rows }, null, 2),
  )

  const md = []
  md.push('# MANTA samples — import audit & ISO 19115-2 preview alignment')
  md.push('')
  md.push(`Generated: ${new Date().toISOString()}`)
  md.push(`Samples: \`${SAMPLE_DIR_REL}\` (repo-relative)`)
  md.push('')
  md.push('For each file: **source shape** (root XML), **import/merge** pipeline, **validation** counts after auto-fix, and **ISO-19115-2 preview sanity** on `buildXmlPreview` output (`verify-pilot` parity: `gmi:MI_Metadata`, `xmlns:gmi`, `schemaLocation` gmi.xsd, bbox `gco:Decimal`).')
  md.push('')
  md.push('Empty **ISO-2 preview fails** means Manta’s emitted preview matches that structural bar for that loaded state.')
  md.push('')
  md.push('**Per-field validation:** Issues are grouped by **wizard step** using the same field-prefix ownership as the mission profile (`mission` / `platform` / `sensors` / `spatial` / `keywords` / `distribution`); paths that do not match any step prefix appear under **`other`** (e.g. catalog `ident.*` rules). This is **not** “every control on every form passed”—it is validator issues routed by field path. Use **lenient** tallies for typical authoring; **strict** for ISO-ready bars.')
  md.push('')
  md.push('| File | Source XML shape | Import ok | Merge ok | Lenient E/W | Strict E/W | ISO-2 preview fails |')
  md.push('|------|------------------|-----------|----------|-------------|------------|---------------------|')

  for (const r of rows) {
    const ie = r.importOk ? 'yes' : 'no'
    const me = r.mergeOk ? 'yes' : 'no'
    const lw = `${r.lenientErrors}/${r.lenientWarns}`
    const sw = `${r.strictErrors}/${r.strictWarns}`
    const iso = r.iso2PreviewFails?.length ? r.iso2PreviewFails.join('; ') : '—'
    const shape = String(r.sourceShape).replace(/\|/g, '\\|')
    md.push(`| ${r.file} | ${shape} | ${ie} | ${me} | ${lw} | ${sw} | ${iso} |`)
  }

  md.push('')
  md.push('## Per-step issue counts (lenient)')
  md.push('')
  md.push('| File | By step (errors/warnings) |')
  md.push('|------|---------------------------|')
  for (const r of rows) {
    const line = r.mergeOk && r.lenientByStep ? formatStepTally(r.lenientByStep) || '—' : '—'
    md.push(`| ${r.file} | ${line.replace(/\|/g, '\\|')} |`)
  }

  md.push('')
  md.push('## Per-step issue counts (strict)')
  md.push('')
  md.push('| File | By step (errors/warnings) |')
  md.push('|------|---------------------------|')
  for (const r of rows) {
    const line = r.mergeOk && r.strictByStep ? formatStepTally(r.strictByStep) || '—' : '—'
    md.push(`| ${r.file} | ${line.replace(/\|/g, '\\|')} |`)
  }

  md.push('')
  md.push('## Pipeline errors')
  md.push('')
  for (const r of rows) {
    if (r.pipelineError) {
      md.push(`- **${r.file}:** ${r.pipelineError}`)
    }
  }
  if (!rows.some((r) => r.pipelineError)) md.push('- (none)')

  md.push('')
  md.push('## JSON')
  md.push('')
  md.push(`Machine-readable: \`${path.relative(REPO_ROOT, jsonPath)}\``)

  const mdPath = path.join(OUT_DIR, 'manta-samples-iso2-audit.md')
  fs.writeFileSync(mdPath, md.join('\n'))

  console.log(`Wrote ${mdPath}`)
  console.log(`Wrote ${jsonPath}`)

  const badPipeline = rows.filter((r) => r.pipelineError || !r.mergeOk).length
  const badIso = rows.filter((r) => r.mergeOk && r.iso2PreviewFails?.length).length
  console.log(`Summary: ${rows.length} files, pipeline problems: ${badPipeline}, ISO-2 preview gaps (after successful merge): ${badIso}`)
}

main()
