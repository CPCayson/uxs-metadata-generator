import fs from 'node:fs'

function splitCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  out.push(cur)
  return out
}

export function parseCsv(text) {
  const lines = String(text || '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
  if (lines.length === 0) return []
  const headers = splitCsvLine(lines[0]).map((h) => h.trim())
  return lines.slice(1).map((line) => {
    const parts = splitCsvLine(line)
    const row = {}
    headers.forEach((header, idx) => {
      row[header] = String(parts[idx] ?? '').trim()
    })
    return row
  })
}

export function readCsv(path) {
  return parseCsv(fs.readFileSync(path, 'utf8'))
}

