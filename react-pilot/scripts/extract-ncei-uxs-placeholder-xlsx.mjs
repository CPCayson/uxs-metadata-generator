#!/usr/bin/env node
/**
 * Reads NCEI "Metadata Placeholders and Script Generation.xlsx" from the repo
 * root (sibling of react-pilot/) and prints a Markdown table: Element | Placeholder | Description.
 *
 * Usage:
 *   node scripts/extract-ncei-uxs-placeholder-xlsx.mjs [path-to.xlsx] > docs/uxs-ncei-placeholder-xlsx-crosswalk.md
 *
 * Depends on: unzip(1), @xmldom/xmldom (devDependency of react-pilot).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const defaultXlsx = path.resolve(__dirname, '../../Metadata Placeholders and Script Generation.xlsx')
const xlsxPath = path.resolve(process.argv[2] || defaultXlsx)

if (!fs.existsSync(xlsxPath)) {
  console.error(`Missing workbook: ${xlsxPath}`)
  process.exit(1)
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ncei-ph-'))
const un = spawnSync('unzip', ['-q', '-o', xlsxPath, '-d', tmp], { encoding: 'utf8' })
if (un.status !== 0) {
  console.error(un.stderr || 'unzip failed')
  process.exit(1)
}

const sstPath = path.join(tmp, 'xl/sharedStrings.xml')
const sheetPath = path.join(tmp, 'xl/worksheets/sheet1.xml')
const sstDoc = new DOMParser().parseFromString(fs.readFileSync(sstPath, 'utf8'), 'application/xml')
const sheetDoc = new DOMParser().parseFromString(fs.readFileSync(sheetPath, 'utf8'), 'application/xml')

/** @returns {string[]} */
function sharedStringTable(doc) {
  const out = []
  const sis = doc.getElementsByTagName('si')
  for (let i = 0; i < sis.length; i++) {
    const si = sis[i]
    let text = ''
    const ts = si.getElementsByTagName('t')
    for (let j = 0; j < ts.length; j++) text += ts[j].textContent || ''
    out.push(text)
  }
  return out
}

/**
 * @param {import('@xmldom/xmldom').Element} rowEl
 * @param {string} colLetter
 * @returns {string}
 */
function cellInRow(rowEl, colLetter) {
  for (let c = rowEl.firstChild; c; c = c.nextSibling) {
    if (c.nodeType !== 1 || c.localName !== 'c') continue
    const ref = c.getAttribute('r') || ''
    if (!ref.startsWith(colLetter)) continue
    const t = c.getAttribute('t')
    const vEl = /** @type {import('@xmldom/xmldom').Element | null} */ (
      c.getElementsByTagName('v')[0] || null
    )
    const raw = vEl ? String(vEl.textContent ?? '').trim() : ''
    if (t === 's') {
      const idx = Number.parseInt(raw, 10)
      return Number.isFinite(idx) ? String(shared[idx] ?? '') : ''
    }
    return raw
  }
  return ''
}

const shared = sharedStringTable(sstDoc)
const sheetData = sheetDoc.getElementsByTagName('sheetData')[0]
if (!sheetData) {
  console.error('No sheetData')
  process.exit(1)
}

const rows = []
for (let r = sheetData.firstChild; r; r = r.nextSibling) {
  if (r.nodeType !== 1 || r.localName !== 'row') continue
  const rowNum = Number.parseInt(r.getAttribute('r') || '0', 10)
  if (!rowNum) continue
  const a = cellInRow(/** @type {import('@xmldom/xmldom').Element} */ (r), 'A')
  const b = cellInRow(/** @type {import('@xmldom/xmldom').Element} */ (r), 'B')
  const c = cellInRow(/** @type {import('@xmldom/xmldom').Element} */ (r), 'C')
  rows.push({ rowNum, a, b, c })
}

fs.rmSync(tmp, { recursive: true, force: true })

function escMd(s) {
  return String(s || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, '<br>')
}

const title = 'NCEI UxS placeholder workbook (extracted rows)'
const docsDir = path.join(__dirname, '..', 'docs')
const srcFromDocs = path.relative(docsDir, xlsxPath) || path.basename(xlsxPath)
const href = srcFromDocs.split(path.sep).join('/')

console.log(`# ${title}`)
console.log('')
console.log(
  `Source file: [\`${path.basename(xlsxPath)}\`](${encodeURI(href)}) (shipped with this repo; official copy from [NCEI UxS templates](https://www.ncei.noaa.gov/products/uncrewed-system-metadata-templates)).`
)
console.log('')
console.log('Columns mirror the spreadsheet: **Element / tag**, **Placeholder text**, **Description**.')
console.log('')
console.log('For `pilotState` / `importPilotPartialStateFromXml` coverage, see [uxs-ncei-template-mission-pilot-matrix.md](./uxs-ncei-template-mission-pilot-matrix.md).')
console.log('')
console.log('| # | Element / tag | Placeholder text | Description |')
console.log('| --: | -- | -- | -- |')
for (const { rowNum, a, b, c } of rows) {
  if (String(a).trim() === 'Element / Tag' && String(b).trim() === 'Placeholder Text') continue
  console.log(`| ${rowNum} | ${escMd(a)} | ${escMd(b)} | ${escMd(c)} |`)
}
