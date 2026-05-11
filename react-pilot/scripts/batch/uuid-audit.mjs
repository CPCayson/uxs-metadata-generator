/**
 * UUID + image URL auditor.
 *
 * Extracts root UUIDs, fileIdentifiers, and browse graphic URLs from
 * a folder of XML files, reports missing/malformed UUIDs, duplicate
 * UUIDs, and invalid/non-DocuComp image URLs.
 *
 * Usage:
 *   node scripts/batch/uuid-audit.mjs --xml-dir fixtures/mission
 *   node scripts/batch/uuid-audit.mjs --xml-dir reports/waf-audit/xml --out reports/uuid-audit
 *
 * Outputs:
 *   <out>/uuid-audit.json
 *   <out>/uuid-audit.csv
 *   <out>/image-audit.csv
 *
 * @module scripts/batch/uuid-audit
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureXmldomPolyfill,
  loadXmlDir,
  loadXmlFile,
  extractUuid,
  extractImageUrls,
  isDocucompUrl,
  checkUrl,
  writeCsv,
  writeJson,
} from './_xml.mjs'

ensureXmldomPolyfill()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')

function parseArgs(argv) {
  const out = {
    xmlDir: '',
    outDir: path.join(REACT_PILOT, 'reports/uuid-audit'),
    checkImages: false,
    timeoutMs: 8000,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--xml-dir') out.xmlDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--out') out.outDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--check-images') out.checkImages = true
    else if (a === '--timeout') out.timeoutMs = parseInt(argv[++i] || '8000', 10)
  }
  if (!out.xmlDir) out.xmlDir = path.join(REACT_PILOT, 'fixtures/mission')
  return out
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function classifyUuid(uuid) {
  if (!uuid) return 'MISSING'
  if (UUID_RE.test(uuid)) return 'VALID'
  return 'MALFORMED'
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  console.log(`Loading XML from: ${opts.xmlDir}`)

  const records = loadXmlDir(opts.xmlDir)
  console.log(`  Found ${records.length} XML files`)

  if (records.length === 0) {
    console.error('No XML files found. Provide --xml-dir <path>.')
    process.exit(1)
  }

  const uuidRows = []
  const imageRows = []
  const uuidSeen = new Map() // uuid -> [filePath]

  for (const rec of records) {
    const uuid = extractUuid(rec.doc)
    const uuidClass = classifyUuid(uuid)
    const images = extractImageUrls(rec.doc)

    if (!uuidSeen.has(uuid)) uuidSeen.set(uuid, [])
    uuidSeen.get(uuid).push(rec.filePath)

    uuidRows.push({
      file: rec.filePath,
      uuid: uuid || '',
      uuidStatus: uuidClass,
      imageCount: images.length,
    })

    for (const img of images) {
      imageRows.push({
        file: rec.filePath,
        uuid: uuid || '',
        imageUrl: img.url,
        imageLabel: img.label,
        isDocucomp: isDocucompUrl(img.url) ? 'Y' : '',
        checkStatus: '',
        httpStatus: '',
      })
    }
  }

  // flag duplicates
  for (const row of uuidRows) {
    if (!row.uuid) continue
    const group = uuidSeen.get(row.uuid)
    if (group && group.length > 1) {
      row.uuidStatus = row.uuidStatus === 'VALID' ? 'DUPLICATE' : row.uuidStatus
    }
  }

  // optional: check image URLs
  if (opts.checkImages && imageRows.length > 0) {
    console.log(`\nChecking ${imageRows.length} image URLs…`)
    let i = 0
    for (const row of imageRows) {
      const result = await checkUrl(row.imageUrl, opts.timeoutMs)
      row.checkStatus = result.ok ? 'OK' : 'BROKEN'
      row.httpStatus = String(result.status || '')
      i += 1
      process.stdout.write(`  ${i}/${imageRows.length}\r`)
    }
    console.log()
  }

  // summary
  const total = uuidRows.length
  const valid = uuidRows.filter((r) => r.uuidStatus === 'VALID').length
  const missing = uuidRows.filter((r) => r.uuidStatus === 'MISSING').length
  const malformed = uuidRows.filter((r) => r.uuidStatus === 'MALFORMED').length
  const duplicates = uuidRows.filter((r) => r.uuidStatus === 'DUPLICATE').length
  const totalImages = imageRows.length
  const docucompImages = imageRows.filter((r) => r.isDocucomp === 'Y').length
  const nonDocucompImages = totalImages - docucompImages

  const laneIssues = missing + malformed + duplicates
  const laneStatus = laneIssues === 0 ? 'PASS' : laneIssues <= 3 ? 'CHECK' : 'BLOCK'

  const summary = {
    generated: new Date().toISOString(),
    xmlDir: opts.xmlDir,
    totalXmlRecords: total,
    uuids: { valid, missing, malformed, duplicates },
    images: { total: totalImages, docucomp: docucompImages, nonDocucomp: nonDocucompImages },
    laneStatus,
  }

  const uuidHeaders = ['file', 'uuid', 'uuidStatus', 'imageCount']
  const imageHeaders = ['file', 'uuid', 'imageUrl', 'imageLabel', 'isDocucomp', 'checkStatus', 'httpStatus']

  writeJson(path.join(opts.outDir, 'uuid-audit.json'), summary)
  writeCsv(path.join(opts.outDir, 'uuid-audit.csv'), uuidRows, uuidHeaders)
  writeCsv(path.join(opts.outDir, 'image-audit.csv'), imageRows, imageHeaders)

  console.log('\n── UUID + Image Audit ───────────────────────────────────────')
  console.log(`  XML records  :  ${total}`)
  console.log(`  UUID valid   :  ${valid}`)
  console.log(`  UUID missing :  ${missing}`)
  console.log(`  UUID bad     :  ${malformed}`)
  console.log(`  UUID dupe    :  ${duplicates}`)
  console.log(`  Images total :  ${totalImages}`)
  console.log(`  DocuComp img :  ${docucompImages}`)
  console.log(`  Other img    :  ${nonDocucompImages}`)
  console.log(`  Lane status  :  ${laneStatus}`)
  console.log('─────────────────────────────────────────────────────────────')
  console.log(`\nReports written to: ${opts.outDir}`)

  if (laneStatus === 'BLOCK') process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
