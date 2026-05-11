#!/usr/bin/env node
/**
 * For each sample XML: import → merge → list pilot paths that are still empty / default,
 * plus **potential mapping gaps** where the XML appears to carry content that did not map.
 *
 * Usage (from react-pilot/):
 *   node scripts/report-sample-import-gaps.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}
const _probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const _elProto = Object.getPrototypeOf(_probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(_elProto, 'children')) {
  Object.defineProperty(_elProto, 'children', {
    configurable: true,
    enumerable: true,
    get() {
      return Array.from(this.childNodes || []).filter((n) => n?.nodeType === 1)
    },
  })
}

import { defaultPilotState, mergeLoadedPilotState } from '../src/lib/pilotValidation.js'
import { PILOT_IMPORT_REPORT_TRACK_PATHS } from '../src/lib/pilotImportReportPaths.js'
import { importPilotPartialStateFromXml } from '../src/lib/xmlPilotImport.js'

const TRACK = PILOT_IMPORT_REPORT_TRACK_PATHS

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(__dirname, '..')

/** @param {string} dir relative to ROOT or includes `..` */
function collectXml(dir) {
  const out = []
  const abs = path.resolve(ROOT, dir)
  if (!fs.existsSync(abs)) return out
  function walk(d) {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, ent.name)
      if (ent.isDirectory()) {
        if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue
        walk(p)
      } else if (ent.name.endsWith('.xml')) out.push(path.relative(ROOT, p))
    }
  }
  walk(abs)
  return out.sort()
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

function isEmptyScalar(v) {
  if (v === undefined || v === null) return true
  if (typeof v === 'boolean') return !v
  if (typeof v === 'number') return !Number.isFinite(v)
  if (typeof v === 'string') return v.trim() === ''
  return false
}

/** Sensor row has no meaningful content */
function sensorRowEmpty(s) {
  if (!s || typeof s !== 'object') return true
  const id = String(s.sensorId ?? '').trim()
  const t = String(s.type ?? '').trim()
  const v = String(s.variable ?? '').trim()
  const m = String(s.modelId ?? '').trim()
  return !id && !t && !v && !m
}

