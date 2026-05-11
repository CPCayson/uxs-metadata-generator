#!/usr/bin/env node
/**
 * Audit each XML under MANTA End User Testing/samples:
 * import → merge → lenient / strict / catalog validate → buildXmlPreview (ISO 19115-2 mission output),
 * optional preview-round-trip import + xmllint --noout (verify-pilot parity).
 *
 * This is the **batch substitute** for clicking through every wizard step in the UI: validation runs on the full
 * merged `pilotState` (same engine as the form). “Perfect” ISO-2 means **lenient 0 errors**, empty ISO-2 structural
 * fails, preview round-trip parses, and well-formed XML — tighten with `--fail-if-lenient-errors` when ready.
 *
 * Usage:
 *   npm run audit:manta-samples
 *   npm run verify:manta-pipeline
 *   SAMPLE_DIR=/path/to/samples node scripts/audit-manta-end-user-samples.mjs
 *   node scripts/audit-manta-end-user-samples.mjs --fail-if-lenient-errors
 *   node scripts/audit-manta-end-user-samples.mjs --verify-pipeline
 *   node scripts/audit-manta-end-user-samples.mjs --verify-pipeline --fail-if-lenient-errors   # EUT “perfect” gate (0 lenient errors @ samples/)
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_SAMPLES = path.resolve(ROOT, '..', 'MANTA End User Testing', 'samples')
const REPO_ROOT = path.resolve(ROOT, '..')
const OUT_DIR = path.join(REPO_ROOT, 'MANTA End User Testing', 'reports')

const SAMPLE_DIR = process.env.SAMPLE_DIR || DEFAULT_SAMPLES
const SAMPLE_DIR_REL = path.relative(REPO_ROOT, path.resolve(SAMPLE_DIR)) || '.'

const FAIL_IF_LENIENT_ERRORS = process.argv.includes('--fail-if-lenient-errors')
/** Fast CI gate: no report files; exit 1 if any sample fails import, ISO-2 preview sanity, preview→import RT, or xmllint. */
const VERIFY_PIPELINE = process.argv.includes('--verify-pipeline')

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
const { missionPreviewIso191152SanityFailures } = await import(
  path.join(ROOT, 'src/lib/iso191152PreviewSanity.js'),
)
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

/**
 * Well-formed XML check (same optional gate as verify-pilot).
 * @param {string} xml
 * @returns {boolean | null} null if xmllint not installed
 */
function xmllintWellFormed(xml) {
  try {
    const v = spawnSync('xmllint', ['--version'], { encoding: 'utf8', shell: false })
    if (v.status !== 0) return null
  } catch {
    return null
  }
  const tmp = path.join(os.tmpdir(), `manta-eut-${process.pid}-${Date.now()}.xml`)
  try {
    fs.writeFileSync(tmp, xml, 'utf8')
    const r = spawnSync('xmllint', ['--noout', tmp], { encoding: 'utf8', shell: false })
    return r.status === 0
  } finally {
    try {
      fs.unlinkSync(tmp)
    } catch {
      /* */
    }
  }
}

/**
 * Aggregate lenient issues across samples — drives import/rule prioritization.
 * @param {object[]} rows
 */
