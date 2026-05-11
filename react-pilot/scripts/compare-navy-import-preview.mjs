#!/usr/bin/env node
/**
 * Navy UxS template (ISO 19115-2): import → merged pilotState → buildXmlPreview,
 * then report (1) semantic probes present in original XML but empty in imported state,
 * (2) preview XML written next to the original for manual/text diff.
 *
 * Usage:
 *   node scripts/compare-navy-import-preview.mjs
 *   node scripts/compare-navy-import-preview.mjs --xml fixtures/mission/navy-uxs-gmi-template-2026.xml
 *   node scripts/compare-navy-import-preview.mjs --xml ../../NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2\ \(1\).xml
 *
 * Outputs (default react-pilot/reports/navy-import-preview-compare/):
 *   *-original.xml, *-preview-from-import.xml, *-diff-u.txt
 *   *-compare-report.{json,md} — semantic probes + leaf multiset diff (every text leaf path)
 *   *-leaf-multiset-diff.json — multiset diff of path+text fingerprints
 * Set --skip-full-leaves to skip deep leaf inventory (faster).
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'
import {
  collectXmlLeafEntries,
  multisetFromEntries,
  diffLeafMultisets,
} from './lib/xmlLeafInventory.mjs'

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

const NS = {
  gmd: 'http://www.isotc211.org/2005/gmd',
  gco: 'http://www.isotc211.org/2005/gco',
  gmi: 'http://www.isotc211.org/2005/gmi',
  gmx: 'http://www.isotc211.org/2005/gmx',
  gml: 'http://www.opengis.net/gml/3.2',
}

/** @param {import('@xmldom/xmldom').Element | import('@xmldom/xmldom').Document | null} el */
function xmlText(el) {
  if (!el) return ''
  if (el.nodeType === 3) return String(el.data || '')
  let s = ''
  const nodes = el.childNodes || []
  for (let i = 0; i < nodes.length; i += 1) s += xmlText(nodes[i])
  return s
}

/** @param {import('@xmldom/xmldom').Element | import('@xmldom/xmldom').Document | null} parent @param {string} ns @param {string} local */
function firstNS(parent, ns, local) {
  if (!parent || !parent.getElementsByTagNameNS) return null
  const list = parent.getElementsByTagNameNS(ns, local)
  return list.length ? /** @type {import('@xmldom/xmldom').Element} */ (list[0]) : null
}

/** @param {import('@xmldom/xmldom').Element | null} parent */
function gmdFreeText(parent) {
  if (!parent) return ''
  const cs = firstNS(parent, NS.gco, 'CharacterString')
  if (cs) return xmlText(cs).replace(/\s+/g, ' ').trim()
  const ax = firstNS(parent, NS.gmx, 'Anchor')
  if (ax) return xmlText(ax).replace(/\s+/g, ' ').trim()
  return xmlText(parent).replace(/\s+/g, ' ').trim()
}

/** @param {string} s */
function isPlaceholder(s) {
  const t = String(s).trim()
  if (!t) return true
  if (/^\{\{[\s\S]*\}\}$/.test(t)) return true
  return /\{\{[^}]+\}\}/.test(t)
}

