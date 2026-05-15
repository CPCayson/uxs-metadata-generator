#!/usr/bin/env node
/**
 * Deep import audit for UxS / Navy / EUT mission XML.
 *
 * Per file:
 * - Source XML: MI_Instrument count, descriptiveKeywords by facet
 * - Import → merge → lenient/strict/catalog validation + ISO-2 preview sanity
 * - Sensor rows (filled vs empty), keyword facet deltas, gap flags
 *
 * Usage:
 *   npm run audit:uxs-depth          # all MANTA EUT samples (20 XML)
 *   npm run audit:navy-depth         # Navy/UxS subset + fixtures
 *   node scripts/audit-navy-xml-depth.mjs --write-reports --eut-samples
 *   node scripts/audit-navy-xml-depth.mjs --write-reports --navy-only
 *   node scripts/audit-navy-xml-depth.mjs --write-reports --include-fixtures
 *
 * Writes (with --write-reports):
 *   --eut-samples  → uxs-xml-depth-audit.{json,md,csv}
 *   --navy-only    → navy-xml-depth-audit.{json,md,csv}
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const REPO_ROOT = path.resolve(ROOT, '..')
const SAMPLES = path.join(REPO_ROOT, 'MANTA End User Testing', 'samples')
const OUT_DIR = path.join(REPO_ROOT, 'MANTA End User Testing', 'reports')

const WRITE_REPORTS = process.argv.includes('--write-reports')
const EUT_SAMPLES = process.argv.includes('--eut-samples')
const NAVY_ONLY = process.argv.includes('--navy-only')
const INCLUDE_FIXTURES = process.argv.includes('--include-fixtures')

const NS = {
  gmd: 'http://www.isotc211.org/2005/gmd',
  gmi: 'http://www.isotc211.org/2005/gmi',
  mac: 'http://standards.iso.org/iso/19115/-3/mac/2.0',
}

function installXmldomChildrenPolyfill() {
  const probe = new DOMParser().parseFromString('<a><b/></a>', 'application/xml').documentElement
  const proto = Object.getPrototypeOf(probe)
  if (Object.getOwnPropertyDescriptor(proto, 'children')) return
  Object.defineProperty(proto, 'children', {
    configurable: true,
    enumerable: true,
    get() {
      return Array.from(this.childNodes || []).filter((n) => n && n.nodeType === 1)
    },
  })
}

installXmldomChildrenPolyfill()
globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}

const { parseProfileXmlImport } = await import(path.join(ROOT, 'src/lib/parseProfileXmlImport.js'))
const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
const { defaultPilotState, mergeLoadedPilotState, validatePilotState } = await import(
  path.join(ROOT, 'src/lib/pilotValidation.js'),
)
const { applyPilotAutoFixes } = await import(path.join(ROOT, 'src/lib/pilotAutoFix.js'))
const { buildXmlPreview } = await import(path.join(ROOT, 'src/lib/xmlPreviewBuilder.js'))
const { missionPreviewIso191152SanityFailures } = await import(
  path.join(ROOT, 'src/lib/iso191152PreviewSanity.js'),
)
const { missionProfile, missionSteps } = await import(path.join(ROOT, 'src/profiles/mission/missionProfile.js'))
const { sensorRowIsInactive } = await import(path.join(ROOT, 'src/lib/pilotValidation.js'))
const { acquisitionInstrumentHasContent } = await import(
  path.join(ROOT, 'src/lib/sensorInstrumentDescription.js'),
)

const KW_FACETS = [
  'sciencekeywords',
  'datacenters',
  'platforms',
  'instruments',
  'locations',
  'projects',
  'providers',
]

/** @param {string} name */
function isNavyUxSFile(name) {
  return (
    /EN2501/i.test(name) ||
    /NOAA_MDBC|PS2418|MDBC_UxS/i.test(name) ||
    /^uxs_test\.xml$/i.test(name) ||
    /navy-uxs/i.test(name) ||
    /PS2418L0/i.test(name)
  )
}