function rollupLenientIssues(rows) {
  /** @type {Map<string, { field: string, message: string, severity: string, wizardStep: string, hitCount: number, files: string[] }>} */
  const patterns = new Map()
  /** @type {Map<string, { e: number, w: number, files: Set<string> }>} */
  const fieldAgg = new Map()

  for (const r of rows) {
    if (!r.mergeOk || !Array.isArray(r.lenientIssues)) continue
    for (const iss of r.lenientIssues) {
      const field = String(iss.field || '')
      const message = String(iss.message || '')
      const severity = String(iss.severity || '')
      const pk = `${severity}\t${field}\t${message}`
      const wizardStep = stepIdForField(field)
      if (!patterns.has(pk)) {
        patterns.set(pk, {
          field,
          message,
          severity,
          wizardStep,
          hitCount: 0,
          files: [],
        })
      }
      const p = patterns.get(pk)
      p.hitCount += 1
      if (!p.files.includes(r.file)) p.files.push(r.file)

      if (!fieldAgg.has(field)) fieldAgg.set(field, { e: 0, w: 0, files: new Set() })
      const fa = fieldAgg.get(field)
      if (severity === 'e') fa.e += 1
      else if (severity === 'w') fa.w += 1
      fa.files.add(r.file)
    }
  }

  const byFrequency = [...patterns.values()].sort(
    (a, b) => b.hitCount - a.hitCount || a.field.localeCompare(b.field) || a.message.localeCompare(b.message),
  )

  const byField = Object.fromEntries(
    [...fieldAgg.entries()]
      .sort((a, b) => b[1].e + b[1].w - (a[1].e + a[1].w))
      .map(([field, v]) => [
        field,
        {
          errors: v.e,
          warnings: v.w,
          samples: v.files.size,
          files: [...v.files].sort(),
        },
      ]),
  )

  const byWizardStep = /** @type {Record<string, { errors: number, warnings: number }>} */ ({})
  for (const p of byFrequency) {
    const sid = p.wizardStep || 'other'
    if (!byWizardStep[sid]) byWizardStep[sid] = { errors: 0, warnings: 0 }
    if (p.severity === 'e') byWizardStep[sid].errors += p.hitCount
    else if (p.severity === 'w') byWizardStep[sid].warnings += p.hitCount
  }

  return {
    patternCount: patterns.size,
    byFrequency,
    byField,
    byWizardStep,
  }
}

/** Escape a cell for CSV */
function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/**
 * @param {ReturnType<typeof rollupLenientIssues>} rollup
 */
function writeLenientRollupMarkdown(rollup, outPath) {
  const lines = []
  lines.push('# Lenient validation — cross-sample rollup')
  lines.push('')
  lines.push(`Unique issue patterns: **${rollup.patternCount}**`)
  lines.push('')
  lines.push('Use this to prioritize **import mapping** (`xmlPilotImport.js`) vs **rule tuning** (`pilotValidation.js` / mission rules): patterns hitting **every** sample often indicate systemic import gaps or baseline rules.')
  lines.push('')
  lines.push('## By wizard step (lenient issue hits)')
  lines.push('')
  lines.push('| Step | Error hits | Warning hits |')
  lines.push('|------|------------|--------------|')
  const stepIds = Object.keys(rollup.byWizardStep).sort()
  for (const sid of stepIds) {
    const s = rollup.byWizardStep[sid]
    lines.push(`| ${sid} | ${s.errors} | ${s.warnings} |`)
  }
  lines.push('')
  lines.push('## Top fields by total issue count')
  lines.push('')
  lines.push('| Field | Errors | Warnings | Distinct samples |')
  lines.push('|-------|--------|----------|------------------|')
  const fieldEntries = Object.entries(rollup.byField).slice(0, 40)
  for (const [field, v] of fieldEntries) {
    lines.push(`| \`${field.replace(/\|/g, '\\|')}\` | ${v.errors} | ${v.warnings} | ${v.samples} |`)
  }
  if (Object.keys(rollup.byField).length > 40) lines.push('')
  if (Object.keys(rollup.byField).length > 40) {
    lines.push(`*(${Object.keys(rollup.byField).length - 40} more fields in JSON / CSV)*`)
  }
  lines.push('')
  lines.push('## Duplicate patterns (frequency)')
  lines.push('')
  lines.push('| Hits | Sev | Step | Field | Message |')
  lines.push('|------|-----|------|-------|---------|')
  for (const p of rollup.byFrequency.slice(0, 80)) {
    const msg = p.message.length > 120 ? `${p.message.slice(0, 117)}…` : p.message
    lines.push(
      `| ${p.hitCount} | ${p.severity} | ${p.wizardStep} | \`${String(p.field).replace(/\|/g, '\\|')}\` | ${msg.replace(/\|/g, '\\|')} |`,
    )
  }
  if (rollup.byFrequency.length > 80) {
    lines.push('')
    lines.push(`*(${rollup.byFrequency.length - 80} more patterns in JSON / CSV)*`)
  }
  lines.push('')
  fs.writeFileSync(outPath, lines.join('\n'))
}

