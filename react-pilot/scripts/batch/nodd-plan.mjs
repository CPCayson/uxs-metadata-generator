/**
 * NODD / cloud link patch planner.
 *
 * Takes a CSV of record UUIDs + NODD S3/cloud URLs, loads matching XML,
 * generates per-record insertion previews, and optionally applies them.
 *
 * CSV format (headers required):
 *   uuid, noddUrl, label, description, protocol
 *
 * Usage:
 *   node scripts/batch/nodd-plan.mjs --csv nodd.csv --xml-dir input/ --out reports/nodd-plan
 *   node scripts/batch/nodd-plan.mjs --csv nodd.csv --xml-dir input/ --apply
 *
 * Outputs (preview mode, default):
 *   <out>/nodd-plan.json       per-record plan with before/after snippet
 *   <out>/nodd-plan-diff.csv   CSV summary of what would change
 *
 * Outputs (--apply mode):
 *   same as above + modified XML written back to --xml-dir
 *
 * @module scripts/batch/nodd-plan
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureXmldomPolyfill,
  loadXmlDir,
  extractUuid,
  isNoddUrl,
  writeCsv,
  writeJson,
} from './_xml.mjs'
import { readCsv } from '../swarm/_csv.mjs'

ensureXmldomPolyfill()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')

function parseArgs(argv) {
  const out = {
    csvPath: '',
    xmlDir: '',
    outDir: path.join(REACT_PILOT, 'reports/nodd-plan'),
    apply: false,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--csv') out.csvPath = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--xml-dir') out.xmlDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--out') out.outDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--apply') out.apply = true
  }
  return out
}

function buildNoddSnippet(row) {
  const url = (row.noddUrl || row.url || '').trim()
  const label = (row.label || 'NODD Cloud Access').trim()
  const desc = (row.description || row.desc || 'NOAA Open Data Dissemination (NODD) cloud archive').trim()
  const protocol = (row.protocol || 'HTTPS').trim()

  return `  <gmd:transferOptions>
    <gmd:MD_DigitalTransferOptions>
      <gmd:onLine>
        <gmd:CI_OnlineResource>
          <gmd:linkage>
            <gmd:URL>${url}</gmd:URL>
          </gmd:linkage>
          <gmd:protocol>
            <gco:CharacterString>${protocol}</gco:CharacterString>
          </gmd:protocol>
          <gmd:name>
            <gco:CharacterString>${label}</gco:CharacterString>
          </gmd:name>
          <gmd:description>
            <gco:CharacterString>${desc}</gco:CharacterString>
          </gmd:description>
          <gmd:function>
            <gmd:CI_OnLineFunctionCode codeList="http://www.isotc211.org/2005/resources/Codelist/gmxCodelists.xml#CI_OnLineFunctionCode" codeListValue="download">download</gmd:CI_OnLineFunctionCode>
          </gmd:function>
        </gmd:CI_OnlineResource>
      </gmd:onLine>
    </gmd:MD_DigitalTransferOptions>
  </gmd:transferOptions>`
}

function insertSnippetIntoXml(xmlText, snippet) {
  // Insert before closing </gmd:MD_Distribution> or </gmd:distributionInfo>
  const insertBefore = ['</gmd:MD_Distribution>', '</gmd:distributionInfo>']
  for (const marker of insertBefore) {
    const idx = xmlText.lastIndexOf(marker)
    if (idx !== -1) {
      return xmlText.slice(0, idx) + snippet + '\n' + xmlText.slice(idx)
    }
  }
  // fallback: insert before root closing tag
  const lastClose = xmlText.lastIndexOf('</')
  if (lastClose !== -1) {
    return xmlText.slice(0, lastClose) + snippet + '\n' + xmlText.slice(lastClose)
  }
  return xmlText + '\n' + snippet
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  if (!opts.csvPath || !fs.existsSync(opts.csvPath)) {
    console.error('Provide --csv <path> pointing to a CSV with columns: uuid, noddUrl, label, description, protocol')
    process.exit(1)
  }
  if (!opts.xmlDir || !fs.existsSync(opts.xmlDir)) {
    console.error('Provide --xml-dir <path> pointing to the folder of XML records')
    process.exit(1)
  }

  const csvRows = readCsv(opts.csvPath)
  console.log(`Loaded ${csvRows.length} NODD rows from CSV`)

  const xmlRecords = loadXmlDir(opts.xmlDir)
  console.log(`Loaded ${xmlRecords.length} XML files from ${opts.xmlDir}`)

  // index XML by UUID
  const xmlByUuid = new Map()
  for (const rec of xmlRecords) {
    const uuid = extractUuid(rec.doc)
    if (uuid) xmlByUuid.set(uuid, rec)
  }

  const plan = []
  const diffRows = []

  for (const row of csvRows) {
    const uuid = (row.uuid || '').trim()
    const noddUrl = (row.noddUrl || row.url || '').trim()

    if (!uuid || !noddUrl) {
      console.warn(`  SKIP row: missing uuid or noddUrl`)
      continue
    }

    if (!isNoddUrl(noddUrl)) {
      console.warn(`  WARN ${uuid}: URL does not look like NODD — ${noddUrl}`)
    }

    const rec = xmlByUuid.get(uuid)
    if (!rec) {
      plan.push({ uuid, status: 'NOT_FOUND', noddUrl, snippet: null })
      diffRows.push({ uuid, status: 'NOT_FOUND', noddUrl, xmlFile: '' })
      continue
    }

    const snippet = buildNoddSnippet(row)
    const originalText = rec.text
    const patchedText = insertSnippetIntoXml(originalText, snippet)

    plan.push({
      uuid,
      status: opts.apply ? 'APPLIED' : 'PLANNED',
      noddUrl,
      xmlFile: rec.filePath,
      snippet,
      beforeCharCount: originalText.length,
      afterCharCount: patchedText.length,
    })
    diffRows.push({
      uuid,
      status: opts.apply ? 'APPLIED' : 'PLANNED',
      noddUrl,
      xmlFile: rec.filePath,
    })

    if (opts.apply) {
      fs.writeFileSync(rec.filePath, patchedText, 'utf8')
      console.log(`  APPLIED ${uuid} → ${rec.filePath}`)
    }
  }

  const summary = {
    generated: new Date().toISOString(),
    csvPath: opts.csvPath,
    xmlDir: opts.xmlDir,
    mode: opts.apply ? 'apply' : 'preview',
    total: csvRows.length,
    planned: plan.filter((p) => p.status === 'PLANNED').length,
    applied: plan.filter((p) => p.status === 'APPLIED').length,
    notFound: plan.filter((p) => p.status === 'NOT_FOUND').length,
    laneStatus: plan.filter((p) => p.status === 'NOT_FOUND').length === 0 ? 'PASS' : 'CHECK',
    plan,
  }

  writeJson(path.join(opts.outDir, 'nodd-plan.json'), summary)
  writeCsv(path.join(opts.outDir, 'nodd-plan-diff.csv'), diffRows, ['uuid', 'status', 'noddUrl', 'xmlFile'])

  console.log('\n── NODD Plan Summary ────────────────────────────────────────')
  console.log(`  Mode       :  ${summary.mode}`)
  console.log(`  CSV rows   :  ${summary.total}`)
  console.log(`  Planned    :  ${summary.planned}`)
  console.log(`  Applied    :  ${summary.applied}`)
  console.log(`  Not found  :  ${summary.notFound}`)
  console.log(`  Lane status:  ${summary.laneStatus}`)
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`\nReports written to: ${opts.outDir}`)
  if (!opts.apply) console.log('  (preview mode — re-run with --apply to write changes)')
}

main().catch((e) => { console.error(e); process.exit(1) })