/** @param {string} name */
function classifySample(name) {
  if (isNavyUxSFile(name)) return 'navy-uxs'
  if (/UxS|uxs|AUV|UUV|REMUS|acquisition/i.test(name)) return 'uxs-acquisition'
  if (/inport\./i.test(name)) return 'inport'
  if (/collection/i.test(name)) return 'collection'
  if (/SAMPLE_Populated/i.test(name)) return 'template-populated'
  return 'other-eut'
}

/** @param {string} field */
function stepIdForField(field) {
  if (!field || typeof field !== 'string') return 'other'
  for (const step of missionSteps) {
    for (const prefix of step.ownedFieldPrefixes) {
      if (field === prefix || field.startsWith(prefix)) return step.id
    }
  }
  return 'other'
}

/** @param {Array<{ severity?: string, field?: string }>} issues */
function tallyByStep(issues) {
  /** @type {Record<string, { e: number, w: number }>} */
  const out = {}
  for (const iss of issues || []) {
    const sid = stepIdForField(String(iss.field || ''))
    if (!out[sid]) out[sid] = { e: 0, w: 0 }
    if (iss.severity === 'e') out[sid].e += 1
    else if (iss.severity === 'w') out[sid].w += 1
  }
  return out
}

/** @param {string} dir @param {Map<string, string>} byBase @param {(name: string) => boolean} accept */
function addDirXml(dir, byBase, accept) {
  if (!fs.existsSync(dir)) return
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.xml')) continue
    if (!accept(ent.name)) continue
    const full = path.join(dir, ent.name)
    const prev = byBase.get(ent.name)
    if (!prev || dir === SAMPLES) byBase.set(ent.name, full)
  }
}

/** @returns {string[]} */
function collectXmlPaths() {
  /** @type {Map<string, string>} */
  const byBase = new Map()

  if (EUT_SAMPLES && !NAVY_ONLY) {
    addDirXml(SAMPLES, byBase, () => true)
    return [...byBase.values()].sort()
  }

  if (NAVY_ONLY) {
    addDirXml(SAMPLES, byBase, (name) => isNavyUxSFile(name))
    if (INCLUDE_FIXTURES) {
      addDirXml(path.join(ROOT, 'fixtures', 'mission'), byBase, () => true)
      addDirXml(path.join(ROOT, 'public', 'demo-records'), byBase, () => true)
    }
    return [...byBase.values()].sort()
  }

  addDirXml(SAMPLES, byBase, () => true)
  return [...byBase.values()].sort()
}

/** @param {string} raw */
function detectShape(raw) {
  const h = raw.slice(0, 12000)
  if (/<mdb:MD_Metadata\b/i.test(h) || /19115\/-3\/mdb/i.test(h)) return 'ISO 19115-3'
  if (/<gmi:MI_Metadata\b/i.test(h)) return 'ISO 19115-2 gmi'
  if (/<gmd:MD_Metadata\b/i.test(h)) return 'ISO 19139 gmd'
  return 'unknown'
}

/** @param {import('@xmldom/xmldom').Document} doc */
function countSourceInstruments(doc) {
  const root = doc.documentElement
  if (!root) return { gmi: 0, mac: 0, total: 0 }
  const gmi = root.getElementsByTagNameNS(NS.gmi, 'MI_Instrument').length
  const mac = root.getElementsByTagNameNS(NS.mac, 'MI_Instrument').length
  const local = root.getElementsByTagName('MI_Instrument').length
  return { gmi, mac, total: Math.max(gmi + mac, local) }
}

/** @param {import('@xmldom/xmldom').Element | import('@xmldom/xmldom').Document | null} parent */
function elList(parent, ns, local) {
  if (!parent?.getElementsByTagNameNS) return []
  const list = parent.getElementsByTagNameNS(ns, local)
  const out = []
  for (let i = 0; i < list.length; i += 1) out.push(list[i])
  return out
}

