/**
 * Validate mission compare list CSV payloads.
 *
 * POST JSON body:
 *   { csvText: string, filename?: string }
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

const REQUIRED_FIELDS = [
  'mission_key',
  'file_identifier',
  'title',
  'abstract',
  'purpose',
  'start_date',
  'end_date',
  'west',
  'east',
  'south',
  'north',
  'platform_name',
  'point_of_contact_org',
  'point_of_contact_email',
  'access_url',
]

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Basic CSV parser supporting quoted values and escaped quotes.
 * @param {string} text
 * @returns {string[][]}
 */
function parseCsv(text) {
  /** @type {string[][]} */
  const rows = []
  /** @type {string[]} */
  let row = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cur += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
      continue
    }
    if (ch === ',') {
      row.push(cur)
      cur = ''
      continue
    }
    if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
      continue
    }
    if (ch === '\r') continue
    cur += ch
  }
  row.push(cur)
  rows.push(row)
  return rows.filter((r) => r.some((v) => String(v).trim() !== ''))
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let payload
  try {
    payload = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const csvText = String(payload?.csvText ?? '')
  if (!csvText.trim()) return json({ ok: false, error: 'csvText is required' }, 400)

  const rows = parseCsv(csvText)
  if (rows.length < 2) return json({ ok: false, error: 'CSV must include header + at least one data row' }, 400)
  const headers = rows[0].map((h) => String(h || '').trim())
  const missingHeaders = REQUIRED_FIELDS.filter((h) => !headers.includes(h))
  if (missingHeaders.length) {
    return json({
      ok: false,
      error: `Missing required headers: ${missingHeaders.join(', ')}`,
      missingHeaders,
    }, 400)
  }

  const idx = Object.fromEntries(headers.map((h, i) => [h, i]))
  /** @type {string[]} */
  const errors = []
  /** @type {string[]} */
  const warnings = []
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const rowNum = r + 1
    for (const field of REQUIRED_FIELDS) {
      const v = String(row[idx[field]] ?? '').trim()
      if (!v) errors.push(`row ${rowNum}: missing required field \`${field}\``)
    }
    for (const dateField of ['start_date', 'end_date']) {
      const v = String(row[idx[dateField]] ?? '').trim()
      if (v && !DATE_RE.test(v)) errors.push(`row ${rowNum}: \`${dateField}\` must be YYYY-MM-DD`)
    }
    for (const nField of ['west', 'east', 'south', 'north']) {
      const v = String(row[idx[nField]] ?? '').trim()
      if (v && Number.isNaN(Number(v))) errors.push(`row ${rowNum}: \`${nField}\` must be numeric`)
    }
    for (const hrefField of ['docucomp_contact_href', 'docucomp_graphic_href', 'license_docucomp_href']) {
      if (!idx[hrefField] && idx[hrefField] !== 0) continue
      const v = String(row[idx[hrefField]] ?? '').trim()
      if (v && !v.includes('data.noaa.gov/docucomp/')) {
        warnings.push(`row ${rowNum}: \`${hrefField}\` does not look like a docucomp URL`)
      }
    }
  }

  return json({
    ok: errors.length === 0,
    filename: String(payload?.filename ?? ''),
    rowCount: rows.length - 1,
    errorCount: errors.length,
    warningCount: warnings.length,
    errors: errors.slice(0, 200),
    warnings: warnings.slice(0, 200),
  })
}