/** @param {string} s */
function norm(s) {
  return String(s || '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Best-effort semantic snapshot from legacy ISO 19115-2 `gmd`/`gmi` tree (matches preview import targets).
 * @param {import('@xmldom/xmldom').Document} doc
 */
function extractOriginalProbes(doc) {
  const root = doc.documentElement
  if (!root) return {}

  const fileEl = firstNS(root, NS.gmd, 'fileIdentifier')
  const fileId = gmdFreeText(fileEl)

  const ii = firstNS(root, NS.gmd, 'identificationInfo')
  const dataId = ii ? firstNS(ii, NS.gmd, 'MD_DataIdentification') : null
  const citeWrap = dataId ? firstNS(dataId, NS.gmd, 'citation') : null
  const cite = citeWrap ? firstNS(citeWrap, NS.gmd, 'CI_Citation') : null
  const title = cite ? gmdFreeText(firstNS(cite, NS.gmd, 'title')) : ''
  const abstract = dataId ? gmdFreeText(firstNS(dataId, NS.gmd, 'abstract')) : ''
  const purpose = dataId ? gmdFreeText(firstNS(dataId, NS.gmd, 'purpose')) : ''
  const supp = dataId ? gmdFreeText(firstNS(dataId, NS.gmd, 'supplementalInformation')) : ''

  const stEl = dataId ? firstNS(firstNS(dataId, NS.gmd, 'status'), NS.gmd, 'MD_ProgressCode') : null
  const status = stEl ? (stEl.getAttribute('codeListValue') || xmlText(stEl)).trim() : ''

  /** @type {string[]} */
  const citationDates = []
  if (cite) {
    const dates = cite.getElementsByTagNameNS(NS.gmd, 'date')
    for (let i = 0; i < dates.length; i += 1) {
      const ci = firstNS(dates[i], NS.gmd, 'CI_Date')
      if (!ci) continue
      const dt = firstNS(ci, NS.gmd, 'date')
      const inner = dt ? firstNS(dt, NS.gco, 'Date') || firstNS(dt, NS.gco, 'DateTime') : null
      const dateStr = inner ? norm(xmlText(inner)) : ''
      const dtt = firstNS(ci, NS.gmd, 'dateType')
      const code = dtt ? firstNS(dtt, NS.gmd, 'CI_DateTypeCode') : null
      const typeVal = (code?.getAttribute('codeListValue') || xmlText(code || null)).toLowerCase()
      citationDates.push(`${typeVal}:${dateStr}`)
    }
  }

  const extentWrap = dataId ? firstNS(dataId, NS.gmd, 'extent') : null
  const exExtent = extentWrap ? firstNS(extentWrap, NS.gmd, 'EX_Extent') : null
  const box = exExtent ? firstNS(firstNS(exExtent, NS.gmd, 'geographicElement'), NS.gmd, 'EX_GeographicBoundingBox') : null
  const west = box ? gmdFreeText(firstNS(box, NS.gmd, 'westBoundLongitude')) : ''
  const east = box ? gmdFreeText(firstNS(box, NS.gmd, 'eastBoundLongitude')) : ''
  const south = box ? gmdFreeText(firstNS(box, NS.gmd, 'southBoundLatitude')) : ''
  const north = box ? gmdFreeText(firstNS(box, NS.gmd, 'northBoundLatitude')) : ''

  let geoDesc = ''
  if (exExtent) {
    const descs = exExtent.getElementsByTagNameNS(NS.gmd, 'description')
    for (let i = 0; i < descs.length; i += 1) {
      const t = gmdFreeText(descs[i])
      if (t && !t.startsWith('Vertical CRS:') && !t.startsWith('Trajectory sampling:')) {
        geoDesc = t
        break
      }
    }
  }

  const vx = exExtent ? firstNS(firstNS(exExtent, NS.gmd, 'verticalElement'), NS.gmd, 'EX_VerticalExtent') : null
  const vmin = vx ? gmdFreeText(firstNS(vx, NS.gmd, 'minimumValue')) : ''
  const vmax = vx ? gmdFreeText(firstNS(vx, NS.gmd, 'maximumValue')) : ''

  let temporalStart = ''
  let temporalEnd = ''
  const tempEl = exExtent ? firstNS(firstNS(exExtent, NS.gmd, 'temporalElement'), NS.gmd, 'EX_TemporalExtent') : null
  const inner = tempEl ? firstNS(tempEl, NS.gmd, 'extent') : null
  const tp = inner ? inner.getElementsByTagNameNS(NS.gml, 'TimePeriod')[0] || inner.getElementsByTagName('TimePeriod')[0] : null
  if (tp) {
    temporalStart =
      norm(xmlText(firstNS(tp, NS.gml, 'beginPosition'))) ||
      norm(xmlText(firstNS(tp, NS.gml, 'begin'))) ||
      ''
    temporalEnd =
      norm(xmlText(firstNS(tp, NS.gml, 'end'))) ||
      norm(xmlText(firstNS(tp, NS.gml, 'endPosition'))) ||
      ''
  }

  /** Non-placeholder keyword display strings */
  let keywordLeafCount = 0
  if (dataId) {
    const dks = dataId.getElementsByTagNameNS(NS.gmd, 'descriptiveKeywords')
    for (let i = 0; i < dks.length; i += 1) {
      const mk = firstNS(dks[i], NS.gmd, 'MD_Keywords')
      if (!mk) continue
      const kws = mk.getElementsByTagNameNS(NS.gmd, 'keyword')
      for (let k = 0; k < kws.length; k += 1) {
        const kw = kws[k]
        const t = norm(gmdFreeText(kw) || xmlText(kw))
        if (t && !isPlaceholder(t)) keywordLeafCount += 1
      }
    }
  }

  /** Count all `gmi:MI_Instrument` under acquisition (preview duplicates sibling + nested instruments). */
  let sensorInstrumentBlocks = 0
  const acq = firstNS(root, NS.gmd, 'acquisitionInformation')
  if (acq) {
    sensorInstrumentBlocks = acq.getElementsByTagNameNS(NS.gmi, 'MI_Instrument').length
  }

  const metaName = gmdFreeText(firstNS(root, NS.gmd, 'metadataStandardName'))
  const metaVer = gmdFreeText(firstNS(root, NS.gmd, 'metadataStandardVersion'))

  return {
    fileId,
    title,
    abstract,
    purpose,
    supplementalInformation: supp,
    status,
    citationDatesJoined: citationDates.join('|'),
    west,
    east,
    south,
    north,
    geographicDescription: geoDesc,
    vmin,
    vmax,
    temporalStart,
    temporalEnd,
    keywordLeafCount,
    sensorInstrumentBlocks,
    metadataStandardName: metaName,
    metadataStandardVersion: metaVer,
  }
}

/**
 * @param {Record<string, string | number>} original
 * @param {Record<string, string | number>} imported
 */
/** Probes where string equality is too brittle for “empty = missing” (date joins, rough counts). */
const SKIP_MISSING_PROBE = new Set(['citationDatesJoined', 'distributionTextLeaves'])

function missingImportedFields(original, imported) {
  /** @type {Array<{ probe: string, originalSample: string, importedSample: string }>} */
  const missing = []
  for (const key of Object.keys(original)) {
    if (SKIP_MISSING_PROBE.has(key)) continue
    const oVal = original[key]
    const iVal = imported[key]
    const oStr = typeof oVal === 'number' ? String(oVal) : norm(oVal)
    const iStr = typeof iVal === 'number' ? String(iVal) : norm(iVal)
    if (typeof oVal === 'number') {
      const iNum = typeof iVal === 'number' ? iVal : Number.parseInt(iStr, 10)
      if (oVal > 0 && (!Number.isFinite(iNum) || iNum === 0)) {
        missing.push({
          probe: key,
          originalSample: String(oVal),
          importedSample: Number.isFinite(iNum) ? String(iNum) : iStr || '(empty)',
        })
      }
      continue
    }
    if (isPlaceholder(oStr)) continue
    if (!oStr || oStr.length < 2) continue
    if (oStr && (!iStr || iStr.length === 0)) {
      missing.push({
        probe: key,
        originalSample: oStr.length > 120 ? `${oStr.slice(0, 117)}…` : oStr,
        importedSample: iStr || '(empty)',
      })
    }
  }
  return missing
}

/** @param {string} xmlFile */
function xmllintNoout(xmlFile) {
  const r = spawnSync('xmllint', ['--noout', xmlFile], { encoding: 'utf8' })
  return {
    ok: r.status === 0,
    status: r.status ?? -1,
    stderr: String(r.stderr || '').trim(),
  }
}

function parseArgs(argv) {
  let xmlArg = ''
  let outDir = ''
  let skipFullLeaves = false
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--xml') xmlArg = path.resolve(ROOT, argv[++i] || '')
    else if (a === '--out-dir') outDir = path.resolve(argv[++i] || '')
    else if (a === '--skip-full-leaves') skipFullLeaves = true
  }
  const defaults = [
    path.join(ROOT, 'fixtures/mission/navy-uxs-gmi-template-2026.xml'),
    path.join(REPO_ROOT, 'NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml'),
    path.join(ROOT, 'fixtures/mission/navy-uxs-swarm-clean.xml'),
  ]
  const xmlPath = xmlArg || defaults.find((p) => fs.existsSync(p)) || ''
  const resolvedOut = outDir || path.join(ROOT, 'reports/navy-import-preview-compare')
  return { xmlPath, outDir: resolvedOut, skipFullLeaves }
}

const { xmlPath, outDir, skipFullLeaves } = parseArgs(process.argv.slice(2))

if (!xmlPath || !fs.existsSync(xmlPath)) {
  console.error('Pass a Navy ISO 19115-2 XML via --xml <path> (or place navy-uxs-gmi-template-2026.xml in fixtures/mission/).')
  process.exit(1)
}

const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
const { defaultPilotState, mergeLoadedPilotState, sanitizePilotState } = await import(
  path.join(ROOT, 'src/lib/pilotValidation.js'),
)
const { buildXmlPreview } = await import(path.join(ROOT, 'src/lib/xmlPreviewBuilder.js'))

const rawXml = fs.readFileSync(xmlPath, 'utf8')
const doc = new DOMParser().parseFromString(rawXml, 'application/xml')
const originalProbes = extractOriginalProbes(doc)

const parsed = importPilotPartialStateFromXml(rawXml)
if (!parsed.ok) {
  console.error('Import failed:', parsed.error)
  process.exit(1)
}

const merged = sanitizePilotState(mergeLoadedPilotState(defaultPilotState(), parsed.partial))
const m = merged.mission && typeof merged.mission === 'object' ? merged.mission : {}
const sp = merged.spatial && typeof merged.spatial === 'object' ? merged.spatial : {}
const dist = merged.distribution && typeof merged.distribution === 'object' ? merged.distribution : {}
const kw = merged.keywords && typeof merged.keywords === 'object' ? merged.keywords : {}
const sensors = Array.isArray(merged.sensors) ? merged.sensors : []

const facetKeys = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']
let importedKeywordCount = 0
for (const f of facetKeys) {
  if (Array.isArray(kw[f])) importedKeywordCount += kw[f].filter((x) => x && (String(x.label || '').trim() || String(x.uuid || '').trim())).length
}

/** Pilot state uses logical sensor rows (preview XML may emit more `MI_Instrument` nodes than rows). */
const importedProbes = {
  fileId: norm(m.fileId),
  title: norm(m.title),
  abstract: norm(m.abstract),
  purpose: norm(m.purpose),
  supplementalInformation: norm(m.supplementalInformation),
  status: norm(m.status),
  citationDatesJoined: ['pub:' + norm(m.publicationDate), 'start:' + norm(m.startDate), 'end:' + norm(m.endDate)]
    .filter((s) => !s.endsWith(':'))
    .join('|'),
  west: norm(m.west),
  east: norm(m.east),
  south: norm(m.south),
  north: norm(m.north),
  geographicDescription: norm(sp.geographicDescription),
  vmin: norm(m.vmin),
  vmax: norm(m.vmax),
  temporalStart: norm(m.startDate),
  temporalEnd: norm(m.endDate),
  keywordLeafCount: importedKeywordCount,
  sensorInstrumentBlocks: sensors.length,
  metadataStandardName: norm(dist.metadataStandard),
  metadataStandardVersion: norm(dist.metadataVersion),
}

const missing = missingImportedFields(
  /** @type {Record<string, string | number>} */ (originalProbes),
  /** @type {Record<string, string | number>} */ (importedProbes),
)

const previewXml = buildXmlPreview(merged)
const previewDoc = new DOMParser().parseFromString(previewXml, 'application/xml')
const previewProbes = extractOriginalProbes(previewDoc)

const previewVsOriginalMissing = missingImportedFields(
  /** @type {Record<string, string | number>} */ (originalProbes),
  /** @type {Record<string, string | number>} */ (previewProbes),
)

fs.mkdirSync(outDir, { recursive: true })
const base = path.basename(xmlPath, '.xml').replace(/[^a-z0-9_-]+/gi, '-')
const previewPath = path.join(outDir, `${base}-preview-from-import.xml`)
const originalCopyPath = path.join(outDir, `${base}-original.xml`)
fs.writeFileSync(previewPath, previewXml, 'utf8')
fs.writeFileSync(originalCopyPath, rawXml, 'utf8')

let diffSnippet = ''
const diffRes = spawnSync('diff', ['-u', originalCopyPath, previewPath], { encoding: 'utf8' })
if (diffRes.stdout && diffRes.stdout.length < 120_000) {
  diffSnippet = diffRes.stdout
} else if (diffRes.stdout) {
  diffSnippet = `${diffRes.stdout.slice(0, 80_000)}\n… (truncated)\n`
}
const diffPath = path.join(outDir, `${base}-diff-u.txt`)
fs.writeFileSync(diffPath, diffSnippet || '(diff unavailable or identical)\n', 'utf8')

/** @type {Record<string, unknown>} */
const report = {
  generatedAt: new Date().toISOString(),
  sourceXml: path.relative(ROOT, xmlPath),
  importWarnings: parsed.warnings || [],
  counts: {
    probesConsidered: Object.keys(originalProbes).length,
    missingAfterImport: missing.length,
    missingOriginalVsPreviewXml: previewVsOriginalMissing.length,
    originalXmlChars: rawXml.length,
    previewXmlChars: previewXml.length,
  },
  missingAfterImport: missing,
  missingOriginalVsPreviewXml: previewVsOriginalMissing,
  originalProbes,
  importedProbes,
  previewProbes,
  writtenFiles: {
    originalCopy: path.relative(ROOT, originalCopyPath),
    previewFromImport: path.relative(ROOT, previewPath),
    unifiedDiff: path.relative(ROOT, diffPath),
  },
}

let xmllintOriginal = { ok: false, status: -1, stderr: '(skipped)' }
let xmllintPreview = { ok: false, status: -1, stderr: '(skipped)' }
try {
  xmllintOriginal = xmllintNoout(originalCopyPath)
  xmllintPreview = xmllintNoout(previewPath)
} catch {
  xmllintOriginal = { ok: false, status: -1, stderr: 'xmllint not available' }
  xmllintPreview = { ok: false, status: -1, stderr: 'xmllint not available' }
}
report.xmllint = { original: xmllintOriginal, preview: xmllintPreview }

const LEAF_DIFF_CAP = 8000
if (!skipFullLeaves) {
  const leavesOriginal = collectXmlLeafEntries(doc)
  const leavesPreview = collectXmlLeafEntries(previewDoc)
  const msO = multisetFromEntries(leavesOriginal)
  const msP = multisetFromEntries(leavesPreview)
  const leafDiffRows = diffLeafMultisets(msO, msP)
  const onlyOrig = leafDiffRows.filter((r) => r.onlyIn === 'original')
  const onlyPrev = leafDiffRows.filter((r) => r.onlyIn === 'preview')

  report.counts.fullLeafEntriesOriginal = leavesOriginal.length
  report.counts.fullLeafEntriesPreview = leavesPreview.length
  report.counts.fullLeafMultisetDiffRows = leafDiffRows.length
  report.counts.fullLeafOnlyInOriginalRows = onlyOrig.length
  report.counts.fullLeafOnlyInPreviewRows = onlyPrev.length

  const leafDiffPath = path.join(outDir, `${base}-leaf-multiset-diff.json`)
  const summary = {
    generatedAt: report.generatedAt,
    sourceXml: report.sourceXml,
    counts: report.counts,
    multisetDiffSample: leafDiffRows.slice(0, LEAF_DIFF_CAP),
    truncated: leafDiffRows.length > LEAF_DIFF_CAP,
  }
  fs.writeFileSync(leafDiffPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  report.writtenFiles.leafMultisetDiff = path.relative(ROOT, leafDiffPath)

  function formatLeafLines(rows) {
    return rows.map((r) => `${r.count}\t${r.path}\t${r.text.replace(/\n/g, ' ')}`).join('\n')
  }
  const onlyOrigPath = path.join(outDir, `${base}-only-in-original-leaves.txt`)
  const onlyPrevPath = path.join(outDir, `${base}-only-in-preview-leaves.txt`)
  fs.writeFileSync(onlyOrigPath, `${formatLeafLines(onlyOrig)}\n`, 'utf8')
  fs.writeFileSync(onlyPrevPath, `${formatLeafLines(onlyPrev)}\n`, 'utf8')
  report.writtenFiles.onlyInOriginalLeaves = path.relative(ROOT, onlyOrigPath)
  report.writtenFiles.onlyInPreviewLeaves = path.relative(ROOT, onlyPrevPath)
} else {
  report.skippedFullLeaves = true
}

const wf = /** @type {Record<string, string>} */ (report.writtenFiles)
const xl = /** @type {{ original: { ok: boolean; stderr?: string }; preview: { ok: boolean; stderr?: string } }} */ (
  report.xmllint
)
const counts = /** @type {Record<string, number | string>} */ (report.counts)

const md = `# Navy template: import vs preview vs original

- **Source:** \`${report.sourceXml}\`
- **Generated:** ${report.generatedAt}

## Counts

| Metric | Value |
|--------|------:|
| Semantic probes (original XML) | ${counts.probesConsidered} |
| **Not inserted into pilotState** (non-placeholder original text, empty after import) | **${counts.missingAfterImport}** |
| **Original vs preview XML** (same probe gap after round-trip preview) | **${counts.missingOriginalVsPreviewXml}** |
| Original file size (chars) | ${counts.originalXmlChars} |
| Preview-from-import size (chars) | ${counts.previewXmlChars} |
${!skipFullLeaves ? `| Text leaves collected (original / preview) | ${counts.fullLeafEntriesOriginal} / ${counts.fullLeafEntriesPreview} |
| Multiset diff rows (path+text count deltas) | ${counts.fullLeafMultisetDiffRows} |
| Only in original (excess multiset rows) | ${counts.fullLeafOnlyInOriginalRows} |
| Only in preview (excess multiset rows) | ${counts.fullLeafOnlyInPreviewRows} |
` : '| Full leaf inventory | _skipped (--skip-full-leaves)_ |\n'}

## xmllint --noout

| File | OK | stderr (if any) |
|------|:--:|-----------------|
| Original copy | ${xl.original.ok ? 'yes' : 'no'} | \`${String(xl.original.stderr || '').slice(0, 400).replace(/`/g, "'")}\` |
| Preview from import | ${xl.preview.ok ? 'yes' : 'no'} | \`${String(xl.preview.stderr || '').slice(0, 400).replace(/`/g, "'")}\` |

## Files to compare

- Original copy: \`${wf.originalCopy}\`
- Preview from import: \`${wf.previewFromImport}\`
- \`diff -u\` output: \`${wf.unifiedDiff}\`
${wf.leafMultisetDiff ? `- Leaf multiset diff JSON: \`${wf.leafMultisetDiff}\` (first ${LEAF_DIFF_CAP} rows in \`multisetDiffSample\`)` : ''}
${wf.onlyInOriginalLeaves ? `- Leaves only in original: \`${wf.onlyInOriginalLeaves}\`` : ''}
${wf.onlyInPreviewLeaves ? `- Leaves only in preview: \`${wf.onlyInPreviewLeaves}\`` : ''}