/** @param {import('@xmldom/xmldom').Element | null} el */
function elText(el) {
  if (!el) return ''
  return String(el.textContent || '').replace(/\s+/g, ' ').trim()
}

const NS_XLINK = 'http://www.w3.org/1999/xlink'

/**
 * Map thesaurus title / keyword type code to a GCMD-style facet.
 * Mirrors the importer's facetFromMdKeywordsBlock logic so source counts match import counts.
 * @param {string} title lowercased thesaurus title
 * @param {string} typeCode raw MD_KeywordTypeCode value
 * @returns {string} facet key or '' to skip
 */
function facetFromTitleAndType(title, typeCode) {
  // Thesaurus title takes priority
  if (title) {
    if (title.includes('datacenter') || title.includes('data center')) return 'datacenters'
    if (title.includes('platform')) return 'platforms'
    if (title.includes('instrument')) return 'instruments'
    if (title.includes('location') || title.includes('place')) return 'locations'
    if (title.includes('project')) return 'projects'
    if (title.includes('provider')) return 'providers'
    if (title.includes('science') || title.includes('gcmd') || title.includes('earth')) return 'sciencekeywords'
  }
  // Fall back to keyword type code (mirrors keywordFacetFromIsoKeywordTypeCode)
  const tc = String(typeCode || '').trim().toLowerCase().replace(/\s+/g, '')
  if (tc === 'theme' || tc === 'topic') return 'sciencekeywords'
  if (tc === 'place') return 'locations'
  if (tc === 'project') return 'projects'
  if (tc === 'datacentre' || tc === 'datacenter') return 'datacenters'
  if (tc === 'platform') return 'platforms'
  if (tc === 'instrument') return 'instruments'
  if (tc === 'provider') return 'providers'
  if (tc === 'temporal' || tc === 'stratum') return '' // skip temporal / stratum
  // No type and no recognizable thesaurus → skip (importer drops these too)
  if (!title && !tc) return ''
  // Unrecognized thesaurus with no type: skip rather than mis-classify as science
  return ''
}

/** @param {import('@xmldom/xmldom').Document} doc */
function countSourceKeywordsByFacet(doc) {
  /** @type {Record<string, number>} */
  const out = Object.fromEntries(KW_FACETS.map((f) => [f, 0]))
  const root = doc.documentElement
  if (!root) return out
  const dks = elList(root, NS.gmd, 'descriptiveKeywords')
  for (let di = 0; di < dks.length; di += 1) {
    const dk = dks[di]
    const mks = elList(dk, NS.gmd, 'MD_Keywords')
    for (let mi = 0; mi < mks.length; mi += 1) {
      const mk = mks[mi]

      // Read thesaurus title: prefer nested gmd:CI_Citation/gmd:title, then xlink:title on thesaurusName
      const thesEls = elList(mk, NS.gmd, 'thesaurusName')
      let title = ''
      if (thesEls.length) {
        const titleEls = elList(thesEls[0], NS.gmd, 'title')
        if (titleEls.length) {
          title = elText(titleEls[0]).toLowerCase()
        }
        if (!title) {
          // xlink:title attribute on thesaurusName (SAMPLE_Populated.xml pattern)
          const xlinkAttr =
            thesEls[0].getAttributeNS?.(NS_XLINK, 'title') ||
            thesEls[0].getAttribute?.('xlink:title') ||
            ''
          title = xlinkAttr.toLowerCase()
        }
      }

      // Read keyword type code
      const typeEls = elList(mk, NS.gmd, 'type')
      let typeCode = ''
      if (typeEls.length) {
        const codeEls = typeEls[0].getElementsByTagNameNS
          ? (function () {
              const list = typeEls[0].getElementsByTagNameNS(NS.gmd, 'MD_KeywordTypeCode')
              return list.length ? list[0] : null
            })()
          : null
        if (codeEls) {
          typeCode = codeEls.getAttribute?.('codeListValue') || elText(codeEls) || ''
        }
      }

      const facet = facetFromTitleAndType(title, typeCode)
      if (!facet) continue // skip unclassifiable blocks (importer drops them too)

      const kws = elList(mk, NS.gmd, 'keyword')
      out[facet] = (out[facet] || 0) + kws.length
    }
  }
  return out
}