/** @param {ReturnType<typeof rollupLenientIssues>} rollup */
function writeLenientRollupCsv(rollup, outPath) {
  const hdr = ['hitCount', 'severity', 'wizardStep', 'field', 'message', 'files']
  const rows = [hdr.join(',')]
  for (const p of rollup.byFrequency) {
    rows.push(
      [
        p.hitCount,
        csvEscape(p.severity),
        csvEscape(p.wizardStep),
        csvEscape(p.field),
        csvEscape(p.message),
        csvEscape(p.files.join('; ')),
      ].join(','),
    )
  }
  fs.writeFileSync(outPath, rows.join('\n'))
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
      catalogErrors: 0,
      catalogWarns: 0,
      pipelineError: null,
      iso2PreviewFails: /** @type {string[]} */ ([]),
      previewLen: 0,
      previewRoundtripPartial: false,
      xmllintOk: /** @type {boolean | null} */ (null),
      lenientByStep: /** @type {Record<string, { e: number, w: number }>|null} */ (null),
      strictByStep: /** @type {Record<string, { e: number, w: number }>|null} */ (null),
      /** Full lenient issue list for rollup / CI drill-down */
      lenientIssues: /** @type {Array<{ field: string, message: string, severity: string, xpath?: string }>} */ ([]),
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
      row.lenientIssues = (vrL.issues || []).map((i) => ({
        field: i.field,
        message: i.message,
        severity: i.severity,
        xpath: i.xpath,
      }))
      row.lenientErrors = (vrL.issues || []).filter((i) => i.severity === 'e').length
      row.lenientWarns = (vrL.issues || []).filter((i) => i.severity === 'w').length
      row.lenientByStep = tallyIssuesByStep(vrL.issues || [])

      const vrS = validatePilotState('strict', fixed)
      row.strictErrors = (vrS.issues || []).filter((i) => i.severity === 'e').length
      row.strictWarns = (vrS.issues || []).filter((i) => i.severity === 'w').length
      row.strictByStep = tallyIssuesByStep(vrS.issues || [])

      const vrC = validatePilotState('catalog', fixed)
      row.catalogErrors = (vrC.issues || []).filter((i) => i.severity === 'e').length
      row.catalogWarns = (vrC.issues || []).filter((i) => i.severity === 'w').length

      row.mergeOk = true

      const preview = buildXmlPreview(fixed)
      row.previewLen = String(preview).length
      row.iso2PreviewFails = missionPreviewIso191152SanityFailures(preview)

      const rt = importPilotPartialStateFromXml(String(preview), {
        originalFilename: `${file}«preview-roundtrip».xml`,
      })
      row.previewRoundtripPartial = !!(rt && rt.partial)

      row.xmllintOk = xmllintWellFormed(String(preview))
    } catch (e) {
      row.pipelineError = `merge/preview: ${e instanceof Error ? e.message : String(e)}`
    }

    rows.push(row)
  }

  if (VERIFY_PIPELINE) {
    const badImport = rows.filter((r) => !r.importOk).length
    const badPipeline = rows.filter((r) => r.pipelineError || !r.mergeOk).length
    const badIso = rows.filter((r) => r.mergeOk && r.iso2PreviewFails?.length).length
    const badRt = rows.filter((r) => r.mergeOk && !r.previewRoundtripPartial).length
    const badXml = rows.filter((r) => r.mergeOk && r.xmllintOk === false).length
    const lenientBadRows = rows.filter((r) => r.mergeOk && (r.lenientErrors ?? 0) > 0)
    const badLenient = lenientBadRows.length
    if (badImport || badPipeline || badIso || badRt || badXml || (FAIL_IF_LENIENT_ERRORS && badLenient)) {
      console.error(
        `verify-pipeline FAILED: import=${badImport} pipeline=${badPipeline} iso2Preview=${badIso} previewRt=${badRt} xmllint=${badXml} lenientErrSamples=${badLenient} (samples=${rows.length})`,
      )
      if (FAIL_IF_LENIENT_ERRORS && badLenient) {
        console.error(
          `  --fail-if-lenient-errors: ${badLenient} file(s) still have lenient validation errors after auto-fix (target 0 for “perfect” EUT).`,
        )
        for (const r of lenientBadRows) {
          const top = (r.lenientIssues || [])
            .filter((i) => i.severity === 'e')
            .slice(0, 4)
            .map((i) => `${i.field}: ${i.message}`)
          console.error(`    ${r.file}: ${r.lenientErrors}e — ${top.join(' · ') || '(see reports)'}`)
        }
      }
      for (const r of rows) {
        const bad =
          !r.importOk ||
          r.pipelineError ||
          !r.mergeOk ||
          (r.mergeOk && r.iso2PreviewFails?.length) ||
          (r.mergeOk && !r.previewRoundtripPartial) ||
          (r.mergeOk && r.xmllintOk === false)
        if (bad) {
          console.error(
            `  ${r.file}: importOk=${r.importOk} mergeOk=${r.mergeOk} pipeline=${r.pipelineError || '—'} iso2=${(r.iso2PreviewFails || []).join(';') || '—'} rt=${r.previewRoundtripPartial} xmllint=${r.xmllintOk}`,
          )
        }
      }
      process.exit(1)
    }
    console.log(
      `verify-pipeline: ${rows.length} MANTA samples — import, merge, ISO-19115-2 preview sanity, preview→import RT, xmllint OK${FAIL_IF_LENIENT_ERRORS ? ', lenient 0 errors' : ''}`,
    )
    process.exit(0)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  const lenientRollup = rollupLenientIssues(rows)
  const rollupJsonPath = path.join(OUT_DIR, 'manta-samples-lenient-rollup.json')
  fs.writeFileSync(
    rollupJsonPath,
    JSON.stringify(
      {
        sampleDir: SAMPLE_DIR,
        sampleDirRelative: SAMPLE_DIR_REL,
        generated: new Date().toISOString(),
        ...lenientRollup,
      },
      null,
      2,
    ),
  )

  const rollupMdPath = path.join(OUT_DIR, 'manta-samples-lenient-rollup.md')
  writeLenientRollupMarkdown(lenientRollup, rollupMdPath)

  const rollupCsvPath = path.join(OUT_DIR, 'manta-samples-lenient-patterns.csv')
  writeLenientRollupCsv(lenientRollup, rollupCsvPath)

  const jsonPath = path.join(OUT_DIR, 'manta-samples-iso2-audit.json')
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        sampleDir: SAMPLE_DIR,
        sampleDirRelative: SAMPLE_DIR_REL,
        generated: new Date().toISOString(),
        lenientRollupSummary: {
          patternCount: lenientRollup.patternCount,
          rollupJson: path.relative(REPO_ROOT, rollupJsonPath),
          rollupMd: path.relative(REPO_ROOT, rollupMdPath),
          rollupCsv: path.relative(REPO_ROOT, rollupCsvPath),
        },
        rows,
      },
      null,
      2,
    ),
  )

  const md = []
  md.push('# MANTA samples — import audit & ISO 19115-2 preview alignment')
  md.push('')
  md.push(`Generated: ${new Date().toISOString()}`)
  md.push(`Samples: \`${SAMPLE_DIR_REL}\` (repo-relative)`)
  md.push('')
  md.push('For each file: **source shape** (root XML), **import/merge** pipeline, **validation** counts after auto-fix (lenient / strict / **catalog**), **ISO-19115-2 preview sanity**, **preview→import round-trip** (`buildXmlPreview` output fed back through `importPilotPartialStateFromXml`), and **xmllint --noout** when installed.')
  md.push('')
  md.push('Empty **ISO-2 preview fails** means Manta’s emitted preview matches that structural bar for that loaded state.')
  md.push('')
  md.push('**Wizard coverage:** The validator runs on the **full merged state** (same as saving after visiting every step). There is no separate “click every control” pass — use **per-step issue tallies** below to see which sections still fail.')
  md.push('')
  md.push('**Per-field validation:** Issues are grouped by **wizard step** using the same field-prefix ownership as the mission profile (`mission` / `platform` / `sensors` / `spatial` / `keywords` / `distribution`); paths that do not match any step prefix appear under **`other`** (e.g. catalog `ident.*` rules).')
  md.push('')
  md.push('| File | Source XML shape | Import ok | Merge ok | Lenient E/W | Strict E/W | Catalog E/W | RT | xmllint | ISO-2 preview fails |')
  md.push('|------|------------------|-----------|----------|-------------|------------|-------------|----|---------|---------------------|')

  for (const r of rows) {
    const ie = r.importOk ? 'yes' : 'no'
    const me = r.mergeOk ? 'yes' : 'no'
    const lw = `${r.lenientErrors}/${r.lenientWarns}`
    const sw = `${r.strictErrors}/${r.strictWarns}`
    const cw = `${r.catalogErrors}/${r.catalogWarns}`
    const rt =
      !r.mergeOk ? '—' : r.previewRoundtripPartial ? 'yes' : 'no'
    const xl =
      r.xmllintOk === null ? 'skip' : r.xmllintOk ? 'ok' : 'fail'
    const iso = r.iso2PreviewFails?.length ? r.iso2PreviewFails.join('; ') : '—'
    const shape = String(r.sourceShape).replace(/\|/g, '\\|')
    md.push(`| ${r.file} | ${shape} | ${ie} | ${me} | ${lw} | ${sw} | ${cw} | ${rt} | ${xl} | ${iso} |`)
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
  md.push('## Lenient issue rollup (automation)')
  md.push('')
  md.push(
    'Cross-sample aggregation of **lenient** validator output — **prioritize fixes** (import vs rules):',
  )
  md.push('')
  md.push(`- **Markdown:** \`${path.relative(REPO_ROOT, rollupMdPath)}\``)
  md.push(`- **JSON:** \`${path.relative(REPO_ROOT, rollupJsonPath)}\``)
  md.push(`- **CSV:** \`${path.relative(REPO_ROOT, rollupCsvPath)}\` (patterns × sample files)`)
  md.push('')
  md.push('## JSON')
  md.push('')
  md.push(`Per-sample machine-readable (includes \`lenientIssues[]\`): \`${path.relative(REPO_ROOT, jsonPath)}\``)

  const mdPath = path.join(OUT_DIR, 'manta-samples-iso2-audit.md')
  fs.writeFileSync(mdPath, md.join('\n'))

  console.log(`Wrote ${mdPath}`)
  console.log(`Wrote ${jsonPath}`)
  console.log(`Wrote ${rollupMdPath}`)
  console.log(`Wrote ${rollupJsonPath}`)
  console.log(`Wrote ${rollupCsvPath}`)

  const badPipeline = rows.filter((r) => r.pipelineError || !r.mergeOk).length
  const badIso = rows.filter((r) => r.mergeOk && r.iso2PreviewFails?.length).length
  const badRt = rows.filter((r) => r.mergeOk && !r.previewRoundtripPartial).length
  const badXml = rows.filter((r) => r.mergeOk && r.xmllintOk === false).length
  const badLenient = rows.filter((r) => r.mergeOk && r.lenientErrors > 0).length
  console.log(
    `Summary: ${rows.length} files, pipeline problems: ${badPipeline}, lenient errors>0: ${badLenient}, ISO-2 preview gaps: ${badIso}, preview round-trip failed: ${badRt}, xmllint failed: ${badXml}`,
  )

  if (FAIL_IF_LENIENT_ERRORS && badLenient > 0) {
    console.error('Failing because --fail-if-lenient-errors and one or more samples have lenient validation errors.')
    process.exit(1)
  }
}

main()
