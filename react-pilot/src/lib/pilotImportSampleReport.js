/**
 * Build a Markdown report after loading a sample XML: unset tracked fields, validation issues,
 * import warnings, and an XML comparison section (overlap metrics — positional line diff is low signal).
 *
 * @module lib/pilotImportSampleReport
 */

import { PILOT_IMPORT_REPORT_TRACK_PATHS } from './pilotImportReportPaths.js'

/**
 * Same field/message often appears from multiple rules — keep one row per path + message + severity.
 * @param {Array<{ severity?: string, path?: string, field?: string, message?: string }>} issues
 */
export function dedupeValidationIssues(issues) {
  if (!Array.isArray(issues)) return []
  const seen = new Set()
  /** @type {typeof issues} */
  const out = []
  for (const i of issues) {
    const path = String(i.path || i.field || '').trim()
    const msg = String(i.message || '').trim()
    const sev = i.severity === 'e' ? 'e' : 'w'
    const key = `${sev}|${path}|${msg}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(i)
  }
  return out
}

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

const DIFF_MAX_LINES = 24

/**
 * Strip tags coarsely and compare word sets (Jaccard) — robust to reorder / pretty-print.
 * @param {string} xml
 */
function xmlToWordSet(xml) {
  const t = String(xml ?? '')
    .replace(/<[^>]{0,800}>/g, ' ')
    .replace(/[^\w\s.-]/g, ' ')
  const words = t
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !/^\d+$/.test(w))
  return new Set(words)
}

/**
 * @param {string} original
 * @param {string} preview
 */
export function computeXmlWordOverlap(original, preview) {
  const A = xmlToWordSet(original)
  const B = xmlToWordSet(preview)
  let inter = 0
  for (const w of A) {
    if (B.has(w)) inter += 1
  }
  const union = A.size + B.size - inter
  const jaccard = union > 0 ? inter / union : 0
  return {
    jaccard,
    wordsOriginal: A.size,
    wordsPreview: B.size,
    wordsShared: inter,
  }
}

/**
 * Lines from original that appear verbatim (trimmed) inside preview — shows carried-over snippets.
 * @param {string} original
 * @param {string} preview
 * @param {number} maxRows
 */
export function findSharedTrimmedLines(original, preview, maxRows = 18) {
  const pv = String(preview ?? '')
  const candidates = String(original ?? '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 48 && !l.startsWith('<?xml'))
  /** @type {string[]} */
  const out = []
  for (const line of candidates) {
    if (out.length >= maxRows) break
    if (pv.includes(line)) out.push(line.length > 160 ? `${line.slice(0, 160)}…` : line)
  }
  return out
}

/**
 * First line-by-line mismatches (1-based line numbers). Misleading when XML order differs — use with caution.
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
  const overlap = computeXmlWordOverlap(originalXml, previewXml)
  const sharedSnippets = findSharedTrimmedLines(originalXml, previewXml)
  const issuesDeduped = dedupeValidationIssues(validationIssues)
  const dedupErrs = issuesDeduped.filter((i) => i.severity === 'e').length
  const dedupWarns = issuesDeduped.filter((i) => i.severity !== 'e').length
  const rawErr = validationIssues.filter((i) => i.severity === 'e').length
  const rawWarn = validationIssues.filter((i) => i.severity !== 'e').length
  const dupNote =
    rawErr + rawWarn > dedupErrs + dedupWarns
      ? ` (${rawErr + rawWarn} rows from rules; duplicates collapsed)`
      : ''

  const lines = []
  lines.push('# Sample XML import report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  if (profileLabel || profileId) {
    lines.push(`Profile: ${profileLabel || profileId}${profileId && profileLabel ? ` (${profileId})` : ''}`)
  }
  if (originalFilename) lines.push(`Source file: ${originalFilename}`)
  if (impFam || expFam) {
    const exp = expFam || '19115-2 (generator)'
    const transferNote =
      impFam === '19115-3' && String(exp).includes('19115-2')
        ? ' — Upload is ISO **19115-3**; preview/download are normalized ISO **19115-2** (not a verbatim −3 round-trip).'
        : ''
    lines.push(`ISO lineage: import ${impFam || '—'} → preview export ${exp}${transferNote}`)
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
  lines.push(
    `Unique issues: **${dedupErrs}** errors · **${dedupWarns}** warnings${dupNote} · Score: ${validationScore ?? '—'}`,
  )
  lines.push('')
  if (issuesDeduped.length) {
    const errs = issuesDeduped.filter((i) => i.severity === 'e')
    const warns = issuesDeduped.filter((i) => i.severity !== 'e')
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
    'Preview is **generated** from the merged form (`buildXmlPreview`), not a verbatim copy of the upload.',
  )
  lines.push('')
  lines.push(
    '**Why line numbers rarely match:** the exporter uses a fixed element order, adds an XML declaration, wraps tags differently, and may prefix `fileIdentifier`. Comparing “line 1 to line 1” therefore shows **almost every row different** even when titles, abstracts, and contacts round-trip into the form.',
  )
  lines.push('')
  lines.push(`- Original size: ${origLen} characters`)
  lines.push(`- Preview size: ${prevLen} characters`)
  lines.push(
    `- **Rough text overlap (word Jaccard after stripping tags): ${(overlap.jaccard * 100).toFixed(1)}%** (${overlap.wordsShared} shared tokens · ~${overlap.wordsOriginal} vs ~${overlap.wordsPreview} distinct words)`,
  )
  lines.push('')
  if (sharedSnippets.length) {
    lines.push('### Snippets that appear verbatim in both documents')
    lines.push('')
    lines.push(
      'These trimmed lines from the upload were found inside the preview text (good sign content carried over):',
    )
    lines.push('')
    for (const s of sharedSnippets) {
      lines.push(`- ${s.replace(/\|/g, '¦')}`)
    }
    lines.push('')
  }
  lines.push(`- Raw line index: ${diff.totalCompared} rows · ${diff.mismatchCount} positions differ when aligned naïvely`)
  lines.push('')
  if (diff.mismatchCount === 0) {
    lines.push('### Positional line comparison')
    lines.push('')
    lines.push('*(Original and preview text match line-for-line after newline normalization.)*')
  } else {
    lines.push('### Positional line comparison (low signal — optional)')
    lines.push('')
    lines.push(
      '*Same row index compares unrelated markup when element order differs; use overlap score above or an XML-aware diff tool on downloaded preview vs upload.*',
    )
    lines.push('')
    lines.push('| Line # | Original (upload) | Preview (download) |')
    lines.push('| ---: | --- | --- |')
    for (const r of diff.rows) {
      lines.push(`| ${r.line} | ${r.original} | ${r.preview} |`)
    }
    if (diff.mismatchCount > diff.rows.length) {
      lines.push('')
      lines.push(
        `*… ${diff.mismatchCount - diff.rows.length} more row pairs differ at the same index (not shown).*`,
      )
    }
  }
  lines.push('')
  return lines.join('\n')
}