/** @param {unknown[]} sensors */
function sensorImportStats(sensors) {
  const rows = Array.isArray(sensors) ? sensors : []
  let filled = 0
  let inactive = 0
  /** @type {Array<{ index: number, sensorId: string, type: string, variable: string }>} */
  const samples = []
  rows.forEach((s, i) => {
    if (!s || typeof s !== 'object') {
      inactive += 1
      return
    }
    const r = /** @type {Record<string, unknown>} */ (s)
    const has =
      acquisitionInstrumentHasContent({
        sensorId: String(r.sensorId ?? ''),
        modelId: String(r.modelId ?? ''),
        type: String(r.type ?? ''),
        variable: String(r.variable ?? ''),
        description: String(r.description ?? ''),
      }) || !sensorRowIsInactive(s)
    if (has) {
      filled += 1
      if (samples.length < 3) {
        samples.push({
          index: i,
          sensorId: String(r.sensorId ?? '').slice(0, 40),
          type: String(r.type ?? '').slice(0, 50),
          variable: String(r.variable ?? '').slice(0, 50),
        })
      }
    } else inactive += 1
  })
  return { total: rows.length, filled, inactive, samples }
}

/** @param {object} kw */
function keywordFacetCounts(kw) {
  const k = kw && typeof kw === 'object' ? kw : {}
  /** @type {Record<string, number>} */
  const out = {}
  for (const f of KW_FACETS) {
    const arr = Array.isArray(k[f]) ? k[f] : []
    out[f] = arr.filter((row) => {
      if (!row || typeof row !== 'object') return false
      const label = String(row.label || '').trim()
      const uuid = String(row.uuid || '').trim()
      return Boolean(label || uuid)
    }).length
  }
  return out
}

/** @param {Record<string, number>} src @param {Record<string, number>} imp */
function keywordDeltas(src, imp) {
  /** @type {Record<string, { src: number, imp: number, delta: number }>} */
  const out = {}
  for (const f of KW_FACETS) {
    const s = src[f] ?? 0
    const i = imp[f] ?? 0
    out[f] = { src: s, imp: i, delta: i - s }
  }
  return out
}

/**
 * @param {string} xmlPath
 */
