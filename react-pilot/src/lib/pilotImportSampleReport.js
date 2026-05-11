/**
 * Build a Markdown report after loading a sample XML: unset tracked fields, validation issues,
 * import warnings, and a line-level diff between original upload and current ISO preview XML.
 *
 * @module lib/pilotImportSampleReport
 */

import { PILOT_IMPORT_REPORT_TRACK_PATHS } from './pilotImportReportPaths.js'

/** @param {unknown} obj @param {string} dot */
function getPath(obj, dot) {
  const parts = dot.split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = /** @type {Record<string, unknown>} */ (cur)[p]
  }
  return cur
}

/** @param {unknown} v */
function isEmptyScalar(v) {
  if (v === undefined || v === null) return true
  if (typeof v === 'boolean') return !v
  if (typeof v === 'number') return !Number.isFinite(v)
  if (typeof v === 'string') return v.trim() === ''
  return false
}

/**
 * @param {object} merged
 * @returns {string[]}
 */
export function listUnsetPilotImportReportPaths(merged) {
  const missing = []
  for (const dot of PILOT_IMPORT_REPORT_TRACK_PATHS) {
    const v = getPath(merged, dot)
    if (dot.startsWith('keywords.')) {
      const arr = Array.isArray(v) ? v : []
      if (!arr.length) missing.push(dot)
      continue
    }
    if (isEmptyScalar(v)) missing.push(dot)
  }
  return missing
}

const DIFF_MAX_LINES = 120

/**
 * First line-by-line mismatches (1-based line numbers) for XML comparison.
 * @param {string} original
 * @param {string} preview
 * @returns {{ totalCompared: number, mismatchCount: number, rows: { line: number, original: string, preview: string }[] }}
 */
export function computeXmlLineDiffPreview(original, preview) {
  const la = String(original ?? '').replace(/\r\n/g, '\n').split('\n')
  const lb = String(preview ?? '').replace(/\r\n/g, '\n').split('\n')
  const n = Math.max(la.length, lb.length)
  /** @type {{ line: number, original: string, preview: string }[]} */
  const rows = []
  let mismatchCount = 0
  for (let i = 0; i < n; i++) {
    const a = la[i]
    const b = lb[i]
    if (a !== b) {
      mismatchCount += 1
      if (rows.length < DIFF_MAX_LINES) {
        const trunc = (s, max = 200) => {
          const t = String(s ?? '')
          return t.length > max ? `${t.slice(0, max)}…` : t
        }
        rows.push({
          line: i + 1,
          original: trunc(a ?? '').replace(/\|/g, '¦'),
          preview: trunc(b ?? '').replace(/\|/g, '¦'),
        })
      }
    }
  }
  return { totalCompared: n, mismatchCount, rows }
}

/**
 * @param {{
 *   profileLabel?: string,
 *   profileId?: string,
 *   pilotState: object,
 *   previewXml: string,
 *   originalXml: string,
 *   originalFilename?: string,
 *   importWarnings?: string[],
 *   validationIssues?: Array<{ severity?: string, path?: string, field?: string, message?: string }>,
 *   validationScore?: number,
 *   validationErrCount?: number,
 *   validationWarnCount?: number,
 * }} opts
 * @returns {string}
 */
export function buildPilotImportSampleReportMarkdown(opts) {
  const {
    profileLabel = '',
    profileId = '',
    pilotState,
    previewXml,
    originalXml,
    originalFilename,
    importWarnings = [],
    validationIssues = [],
    validationScore,
    validationErrCount,
    validationWarnCount,
  } = opts

  const sp = pilotState?.sourceProvenance && typeof pilotState.sourceProvenance === 'object'
    ? pilotState.sourceProvenance
    : {}
  const impFam = String(sp.importIsoXmlFamily || '').trim()
  const expFam = String(sp.exportPreviewIsoFamily || '').trim()

  const unset = listUnsetPilotImportReportPaths(pilotState || {})
  const origLen = String(originalXml ?? '').length
  const prevLen = String(previewXml ?? '').length
  const diff = computeXmlLineDiffPreview(originalXml, previewXml)

  const lines = []
  lines.push('# Sample XML import report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  if (profileLabel || profileId) {
    lines.push(`Profile: ${profileLabel || profileId}${profileId && profileLabel ? ` (${profileId})` : ''}`)
  }
  if (originalFilename) lines.push(`Source file: ${originalFilename}`)
  if (impFam || expFam) {
    lines.push(
      `ISO lineage: import ${impFam || '—'} → preview export ${expFam || '19115-2 (generator)'}`,
    )
  }
  lines.push('')
  lines.push('## Import parser')
  lines.push('')
  if (importWarnings.length) {
    for (const w of importWarnings) lines.push(`- ${w}`)
  } else {
    lines.push('- No parser warnings recorded for this load.')
  }
  lines.push('')
  lines.push('## Validation (current form)')
  lines.push('')
  if (validationErrCount != null && validationWarnCount != null) {
    lines.push(`- Errors: ${validationErrCount} · Warnings: ${validationWarnCount} · Score: ${validationScore ?? '—'}`)
  }
  if (validationIssues.length) {
    const errs = validationIssues.filter((i) => i.severity === 'e')
    const warns = validationIssues.filter((i) => i.severity !== 'e')
    if (errs.length) {
      lines.push('### Errors')
      for (const i of errs) {
        const path = i.path || i.field || ''
        lines.push(`- \`${path}\` — ${i.message || ''}`)
      }
      lines.push('')
    }
    if (warns.length) {
      lines.push('### Warnings')
      for (const i of warns.slice(0, 80)) {
        const path = i.path || i.field || ''
        lines.push(`- \`${path}\` — ${i.message || ''}`)
      }
      if (warns.length > 80) lines.push(`- … ${warns.length - 80} more warnings`)
      lines.push('')
    }
  } else {
    lines.push('- No issues reported by the active rule set.')
  }
  lines.push('')
  lines.push('## Tracked fields still empty / default')
  lines.push('')
  lines.push(
    'These wizard paths are still unset or empty after merge (many are optional or unmapped from XML).',
  )
  lines.push('')
  if (unset.length) {
    for (const p of unset) lines.push(`- \`${p}\``)
  } else {
    lines.push('- None of the tracked paths are empty.')
  }
  lines.push('')
  lines.push('## Original XML vs preview XML')
  lines.push('')
  lines.push(
    'Preview is **generated** from the merged form (`buildXmlPreview`), not a verbatim copy of the upload. ',
    'Large differences are normal for ISO 19115-3 sources or templates with extra sections.',
  )
  lines.push('')
  lines.push(`- Original size: ${origLen} characters`)
  lines.push(`- Preview size: ${prevLen} characters`)
  lines.push(`- Lines compared: ${diff.totalCompared} · Lines that differ: ${diff.mismatchCount}`)
  lines.push('')
  if (diff.mismatchCount === 0) {
    lines.push('### Line diff')
    lines.push('')
    lines.push('*(Original and preview text match line-for-line after newline normalization.)*')
  } else {
    lines.push('### First differing lines')
    lines.push('')
    lines.push('| Line | Original (upload) | Preview (download) |')
    lines.push('| ---: | --- | --- |')
    for (const r of diff.rows) {
        lines.push(`| ${r.line} | ${r.original} | ${r.preview} |`)
    }
    if (diff.mismatchCount > diff.rows.length) {
      lines.push('')
      lines.push(`*… ${diff.mismatchCount - diff.rows.length} more differing lines not shown.*`)
    }
  }
  lines.push('')
  return lines.join('\n')
}