/** @param {import('@xmldom/xmldom').Element} el */
function elementText(el) {
  return String(el?.textContent ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * True when `linkage` sits under `distributionInfo` / `MD_Distribution` (dataset distribution), not keyword/thesaurus/contact-only URLs.
 * @param {import('@xmldom/xmldom').Element | null | undefined} el
 */
function linkageInsideDistributionTree(el) {
  let p = el?.parentNode
  for (let i = 0; i < 80 && p && p.nodeType === 1; i++) {
    const ln = /** @type {import('@xmldom/xmldom').Element} */ (p).localName || ''
    if (ln === 'distributionInfo' || ln === 'MD_Distribution') return true
    p = p.parentNode
  }
  return false
}

/**
 * True when `referenceSystemIdentifier` lives under vertical geometry (extent / VerticalCRS), not generic horizontal CRS at metadata root.
 * @param {import('@xmldom/xmldom').Element | null | undefined} el
 */
function referenceIdentifierUnderVerticalContext(el) {
  let p = el?.parentNode
  for (let i = 0; i < 80 && p && p.nodeType === 1; i++) {
    const ln = /** @type {import('@xmldom/xmldom').Element} */ (p).localName || ''
    if (
      ln === 'verticalElement' ||
      ln === 'EX_VerticalExtent' ||
      ln === 'verticalCRS' ||
      ln === 'VerticalCRS'
    ) {
      return true
    }
    p = p.parentNode
  }
  return false
}

/** Report types whose quantitative results map to `spatial.accuracyValue` / `spatial.errorValue`. */
const POSITIONAL_DQ_REPORT = new Set([
  'DQ_AbsoluteExternalPositionalAccuracy',
  'DQ_QuantitativeAttributeAccuracy',
  'DQ_GriddedDataPositionalAccuracy',
])

/**
 * Ignore `DQ_QuantitativeResult` under e.g. `DQ_ConceptualConsistency` (stewardship codelists, not positional decimals).
 * @param {import('@xmldom/xmldom').Element | null | undefined} el
 */
function quantitativeResultUnderPositionalDq(el) {
  let p = el?.parentNode
  for (let i = 0; i < 80 && p && p.nodeType === 1; i++) {
    const ln = /** @type {import('@xmldom/xmldom').Element} */ (p).localName || ''
    if (POSITIONAL_DQ_REPORT.has(ln)) return true
    p = p.parentNode
  }
  return false
}

/**
 * Walk XML tree (namespace-agnostic) and collect structural/text signals for gap detection.
 * @param {import('@xmldom/xmldom').Document} doc
 */
function collectXmlSignals(doc) {
  const root = doc.documentElement
  /** @type {Record<string, boolean>} */
  const s = {}
  if (!root) return s

  /** @param {import('@xmldom/xmldom').Element} el */
  function walk(el) {
    const ln = el.localName || ''
    const text = elementText(el)

    if (ln === 'abstract' && text.length > 20) s.abstract = true
    if (ln === 'purpose' && text.length > 2) s.purpose = true
    if (ln === 'alternateTitle' && text.length > 2) s.alternateTitle = true
    if (ln === 'supplementalInformation' && text.length > 10) s.supplementalInformation = true
    if (ln === 'graphicOverview' || ln === 'MD_BrowseGraphic') s.graphicOverview = true
    if (ln === 'aggregationInfo' || ln === 'MD_AggregateInformation') s.aggregationInfo = true
    if (ln === 'descriptiveKeywords') s.descriptiveKeywords = true
    if (ln === 'MD_Keywords') s.mdKeywords = true
    if (ln === 'topicCategory' || ln === 'MD_TopicCategoryCode') s.topicCategory = true
    if (ln === 'keyword' && (text.length > 2 || el.getElementsByTagName('*').length)) {
      for (let i = 0; i < el.childNodes.length; i++) {
        const n = el.childNodes[i]
        if (n.nodeType === 1 && n.localName === 'Anchor') {
          s.keywordLeaf = true
          break
        }
      }
      if (text.length > 2) s.keywordLeaf = true
    }
    if (ln === 'linkage' && /\bhttps?:\/\//i.test(text) && linkageInsideDistributionTree(el)) {
      s.distributionLinkageHttp = true
    }
    if (ln === 'LI_Lineage') s.liLineage = true
    if (ln === 'statement' && text.length > 15 && el.parentNode?.localName === 'LI_Lineage') s.lineageStatement = true
    if (ln?.startsWith('DQ_') || ln === 'DQ_DataQuality') s.dataQuality = true
    if (ln === 'DQ_QuantitativeResult' && quantitativeResultUnderPositionalDq(el)) {
      s.dqPositionalQuantitativeResult = true
    }
    if (ln === 'EX_VerticalExtent' || ln === 'verticalCRS' || ln === 'VerticalCRS' || ln === 'verticalElement') {
      s.verticalRef = true
    }
    if (ln === 'referenceSystemIdentifier') {
      const hint = /VERTICAL|VERT\s+CRS|VERT\s+DATUM|ELLIPSOID(AL)?\s+HEIGHT|\bMSL\b|\bNAVD\b|\bEGM\b/i.test(text)
      if (hint || referenceIdentifierUnderVerticalContext(el)) {
        s.verticalRef = true
      }
    }
    if (ln === 'MI_Instrument') s.miInstrument = true
    if (ln === 'MI_CoverageDescription') s.miCoverage = true
    if (ln === 'MI_Platform') s.miPlatform = true
    if (ln === 'organisationName' && text.length > 2) s.organisationName = true
    if (ln === 'individualName' && text.length > 2) s.individualName = true
    if (ln === 'CI_Citation') s.ciCitation = true
    if (ln === 'MD_DataIdentification') s.mdDataIdentification = true
    if (ln === 'metadataIdentifier') s.metadataIdentifierEl = true
    if (ln === 'title' && text.length > 5) s.anyTitle = true
    if (ln === 'code' && /^10\.\d+/m.test(text)) s.doiLike = true
    if (ln === 'fileIdentifier') s.fileIdentifierEl = true
    if (ln === 'MD_Identifier' && text.length > 3) s.mdIdentifier = true

    for (let i = 0; i < el.childNodes.length; i++) {
      const n = el.childNodes[i]
      if (n.nodeType === 1) walk(/** @type {import('@xmldom/xmldom').Element} */ (n))
    }
  }

  walk(root)

  /* Title likely identifies resource (not only thesaurus): title + data identification section */
  if (s.anyTitle && s.mdDataIdentification) s.resourceTitle = true

  return s
}

function keywordsAllFacetsEmpty(merged) {
  const kw = merged.keywords || {}
  const facets = ['sciencekeywords', 'datacenters', 'platforms', 'instruments', 'locations', 'projects', 'providers']
  return facets.every((f) => !Array.isArray(kw[f]) || kw[f].length === 0)
}

function distributionUrlsEmpty(merged) {
  const d = merged.distribution || {}
  return (
    isEmptyScalar(d.landingUrl) &&
    isEmptyScalar(d.downloadUrl) &&
    isEmptyScalar(d.metadataLandingUrl)
  )
}

function aggregationMissionUnset(merged) {
  const m = merged.mission || {}
  return ![
    m.parentProjectTitle,
    m.relatedDatasetTitle,
    m.relatedDataUrl,
    m.associatedPublicationTitle,
    m.relatedDatasetCode,
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean).length
}

function sensorsActiveCount(merged) {
  const sens = Array.isArray(merged.sensors) ? merged.sensors : []
  return sens.filter((s) => !sensorRowEmpty(s)).length
}

/**
 * Heuristic: XML suggests content that did not appear on merged pilotState.
 * @param {Record<string, boolean>} sig
 * @param {object} merged
 */
function potentialMappingGaps(sig, merged) {
  /** @type {string[]} */
  const gaps = []
  const m = merged.mission || {}
  const sp = merged.spatial || {}
  const pl = merged.platform || {}

  if (sig.abstract && isEmptyScalar(m.abstract)) {
    gaps.push('`mission.abstract` — XML has substantial `abstract` text')
  }
  if (sig.purpose && isEmptyScalar(m.purpose)) {
    gaps.push('`mission.purpose` — XML has `purpose`')
  }
  if (sig.alternateTitle && isEmptyScalar(m.alternateTitle)) {
    gaps.push('`mission.alternateTitle` — XML has `alternateTitle`')
  }
  if (sig.supplementalInformation && isEmptyScalar(m.supplementalInformation)) {
    gaps.push('`mission.supplementalInformation` — XML has supplemental text')
  }
  if (sig.resourceTitle && isEmptyScalar(m.title)) {
    gaps.push('`mission.title` — XML has `title` text under identification')
  }
  if (sig.doiLike && isEmptyScalar(m.doi)) {
    gaps.push('`mission.doi` — XML has identifier/code resembling a DOI')
  }
  if (
    (sig.metadataIdentifierEl || sig.fileIdentifierEl) &&
    isEmptyScalar(m.fileId)
  ) {
    gaps.push('`mission.fileId` — XML has `metadataIdentifier` / `fileIdentifier` block')
  }
  if (sig.topicCategory && !(Array.isArray(m.topicCategories) && m.topicCategories.length)) {
    gaps.push('`mission.topicCategories` — XML has `topicCategory` / topic code')
  }
  if (
    (sig.descriptiveKeywords || sig.mdKeywords) &&
    sig.keywordLeaf &&
    keywordsAllFacetsEmpty(merged)
  ) {
    gaps.push(
      '`keywords.*` — XML has descriptive keywords / keyword entries but no facet arrays populated',
    )
  }
  if (sig.distributionLinkageHttp && distributionUrlsEmpty(merged)) {
    gaps.push(
      '`distribution.*` URLs — XML has http(s) `linkage` under `distributionInfo` / `MD_Distribution` but pilot distribution slots are empty',
    )
  }
  if (sig.graphicOverview && isEmptyScalar(m.graphicOverviewHref)) {
    gaps.push('`mission.graphicOverviewHref` — XML has graphic overview / browse graphic')
  }
  if (sig.aggregationInfo && aggregationMissionUnset(merged)) {
    gaps.push(
      'mission aggregation (`parentProjectTitle`, `relatedDataset*`, `relatedDataUrl`, …) — XML has `aggregationInfo`',
    )
  }
  if ((sig.lineageStatement || sig.liLineage) && isEmptyScalar(sp.lineageStatement)) {
    gaps.push('`spatial.lineageStatement` — XML has lineage / `LI_Lineage` / `statement`')
  }
  if (
    sig.dqPositionalQuantitativeResult &&
    isEmptyScalar(sp.accuracyValue) &&
    isEmptyScalar(sp.errorValue)
  ) {
    gaps.push(
      '`spatial.accuracyValue` / `spatial.errorValue` — XML has positional-accuracy `DQ_QuantitativeResult` but values did not map',
    )
  }
  if (sig.verticalRef && isEmptyScalar(sp.verticalCrsUrl)) {
    gaps.push('`spatial.verticalCrsUrl` — XML has vertical extent / vertical CRS references')
  }
  if ((sig.miInstrument || sig.miCoverage) && sensorsActiveCount(merged) === 0) {
    gaps.push('`sensors[]` — XML has `MI_Instrument` / `MI_CoverageDescription`')
  }
  if (sig.miPlatform && isEmptyScalar(pl.platformId) && isEmptyScalar(pl.platformDesc)) {
    gaps.push('`platform.platformId` / `platform.platformDesc` — XML has `MI_Platform`')
  }
  if (sig.organisationName && isEmptyScalar(m.org)) {
    gaps.push('`mission.org` — XML has `organisationName`')
  }
  if (sig.individualName && isEmptyScalar(m.individualName)) {
    gaps.push('`mission.individualName` — XML has `individualName`')
  }

  return gaps
}

function unsetPaths(merged) {
  const missing = []
  for (const dot of TRACK) {
    const v = getPath(merged, dot)
    if (dot.startsWith('keywords.')) {
      const arr = Array.isArray(v) ? v : []
      if (!arr.length) missing.push(dot)
      continue
    }
    if (dot === 'mission.topicCategories') {
      const arr = Array.isArray(v) ? v : []
      if (!arr.length) missing.push(dot)
      continue
    }
    if (isEmptyScalar(v)) missing.push(dot)
  }
  const sens = Array.isArray(merged.sensors) ? merged.sensors : []
  const active = sens.filter((s) => !sensorRowEmpty(s))
  if (!active.length) missing.push('sensors (any row with id/type/variable)')
  return missing
}

const SAMPLE_DIRS = [
  'public/demo-records',
  'fixtures/mission',
  path.join('..', 'MANTA End User Testing', 'samples'),
]

function main() {
  let all = []
  for (const d of SAMPLE_DIRS) all.push(...collectXml(d))
  all = [...new Set(all)].sort()

  const lines = []
  lines.push('# Sample XML import gap report')
  lines.push('')
  lines.push('Generated by `node scripts/report-sample-import-gaps.mjs`.')
  lines.push('')
  lines.push('## How to use this report')
  lines.push('')
  lines.push('This is an **engineering regression map** for `importPilotPartialStateFromXml` → `pilotState`, not a checklist that every row must be non-empty.')
  lines.push('')
  lines.push('- **Unset tracked fields** — Wizard paths that are still blank/default after merge. Many are optional, absent in the XML, or intentionally not mapped yet. Treat as volume/context, not automatic bugs.')
  lines.push('- **Potential XML→pilot mapping gaps** — Heuristic: the XML *looks like* it carries that kind of information, but the merged pilot field is empty. **Prioritize fixes when the same gap repeats across many files** (themes in your backlog).')
  lines.push('- **What to do next** — (1) Group recurring gap lines (e.g. browse graphic, lineage, vertical CRS, POC `individualName`). (2) Open one representative XML in an editor and confirm the element exists and where it lives (identification vs distributor vs contact). **Distribution gaps** only count `linkage` under `distributionInfo` / `MD_Distribution`. **Vertical CRS gaps** use vertical extent / `VerticalCRS` / vertical-leaning identifier text (horizontal `EPSG:…` in `referenceSystemInfo` alone is ignored). **DQ accuracy gaps** only fire when `DQ_QuantitativeResult` sits under positional report types (`DQ_AbsoluteExternalPositionalAccuracy`, `DQ_QuantitativeAttributeAccuracy`, ISO-3 gridded positional); stewardship / conceptual-consistency quantitative blocks are ignored. Importer: **root metadata contact** http(s) → distribution when no transfer block; **root contact `organisationName`** → `mission.org` when the dataset POC has no org. (3) Extend `xmlPilotImport.js` (+ `-3` paths where relevant), add a fixture or `verify:pilot` check, re-run this script, and confirm gap lines shrink.')
  lines.push('- **Import warnings** — Parser noise (e.g. missing `MD_DataIdentification`) means identification may never populate until the document shape is fixed or the parser is extended.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('Per file below: parse status, import warnings, **tracked pilot paths still empty**, and **potential XML→pilot mapping gaps** (XML structure/text vs merged state).')
  lines.push('BBox defaults −180…180 are not listed; keyword/sensor gaps use facet arrays / active sensor rows.')
  lines.push('')

  for (const rel of all) {
    const abs = path.join(ROOT, rel)
    const xml = fs.readFileSync(abs, 'utf8')
    const parsed = importPilotPartialStateFromXml(xml)
    lines.push(`## ${rel}`)
    lines.push('')
    if (!parsed.ok) {
      lines.push(`- **Parse**: FAILED — ${parsed.error}`)
      lines.push('')
      continue
    }
    const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
    const missing = unsetPaths(merged)
    const sections = Object.keys(parsed.partial || {})

    let gapList = []
    try {
      const dom = new DOMParser().parseFromString(xml, 'application/xml')
      const sig = collectXmlSignals(dom)
      gapList = potentialMappingGaps(sig, merged)
    } catch {
      gapList = ['(could not analyze XML DOM for mapping gaps)']
    }

    if (parsed.warnings?.length) {
      lines.push(`- **Import warnings**: ${parsed.warnings.map((w) => `\`${w}\``).join('; ')}`)
    }
    lines.push(`- **Partial sections**: ${sections.length ? sections.map((s) => `\`${s}\``).join(', ') : '(none)'}`)
    lines.push(`- **Unset tracked fields** (${missing.length}): ${missing.length ? missing.map((m) => `\`${m}\``).join(', ') : '— none —'}`)
    lines.push(
      `- **Potential XML→pilot mapping gaps** (${gapList.length}): ${gapList.length ? gapList.map((g) => `${g}`).join('; ') : '— none detected —'}`,
    )
    lines.push('')
  }

  const outPath = path.join(ROOT, 'reports', 'sample-import-gap-report.md')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(lines.join('\n'))
  console.log(`\nWrote ${path.relative(ROOT, outPath)}`)
}

main()