Run locally: \`diff -u "${originalCopyPath}" "${previewPath}" | less\`

## Not inserted after import (${missing.length})

${missing.length ? missing.map((x) => `- **${x.probe}** — original: \`${x.originalSample.replace(/`/g, "'")}\``).join('\n') : '_None — all sampled probes had some value in merged state, or original was placeholder._'}

## Original vs rebuilt preview XML (${previewVsOriginalMissing.length})

${previewVsOriginalMissing.length ? previewVsOriginalMissing.map((x) => `- **${x.probe}**`).join('\n') : '_Same probe list aligned for preview rebuild._'}

## Full text-leaf inventory

Every **element that has no element children** contributes one row \`path TAB text\` (placeholders \`{{…}}\` omitted). Multiset diff counts duplicate identical path+text pairs. Preview omits large branches of the Navy template, so **only-in-original** is usually large.

${!skipFullLeaves ? `_See \`${wf.onlyInOriginalLeaves}\` / \`${wf.onlyInPreviewLeaves}\` for sorted multiset deltas._` : '_Pass without \`--skip-full-leaves\` to generate leaf files._'}

**Note:** Semantic probe rows above remain the quickest “did import drop title/bbox?” check. \`sensorInstrumentBlocks\` in probes counts \`gmi:MI_Instrument\` nodes under acquisition; **Imported** uses \`sensors.length\`.
`