function auditOneFile(xmlPath) {
  const base = path.basename(xmlPath)
  const rel = path.relative(REPO_ROOT, xmlPath)
  const raw = fs.readFileSync(xmlPath, 'utf8')
  const shape = detectShape(raw)
  const category = classifySample(base)

  let parseOk = true
  let parseError = ''
  /** @type {import('@xmldom/xmldom').Document | null} */
  let doc = null
  try {
    doc = new DOMParser().parseFromString(raw, 'application/xml')
    if (doc.getElementsByTagName('parsererror').length) {
      parseOk = false
      parseError = 'DOM parsererror'
    }
  } catch (e) {
    parseOk = false
    parseError = e instanceof Error ? e.message : String(e)
  }

  const srcInstr = doc ? countSourceInstruments(doc) : { gmi: 0, mac: 0, total: 0 }
  const srcKw = doc ? countSourceKeywordsByFacet(doc) : Object.fromEntries(KW_FACETS.map((f) => [f, 0]))

  let importOk = false
  let importError = ''
  /** @type {object | null} */
  let merged = null
  const warnings = []
  try {
    const out = parseProfileXmlImport(missionProfile, raw, {})
    if (!out.ok) {
      importError = out.error || 'import failed'
    } else {
      importOk = true
      merged = out.merged
      if (Array.isArray(out.warnings)) warnings.push(...out.warnings)
    }
  } catch (e) {
    importError = e instanceof Error ? e.message : String(e)
  }

  let mergeOk = false
  let lenientErrors = 0
  let lenientWarns = 0
  let strictErrors = 0
  let catalogErrors = 0
  /** @type {Record<string, { e: number, w: number }>} */
  let lenientByStep = {}
  /** @type {Array<{ field: string, message: string }>} */
  let topLenientErrors = []
  let previewLen = 0
  /** @type {string[]} */
  let iso2PreviewFails = []

  if (importOk && merged) {
    try {
      const parseResult = importPilotPartialStateFromXml(raw, { originalFilename: base })
      if (!parseResult?.partial) throw new Error('import no partial')
      const baseState = defaultPilotState()
      const mergedState = mergeLoadedPilotState(baseState, parseResult.partial)
      if (!mergedState) throw new Error('merge falsy')
      const { pilot: fixed } = applyPilotAutoFixes('lenient', mergedState)
      mergeOk = true

      const lenient = validatePilotState('lenient', fixed)
      const strict = validatePilotState('strict', fixed)
      const catalog = validatePilotState('catalog', fixed)
      lenientErrors = (lenient.issues || []).filter((i) => i.severity === 'e').length
      lenientWarns = (lenient.issues || []).filter((i) => i.severity === 'w').length
      strictErrors = (strict.issues || []).filter((i) => i.severity === 'e').length
      catalogErrors = (catalog.issues || []).filter((i) => i.severity === 'e').length
      lenientByStep = tallyByStep(lenient.issues)
      topLenientErrors = (lenient.issues || [])
        .filter((i) => i.severity === 'e')
        .slice(0, 5)
        .map((i) => ({ field: String(i.field || ''), message: String(i.message || '').slice(0, 120) }))

      const preview = buildXmlPreview(fixed)
      previewLen = preview?.length || 0
      iso2PreviewFails = missionPreviewIso191152SanityFailures(preview) || []
    } catch (e) {
      mergeOk = false
      importError = importError || (e instanceof Error ? e.message : String(e))
    }
  }

  const sens = importOk && merged ? sensorImportStats(merged.sensors) : { total: 0, filled: 0, inactive: 0, samples: [] }
  const impKw = importOk && merged ? keywordFacetCounts(merged.keywords) : Object.fromEntries(KW_FACETS.map((f) => [f, 0]))
  const kwDelta = keywordDeltas(srcKw, impKw)

  const instrumentGap = srcInstr.total > 0 && sens.filled === 0
  const scienceGap = srcKw.sciencekeywords === 0 && impKw.sciencekeywords === 0
  const locationsGap = srcKw.locations === 0 && impKw.locations === 0
  const scienceLoss = srcKw.sciencekeywords > 0 && impKw.sciencekeywords < srcKw.sciencekeywords
  const scienceDropped =
    srcKw.sciencekeywords > 0 && impKw.sciencekeywords === 0 && srcKw.sciencekeywords >= 1

  /** @type {string[]} */
  const flags = []
  if (!parseOk) flags.push('xml-parse-fail')
  if (!importOk) flags.push('import-fail')
  if (!mergeOk) flags.push('merge-fail')
  if (instrumentGap) flags.push('instruments-in-xml-but-empty-in-form')
  if (srcInstr.total > 0 && sens.filled > 0 && sens.filled < srcInstr.total) flags.push('partial-sensor-import')
  if (scienceGap) flags.push('no-science-keywords-source-or-import')
  if (locationsGap) flags.push('no-locations-keywords-source-or-import')
  if (scienceLoss) flags.push('science-keywords-loss-on-import')
  if (scienceDropped) flags.push('science-keywords-dropped-to-zero')
  if (sens.total > 0 && sens.inactive === sens.total) flags.push('all-sensor-rows-inactive')
  if (lenientErrors > 0) flags.push('lenient-errors')
  if (iso2PreviewFails.length > 0) flags.push('iso2-preview-sanity-fail')

  return {
    file: base,
    path: rel,
    category,
    navyUxS: isNavyUxSFile(base),
    sourceShape: shape,
    xmlParseOk: parseOk,
    xmlParseError: parseError,
    importOk,
    mergeOk,
    importError,
    importWarnings: warnings.slice(0, 8),
    validation: {
      lenientErrors,
      lenientWarns,
      strictErrors,
      catalogErrors,
      lenientByStep,
      topLenientErrors,
      previewLen,
      iso2PreviewFailCount: iso2PreviewFails.length,
      iso2PreviewFails: iso2PreviewFails.slice(0, 5),
    },
    source: { instruments: srcInstr, keywords: srcKw },
    imported: {
      sensors: sens,
      keywords: impKw,
      keywordDeltas: kwDelta,
      missionTitle: importOk && merged?.mission ? String(merged.mission.title || '').slice(0, 60) : '',
      fileId: importOk && merged?.mission ? String(merged.mission.fileId || '').slice(0, 80) : '',
    },
    flags,
  }
}

