#!/usr/bin/env node
/**
 * Scan a folder of ISO XML and list unique DocuComp xlink targets (for NCEI hygiene lists).
 *
 * Usage:
 *   node scripts/bedi/scrape-docucomp-refs.mjs --xml-dir /path/to/out_segments
 *   node scripts/bedi/scrape-docucomp-refs.mjs --xml-dir ./fixtures/mission --out reports/docucomp-refs.json
 */

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import {
  ensureXmldomPolyfill,
  extractUrls,
  isDocucompUrl,
  loadXmlDir,
  writeCsv,
  writeJson,
} from '../batch/_xml.mjs'

ensureXmldomPolyfill()

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REACT_PILOT = path.resolve(__dirname, '../..')

/** DocuComp path segment after .../docucomp/ */
function docucompRef(url) {
  const m = String(url).match(/docucomp\/([^/?#]+)/i)
  return m ? decodeURIComponent(m[1]) : null
}

function parseArgs(argv) {
  const out = {
    xmlDir: '',
    outJson: path.join(REACT_PILOT, 'reports/docucomp-refs/docucomp-refs.json'),
    outCsv: path.join(REACT_PILOT, 'reports/docucomp-refs/docucomp-refs.csv'),
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--xml-dir') out.xmlDir = path.resolve(REACT_PILOT, argv[++i] || '')
    else if (a === '--out') {
      const base = path.resolve(REACT_PILOT, argv[++i] || '')
      out.outJson = `${base}.json`
      out.outCsv = `${base}.csv`
    }
  }
  return out
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (!opts.xmlDir || !fs.existsSync(opts.xmlDir)) {
    console.error('Usage: node scripts/bedi/scrape-docucomp-refs.mjs --xml-dir <path> [--out reports/docucomp-refs]')
    process.exit(2)
  }

  const records = loadXmlDir(opts.xmlDir)
  /** @type {Map<string, Set<string>>} */
  const refToSources = new Map()

  for (const rec of records) {
    const urls = extractUrls(rec.doc).filter(isDocucompUrl)
    for (const url of urls) {
      const ref = docucompRef(url)
      if (!ref) continue
      if (!refToSources.has(ref)) refToSources.set(ref, new Set())
      refToSources.get(ref).add(rec.filePath)
    }
  }

  const rows = [...refToSources.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, sources]) => ({
      docucomp_ref: ref,
      source_files: [...sources].length,
      sources_preview: [...sources].slice(0, 3).map((p) => path.relative(REACT_PILOT, p)).join('; '),
    }))

  writeJson(opts.outJson, {
    xmlDir: opts.xmlDir,
    uniqueRefs: rows.length,
    refs: rows,
  })
  writeCsv(opts.outCsv, rows, ['docucomp_ref', 'source_files', 'sources_preview'])

  console.log(`DocuComp refs: ${rows.length} unique (from ${records.length} XML files)`)
  console.log(`Wrote:\n  ${opts.outJson}\n  ${opts.outCsv}`)
}

main()
