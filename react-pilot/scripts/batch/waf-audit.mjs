/**
 * WAF scraper + batch link checker.
 *
 * Inputs:
 *   --url  <waf-url>     WAF index page to scrape for XML records
 *   --xml-dir <path>     Local folder of XML files (alternative to --url)
 *   --out  <dir>         Output directory (default: reports/waf-audit)
 *   --concurrency <n>    Parallel link-check workers (default: 8)
 *   --timeout <ms>       Per-request timeout (default: 10000)
 *
 * Outputs:
 *   <out>/summary.json
 *   <out>/bad_url_report.csv
 *   <out>/all_urls.csv
 *
 * Usage:
 *   node scripts/batch/waf-audit.mjs --url https://example.com/waf/
 *   node scripts/batch/waf-audit.mjs --xml-dir fixtures/mission
 *
 * @module scripts/batch/waf-audit
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ensureXmldomPolyfill,
  loadXmlFile,
  loadXmlDir,
  fetchWafManifest,
  fetchText,
  parseXml,
  extractUrls,
  extractUuid,
  extractImageUrls,
  isDocucompUrl,
  isNoddUrl,
  isOsddUrl,
  checkUrl,
  writeCsv,
  writeJson,
} from './_xml.mjs'

ensureXmldomPolyfill()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')

function parseArgs(argv) {
  const out = {
    wafUrl: '',
    xmlDir: '',
    outDir: path.join(REACT_PILOT, 'reports/waf-audit'),
    concurrency: 8,
    timeoutMs: 10000,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--url') out.wafUrl = argv[++i] || ''
    else if (a === '--xml-dir') out.xmlDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--out') out.outDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--concurrency') out.concurrency = parseInt(argv[++i] || '8', 10)
    else if (a === '--timeout') out.timeoutMs = parseInt(argv[++i] || '10000', 10)
  }
  return out
}

async function loadRecords(opts) {
  const records = []

  if (opts.wafUrl) {
    console.log(`Fetching WAF manifest: ${opts.wafUrl}`)
    const manifest = await fetchWafManifest(opts.wafUrl)
    console.log(`  Found ${manifest.xmlLinks.length} XML links in WAF index`)
    for (const xmlUrl of manifest.xmlLinks) {
      try {
        const { body } = await fetchText(xmlUrl, opts.timeoutMs)
        const doc = parseXml(body)
        records.push({ source: xmlUrl, doc })
      } catch (e) {
        console.warn(`  SKIP ${xmlUrl}: ${e.message}`)
      }
    }
  } else if (opts.xmlDir) {
    console.log(`Loading XML from: ${opts.xmlDir}`)
    const loaded = loadXmlDir(opts.xmlDir)
    for (const r of loaded) {
      records.push({ source: r.filePath, doc: r.doc })
    }
    console.log(`  Loaded ${records.length} XML files`)
  } else {
    // fallback: use CoMET fixtures
    const fixtureDir = path.join(REACT_PILOT, 'fixtures/mission')
    console.log(`No --url or --xml-dir given. Using fixture dir: ${fixtureDir}`)
    const loaded = loadXmlDir(fixtureDir)
    for (const r of loaded) {
      records.push({ source: r.filePath, doc: r.doc })
    }
    console.log(`  Loaded ${records.length} XML files from fixtures`)
  }

  return records
}

async function runWithConcurrency(tasks, limit) {
  const results = []
  let index = 0
  async function worker() {
    while (index < tasks.length) {
      const i = index++
      results[i] = await tasks[i]()
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, worker)
  await Promise.all(workers)
  return results
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const records = await loadRecords(opts)

  if (records.length === 0) {
    console.error('No XML records found. Provide --url or --xml-dir.')
    process.exit(1)
  }

  // collect all URLs across all records
  const urlMap = new Map() // url -> [{ source, uuid }]
  const allRows = []

  for (const rec of records) {
    const uuid = extractUuid(rec.doc) || ''
    const urls = extractUrls(rec.doc)
    const images = extractImageUrls(rec.doc)
    const imageUrls = new Set(images.map((i) => i.url))

    for (const url of urls) {
      if (!urlMap.has(url)) urlMap.set(url, [])
      urlMap.get(url).push({ source: rec.source, uuid })
      allRows.push({
        url,
        source: rec.source,
        uuid,
        isDocucomp: isDocucompUrl(url) ? 'Y' : '',
        isNodd: isNoddUrl(url) ? 'Y' : '',
        isOsdd: isOsddUrl(url) ? 'Y' : '',
        isImage: imageUrls.has(url) ? 'Y' : '',
      })
    }
  }

  const uniqueUrls = [...urlMap.keys()]
  console.log(`\nChecking ${uniqueUrls.length} unique URLs (concurrency=${opts.concurrency})…`)

  let checked = 0
  const checkResults = new Map()
  const tasks = uniqueUrls.map((url) => async () => {
    const result = await checkUrl(url, opts.timeoutMs)
    checkResults.set(url, result)
    checked += 1
    if (checked % 25 === 0 || checked === uniqueUrls.length) {
      process.stdout.write(`  ${checked}/${uniqueUrls.length}\r`)
    }
    return result
  })

  await runWithConcurrency(tasks, opts.concurrency)
  console.log()

  // build report rows
  const badRows = []
  const allUrlRows = []

  for (const row of allRows) {
    const check = checkResults.get(row.url) || {}
    const status = check.status || 0
    const ok = check.ok ? 'OK' : 'BROKEN'
    const errorNote = check.error || ''

    allUrlRows.push({
      status: ok,
      httpStatus: status,
      url: row.url,
      source: row.source,
      uuid: row.uuid,
      isDocucomp: row.isDocucomp,
      isNodd: row.isNodd,
      isOsdd: row.isOsdd,
      isImage: row.isImage,
      error: errorNote,
    })

    if (!check.ok) {
      badRows.push({
        status: ok,
        httpStatus: status,
        url: row.url,
        source: row.source,
        uuid: row.uuid,
        isDocucomp: row.isDocucomp,
        isNodd: row.isNodd,
        isOsdd: row.isOsdd,
        isImage: row.isImage,
        error: errorNote,
      })
    }
  }

  // deduplicate bad rows by url
  const seenBad = new Set()
  const dedupBad = badRows.filter((r) => {
    if (seenBad.has(r.url)) return false
    seenBad.add(r.url)
    return true
  })

  // counts
  const totalXml = records.length
  const totalUrls = uniqueUrls.length
  const brokenCount = [...checkResults.values()].filter((r) => !r.ok).length
  const okCount = totalUrls - brokenCount
  const docucompCount = uniqueUrls.filter(isDocucompUrl).length
  const noddCount = uniqueUrls.filter(isNoddUrl).length
  const osddCount = uniqueUrls.filter(isOsddUrl).length
  const dupCount = allRows.length - totalUrls

  const summary = {
    generated: new Date().toISOString(),
    source: opts.wafUrl || opts.xmlDir || 'fixtures/mission',
    totalXmlRecords: totalXml,
    totalUniqueUrls: totalUrls,
    totalUrlOccurrences: allRows.length,
    duplicateUrlOccurrences: dupCount,
    okUrls: okCount,
    brokenUrls: brokenCount,
    docucompUrls: docucompCount,
    noddUrls: noddCount,
    osddUrls: osddCount,
    laneStatus: brokenCount === 0 ? 'PASS' : brokenCount <= 5 ? 'CHECK' : 'BLOCK',
  }

  const csvHeaders = ['status', 'httpStatus', 'url', 'source', 'uuid', 'isDocucomp', 'isNodd', 'isOsdd', 'isImage', 'error']

  writeCsv(path.join(opts.outDir, 'bad_url_report.csv'), dedupBad, csvHeaders)
  writeCsv(path.join(opts.outDir, 'all_urls.csv'), allUrlRows, csvHeaders)
  writeJson(path.join(opts.outDir, 'summary.json'), summary)

  console.log('\n── WAF Audit Summary ───────────────────────────────────────')
  console.log(`  XML records :  ${totalXml}`)
  console.log(`  Unique URLs :  ${totalUrls}`)
  console.log(`  OK          :  ${okCount}`)
  console.log(`  Broken      :  ${brokenCount}`)
  console.log(`  DocuComp    :  ${docucompCount}`)
  console.log(`  NODD        :  ${noddCount}`)
  console.log(`  OSDD        :  ${osddCount}`)
  console.log(`  Lane status :  ${summary.laneStatus}`)
  console.log('────────────────────────────────────────────────────────────')
  console.log(`\nReports written to: ${opts.outDir}`)
  console.log('  summary.json')
  console.log('  bad_url_report.csv')
  console.log('  all_urls.csv')

  if (summary.laneStatus === 'BLOCK') process.exit(1)
}

main().catch((e) => { console.error(e); process.exit(1) })
