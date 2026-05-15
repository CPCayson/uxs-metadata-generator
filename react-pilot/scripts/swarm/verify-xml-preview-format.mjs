#!/usr/bin/env node
/**
 * SWARM lane — mission XML preview export format.
 *
 * Ensures `buildXmlPreview` (same bytes as rail/header Export XML) is:
 * - not GeoJSON / JSON-LD
 * - well-formed (DOMParser + optional xmllint --noout)
 * - ISO 19115-2-shaped (missionPreviewIso191152SanityFailures)
 *
 * Usage:
 *   npm run swarm:preview-xml
 *   node scripts/swarm/verify-xml-preview-format.mjs --eut-samples
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const DEFAULT_SAMPLES = path.resolve(ROOT, '..', 'MANTA End User Testing', 'samples')
const OUT_DIR = path.join(path.resolve(ROOT, '..'), 'MANTA End User Testing', 'reports')

const INCLUDE_EUT = process.argv.includes('--eut-samples')
const SAMPLE_DIR = process.env.SAMPLE_DIR || DEFAULT_SAMPLES

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
const { defaultPilotState, mergeLoadedPilotState } = await import(
  path.join(ROOT, 'src/lib/pilotValidation.js'),
)
const { buildXmlPreview } = await import(path.join(ROOT, 'src/lib/xmlPreviewBuilder.js'))
const { missionPreviewIso191152SanityFailures } = await import(
  path.join(ROOT, 'src/lib/iso191152PreviewSanity.js'),
)

/** @param {string} xml */
function looksLikeGeoJsonOrJsonLd(xml) {
  const t = String(xml || '').trim()
  if (!t) return 'empty'
  if (t.startsWith('{') || t.startsWith('[')) return 'json-root'
  if (/^\s*"type"\s*:\s*"(Feature|FeatureCollection)"/m.test(t)) return 'geojson-type'
  if (/^\s*"@context"\s*:/m.test(t)) return 'jsonld-context'
  return null
}

/** @param {string} xml */
function domParserWellFormed(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  const root = doc.documentElement
  if (!root || String(root.nodeName || '').includes('parsererror')) {
    const err = doc.getElementsByTagName('parsererror')[0]
    return { ok: false, detail: err?.textContent?.trim() || 'DOMParser parse failed' }
  }
  return { ok: true }
}

/** @param {string} xml @returns {boolean | null} */
function xmllintWellFormed(xml) {
  try {
    const v = spawnSync('xmllint', ['--version'], { encoding: 'utf8', shell: false })
    if (v.status !== 0) return null
  } catch {
    return null
  }
  const tmp = path.join(os.tmpdir(), `swarm-preview-xml-${process.pid}-${Date.now()}.xml`)
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
 * @param {string} label
 * @param {string} xml
 */
function auditPreview(label, xml) {
  /** @type {string[]} */
  const fails = []
  const geo = looksLikeGeoJsonOrJsonLd(xml)
  if (geo) fails.push(`not-xml:${geo}`)
  if (!/^\s*<\?xml\b/i.test(xml) && !/^\s*<gmi:MI_Metadata\b/i.test(String(xml).trim())) {
    fails.push('missing-xml-decl-or-gmi-root')
  }
  const dom = domParserWellFormed(xml)
  if (!dom.ok) fails.push(`dom:${dom.detail}`)
  const sanity = missionPreviewIso191152SanityFailures(xml)
  if (sanity.length) fails.push(...sanity.map((id) => `sanity:${id}`))
  const xl = xmllintWellFormed(xml)
  if (xl === false) fails.push('xmllint')
  return { label, ok: fails.length === 0, fails, xmllint: xl }
}

/** @type {ReturnType<typeof auditPreview>[]} */
const rows = []

rows.push(auditPreview('empty-shell', buildXmlPreview(defaultPilotState())))

if (INCLUDE_EUT && fs.existsSync(SAMPLE_DIR)) {
  const files = fs
    .readdirSync(SAMPLE_DIR)
    .filter((n) => n.toLowerCase().endsWith('.xml'))
    .sort()
  for (const file of files) {
    const raw = fs.readFileSync(path.join(SAMPLE_DIR, file), 'utf8')
    const parsed = importPilotPartialStateFromXml(raw)
    if (!parsed.ok) {
      rows.push({ label: `eut:${file}`, ok: false, fails: ['import-failed'], xmllint: null })
      continue
    }
    const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
    rows.push(auditPreview(`eut:${file}`, buildXmlPreview(merged)))
  }
}

const bad = rows.filter((r) => !r.ok)
const report = {
  generatedAt: new Date().toISOString(),
  includeEut: INCLUDE_EUT,
  sampleDir: SAMPLE_DIR,
  total: rows.length,
  failed: bad.length,
  rows,
}

fs.mkdirSync(OUT_DIR, { recursive: true })
const jsonPath = path.join(OUT_DIR, 'xml-preview-format-swarm.json')
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)

const md = [
  '# XML preview format swarm',
  '',
  `Generated: ${report.generatedAt}`,
  '',
  `Cases: ${report.total} · Failed: ${report.failed}`,
  '',
  '| Case | OK | xmllint | Fails |',
  '|------|----|---------|-------|',
  ...rows.map((r) => {
    const xl = r.xmllint === null ? 'skip' : r.xmllint ? 'ok' : 'fail'
    return `| ${r.label} | ${r.ok ? 'yes' : 'no'} | ${xl} | ${(r.fails || []).join(', ') || '—'} |`
  }),
  '',
]
const mdPath = path.join(OUT_DIR, 'xml-preview-format-swarm.md')
fs.writeFileSync(mdPath, md.join('\n'))

if (bad.length) {
  console.error(`swarm:preview-xml FAILED (${bad.length}/${rows.length})`)
  for (const r of bad.slice(0, 12)) {
    console.error(`  ${r.label}: ${(r.fails || []).join('; ')}`)
  }
  console.error(`Report: ${path.relative(ROOT, jsonPath)}`)
  process.exit(1)
}

console.log(
  `swarm:preview-xml OK — ${rows.length} preview(s) well-formed + ISO-19115-2 sanity` +
    (INCLUDE_EUT ? ' (EUT samples)' : ' (empty shell only; pass --eut-samples for corpus)'),
)
console.log(`Report: ${path.relative(ROOT, mdPath)}`)