const jsonPath = path.join(outDir, `${base}-compare-report.json`)
const mdPath = path.join(outDir, `${base}-compare-report.md`)
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
fs.writeFileSync(mdPath, md, 'utf8')

console.log(`Source: ${xmlPath}`)
console.log(`Not inserted (import vs original probes): ${missing.length}`)
console.log(`Probe gaps (original vs preview XML): ${previewVsOriginalMissing.length}`)
if (!skipFullLeaves && counts.fullLeafMultisetDiffRows != null) {
  console.log(
    `Full leaf multiset diff rows: ${counts.fullLeafMultisetDiffRows} (only-in-original: ${counts.fullLeafOnlyInOriginalRows}, only-in-preview: ${counts.fullLeafOnlyInPreviewRows})`,
  )
}
console.log(`Wrote:\n  ${previewPath}\n  ${originalCopyPath}\n  ${diffPath}\n  ${jsonPath}\n  ${mdPath}`)
if (wf.leafMultisetDiff) console.log(`  ${path.join(ROOT, wf.leafMultisetDiff)}`)
if (wf.onlyInOriginalLeaves) console.log(`  ${path.join(ROOT, wf.onlyInOriginalLeaves)}`)
if (wf.onlyInPreviewLeaves) console.log(`  ${path.join(ROOT, wf.onlyInPreviewLeaves)}`)