function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/**
 * @param {ReturnType<typeof auditOneFile>[]} rows
 * @param {{ reportBasename: string, title: string, corpus: string }} opts
 */
function writeReports(rows, opts) {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jsonPath = path.join(OUT_DIR, `${opts.reportBasename}.json`)
  const mdPath = path.join(OUT_DIR, `${opts.reportBasename}.md`)
  const csvPath = path.join(OUT_DIR, `${opts.reportBasename}.csv`)

  const navyRows = rows.filter((r) => r.navyUxS)
  const payload = {
    generatedAt: new Date().toISOString(),
    corpus: opts.corpus,
    sampleDir: path.relative(REPO_ROOT, SAMPLES),
    fileCount: rows.length,
    summary: {
      importFail: rows.filter((r) => !r.importOk).length,
      mergeFail: rows.filter((r) => !r.mergeOk).length,
      lenientErrorFiles: rows.filter((r) => r.validation.lenientErrors > 0).length,
      strictErrorFiles: rows.filter((r) => r.validation.strictErrors > 0).length,
      catalogErrorFiles: rows.filter((r) => r.validation.catalogErrors > 0).length,
      previewSanityFail: rows.filter((r) => r.validation.iso2PreviewFailCount > 0).length,
      instrumentGap: rows.filter((r) => r.flags.includes('instruments-in-xml-but-empty-in-form')).length,
      partialSensors: rows.filter((r) => r.flags.includes('partial-sensor-import')).length,
      scienceLoss: rows.filter((r) => r.flags.includes('science-keywords-loss-on-import')).length,
      noScience: rows.filter((r) => r.flags.includes('no-science-keywords-source-or-import')).length,
      noLocations: rows.filter((r) => r.flags.includes('no-locations-keywords-source-or-import')).length,
      navySubsetCount: navyRows.length,
      navyInstrumentGap: navyRows.filter((r) => r.flags.includes('instruments-in-xml-but-empty-in-form')).length,
    },
    byCategory: Object.fromEntries(
      [...new Set(rows.map((r) => r.category))].map((cat) => [
        cat,
        rows.filter((r) => r.category === cat).length,
      ]),
    ),
    rows,
  }
  fs.writeFileSync(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  const hdr = [
    'file',
    'category',
    'sourceShape',
    'xmlInstruments',
    'importSensorFilled',
    'importSensorTotal',
    'srcScienceKw',
    'impScienceKw',
    'lenientErrors',
    'strictErrors',
    'catalogErrors',
    'previewFails',
    'flags',
  ]
  const csvLines = [hdr.join(',')]
  for (const r of rows) {
    csvLines.push(
      [
        csvEscape(r.file),
        csvEscape(r.category),
        csvEscape(r.sourceShape),
        r.source.instruments.total,
        r.imported.sensors.filled,
        r.imported.sensors.total,
        r.source.keywords.sciencekeywords ?? 0,
        r.imported.keywords.sciencekeywords ?? 0,
        r.validation.lenientErrors,
        r.validation.strictErrors,
        r.validation.catalogErrors,
        r.validation.iso2PreviewFailCount,
        csvEscape(r.flags.join(';')),
      ].join(','),
    )
  }
  fs.writeFileSync(csvPath, `${csvLines.join('\n')}\n`, 'utf8')

  const md = []
  md.push(`# ${opts.title}`)
  md.push('')
  md.push(`Generated: ${payload.generatedAt}`)
  md.push(`Corpus: **${opts.corpus}** (${rows.length} files from \`${payload.sampleDir}\`)`)
  md.push('')
  md.push('## Summary')
  md.push('')
  md.push('| Metric | Count |')
  md.push('|--------|------:|')
  md.push(`| Files audited | ${rows.length} |`)
  md.push(`| Import failed | ${payload.summary.importFail} |`)
  md.push(`| Merge/validate pipeline failed | ${payload.summary.mergeFail} |`)
  md.push(`| Lenient errors (any file) | ${payload.summary.lenientErrorFiles} |`)
  md.push(`| Strict errors (any file) | ${payload.summary.strictErrorFiles} |`)
  md.push(`| Catalog errors (any file) | ${payload.summary.catalogErrorFiles} |`)
  md.push(`| ISO-2 preview sanity fail | ${payload.summary.previewSanityFail} |`)
  md.push(`| **Instruments in XML, empty in form** | **${payload.summary.instrumentGap}** |`)
  md.push(`| Partial sensor import | ${payload.summary.partialSensors} |`)
  md.push(`| Science keywords loss on import | ${payload.summary.scienceLoss} |`)
  md.push(`| No science keywords (source + import) | ${payload.summary.noScience} |`)
  md.push(`| No locations keywords (source + import) | ${payload.summary.noLocations} |`)
  md.push(`| Navy/UxS subset files | ${payload.summary.navySubsetCount} (instrument gap: ${payload.summary.navyInstrumentGap}) |`)
  md.push('')
  md.push('## By category')
  md.push('')
  for (const [cat, n] of Object.entries(payload.byCategory)) {
    md.push(`- **${cat}**: ${n}`)
  }
  md.push('')
  md.push('## Per file')
  md.push('')
  md.push(
    '| File | Cat | Shape | XML inst | Sensors | Sci src→imp | Lenient | Strict | Cat | Flags |',
  )
  md.push('|------|-----|-------|---------:|--------:|------------:|--------:|-------:|----:|-------|')
  for (const r of rows) {
    const sci = `${r.source.keywords.sciencekeywords}→${r.imported.keywords.sciencekeywords}`
    const sens = `${r.imported.sensors.filled}/${r.imported.sensors.total}`
    const len = `${r.validation.lenientErrors}e/${r.validation.lenientWarns}w`
    md.push(
      `| ${r.file} | ${r.category} | ${r.sourceShape} | ${r.source.instruments.total} | ${sens} | ${sci} | ${len} | ${r.validation.strictErrors} | ${r.validation.catalogErrors} | ${r.flags.join(', ') || '—'} |`,
    )
  }
  md.push('')
  md.push('## Action items')
  md.push('')
  const partial = rows.filter((r) => r.flags.includes('partial-sensor-import'))
  const sciLoss = rows.filter((r) => r.flags.includes('science-keywords-loss-on-import'))
  const instGap = rows.filter((r) => r.flags.includes('instruments-in-xml-but-empty-in-form'))
  md.push('### Partial sensor import')
  md.push(partial.length ? partial.map((r) => `- ${r.file} (${r.source.instruments.total} XML → ${r.imported.sensors.filled} filled)`).join('\n') : '_None_')
  md.push('')
  md.push('### Science keyword loss (source > import)')
  md.push(
    sciLoss.length
      ? sciLoss
          .map((r) => {
            const d = r.imported.keywordDeltas.sciencekeywords
            return `- **${r.file}** — ${d.src} → ${d.imp} (Δ ${d.delta})`
          })
          .join('\n')
      : '_None_',
  )
  md.push('')
  md.push('### Instruments in XML but empty form')
  md.push(
    instGap.length
      ? instGap.map((r) => `- **${r.file}** — ${r.source.instruments.total} instruments`).join('\n')
      : '_None on current main._',
  )
  md.push('')
  md.push('## Notes')
  md.push('')
  md.push('- Companion: `npm run audit:manta-samples` (full pipeline + lenient rollup).')
  md.push('- Navy subset: EN2501, MDBC PS2418, `uxs_test`, template fixtures.')
  md.push('- EN2501 ISO-3: acquisition-level `MI_Instrument` (not under platform).')
  md.push('')
  fs.writeFileSync(mdPath, `${md.join('\n')}`, 'utf8')

  console.log(`Wrote ${path.relative(REPO_ROOT, jsonPath)}`)
  console.log(`Wrote ${path.relative(REPO_ROOT, mdPath)}`)
  console.log(`Wrote ${path.relative(REPO_ROOT, csvPath)}`)
}

function main() {
  const useEut = EUT_SAMPLES || (!NAVY_ONLY && WRITE_REPORTS)
  const paths = collectXmlPaths()
  if (!paths.length) {
    console.error('No XML files found for audit.')
    process.exit(1)
  }

  const rows = paths.map(auditOneFile)
  const navy = rows.filter((r) => r.navyUxS)
  const title = useEut && !NAVY_ONLY ? 'UxS / EUT XML — deep import audit' : 'Navy / UxS XML — deep import audit'

  console.log(`\n${title} — ${rows.length} file(s)\n`)
  for (const r of rows) {
    const flagStr = r.flags.length ? ` ⚠ ${r.flags.join(', ')}` : ''
    const sens = `${r.imported.sensors.filled}/${r.imported.sensors.total}`
    const len = `L${r.validation.lenientErrors}/${r.validation.lenientWarns}`
    console.log(
      `${r.file.padEnd(48)} ${r.category.padEnd(16)} inst=${String(r.source.instruments.total).padStart(2)}  sensors=${sens.padStart(5)}  sci ${String(r.source.keywords.sciencekeywords).padStart(3)}→${String(r.imported.keywords.sciencekeywords).padStart(3)}  ${len}${flagStr}`,
    )
  }

  const instGap = rows.filter((r) => r.flags.includes('instruments-in-xml-but-empty-in-form'))
  console.log(
    `\nSummary: ${rows.length} files, ${navy.length} navy-tagged, ${instGap.length} instrument gap, ${rows.filter((r) => r.validation.lenientErrors > 0).length} with lenient errors`,
  )

  if (WRITE_REPORTS) {
    if (useEut && !NAVY_ONLY) {
      writeReports(rows, {
        reportBasename: 'uxs-xml-depth-audit',
        title: 'UxS / EUT XML — deep import audit (all samples)',
        corpus: 'manta-eut-samples',
      })
    }
    if (NAVY_ONLY || INCLUDE_FIXTURES) {
      const navyRows = rows.filter((r) => r.navyUxS || r.path.includes('fixtures') || r.path.includes('demo-records'))
      writeReports(navyRows.length ? navyRows : navy, {
        reportBasename: 'navy-xml-depth-audit',
        title: 'Navy / UxS XML — deep import audit',
        corpus: 'navy-uxs-subset',
      })
    } else if (!useEut) {
      writeReports(rows, {
        reportBasename: 'navy-xml-depth-audit',
        title: 'Navy / UxS XML — deep import audit',
        corpus: 'navy-uxs-subset',
      })
    }
  } else {
    console.log('\n(Pass --write-reports to write under MANTA End User Testing/reports/)')
  }
}

main()
