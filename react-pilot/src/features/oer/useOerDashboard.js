/**
 * useOerDashboard — fetches OER expedition records from InfoBroker or a
 * Google Sheets CSV export of the Okeanos Explorer Cruise Metrics sheet
 * (AllOkeanosCruiseMetrics tab).
 *
 * Primary source: POST /api/oer-query → InfoBroker XML-RPC
 * Fallback source: CSV upload (File API, client-side parse)
 */

import { useCallback, useEffect, useState } from 'react'

const API = '/api/oer-query'

/**
 * Extract a cruise ID from the CruiseName column.
 * e.g. "Okeanos Explorer: Gulf of Mexico (EX1711)" → "EX1711"
 */
function extractCruiseId(name) {
  return name?.match(/\((EX\d+[A-Z]?)\)/)?.[1] ?? (name ?? '')
}

/**
 * Lane status derived from Okeanos Explorer Cruise Metrics (AllOkeanosCruiseMetrics tab)
 * 'MB Data DOI' is empty in this CSV — use 'MB Archive Date' instead
 * 'Samples Total' is almost always blank — use Bio/Geo Primary Specimens
 * GIS, NOFO, BAG lanes have no signal in this sheet — always 'unknown'
 */
function deriveLaneStatus(row, source) {
  const NON_VALUES = new Set(['', 'nan', 'not received', 'n/a', 'n/a.'])
  const hasVal = v => {
    if (!v) return false
    const s = String(v).trim().toLowerCase()
    return s !== '' && !NON_VALUES.has(s) && !s.startsWith('combined with')
  }
  const now = new Date()
  const endDate = row['Cruise End'] ? new Date(row['Cruise End']) : null
  const cruiseEnded = endDate ? endDate < now : false

  // GEOPHYSICAL
  const mbArchived = hasVal(row['MB Archive Date']) || hasVal(row['MB Partial Archive Date'])
  const mbHasData  = parseFloat(row['Raw Multibeam Volume (GB)'] || 0) > 0
                  || parseFloat(row['Level 1 MB Volume (GB)'] || 0) > 0
  const geophysical = mbArchived           ? 'ready'
    : mbHasData && cruiseEnded             ? 'blocked'
    : mbHasData                            ? 'in-progress'
    : 'unknown'

  // OCEANOGRAPHIC
  const hasAccession = hasVal(row['Oceanographic Data Accession URL'])
                    || hasVal(row['Oceanographic Data DOI'])
  const wcsArchived  = hasVal(row['WCS Date Archived'])
  const hasOceanData = parseFloat(row['Water Column Profile Volume (GB)'] || 0) > 0
  const oceanographic = hasAccession             ? 'ready'
    : wcsArchived                                ? 'in-progress'
    : hasOceanData && cruiseEnded                ? 'blocked'
    : hasOceanData                               ? 'in-progress'
    : 'unknown'

  // VIDEO
  const videoPortal   = hasVal(row['Date Video Accessible through Portal'])
  const videoReceived = hasVal(row['Date Video Received at NCEI (on hard-drive)'])
  const video = videoPortal   ? 'ready'
    : videoReceived            ? 'in-progress'
    : 'unknown'

  // SAMPLES
  const bioCount   = parseFloat(row['Bio Primary Specimens'] || 0)
  const geoCount   = parseFloat(row['Geo Primary Specimens'] || 0)
  const waterCount = parseFloat(row['Water Samples'] || 0)
  const hasSamples = (bioCount + geoCount + waterCount) > 0
  const samples = hasSamples ? 'in-progress' : 'unknown'

  // DOCUMENTS
  const hasCruiseReport = hasVal(row['Cruise Report DOI'])
  const hasMDR          = hasVal(row['MDR DOI'])
  const hasPI           = hasVal(row['Project Instructions DOI'])
  const hasDiveSummary  = hasVal(row['Dive Summaries IR Link'])
  const documents = hasCruiseReport              ? 'ready'
    : (hasMDR || hasDiveSummary)                 ? 'in-progress'
    : hasPI                                       ? 'in-progress'
    : cruiseEnded                                 ? 'blocked'
    : 'unknown'

  // InfoBroker fields override CSV-derived lanes when richer
  if (source === 'infobroker') {
    return {
      geophysical:   row.accession_id ? 'ready'       : geophysical,
      oceanographic: row.da_link      ? 'ready'       : oceanographic,
      video,
      samples,
      documents,
      gis:  'unknown',
      nofo: row.grant_number          ? 'in-progress' : 'unknown',
      bag:  'unknown',
    }
  }

  return { geophysical, oceanographic, video, samples, documents,
           gis: 'unknown', nofo: 'unknown', bag: 'unknown' }
}

/**
 * Parse one raw CSV row from AllOkeanosCruiseMetrics into an Expedition.
 */
function csvRowToExpedition(r) {
  const name = r['CruiseName'] ?? ''
  const cruiseId = extractCruiseId(name)
  return {
    cruiseId,
    name,
    start:    r['Cruise Start'] ?? '',
    end:      r['Cruise End']   ?? '',
    region:   r['Region']       ?? '',
    abstract: r['Cruise Abstract'] || r['Mapping Abstract'] || '',
    lanes:    deriveLaneStatus(r, 'csv'),
    links: {
      oceanographicAccession: r['Oceanographic Data Accession URL'] || '',
      cruiseReport:           r['Cruise Report DOI']                || '',
      mdr:                    r['MDR DOI']                          || '',
      videoPortal:            r['Date Video Accessible through Portal'] || '',
    },
    _raw: r,
  }
}

/**
 * Transform one raw InfoBroker view_metadata row into an Expedition.
 */
function brokerRowToExpedition(r) {
  return {
    cruiseId:   r.cruise_id   ?? '',
    name:       r.cruise_name ?? r.cruise_id ?? '(unnamed)',
    start:      r.cruise_start ?? '',
    end:        r.cruise_end   ?? '',
    region:     r.ocean_basin  ?? '',
    abstract:   r.data_abstract ?? '',
    lanes:      deriveLaneStatus(r, 'infobroker'),
    links: {
      oceanographicAccession: r.da_link ?? '',
      cruiseReport: '',
      mdr:          '',
      videoPortal:  '',
    },
    _raw: r,
  }
}

/**
 * Parse a CSV text exported from Google Sheets.
 *
 * Handles quoted fields containing commas or newlines, double-quoted literal
 * quotes (""), and skips rows where CruiseName is blank.
 */
function parseCsvText(text) {
  function splitRow(line) {
    const fields = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { current += '"'; i++ }
        else if (ch === '"') inQuotes = false
        else current += ch
      } else {
        if (ch === '"') inQuotes = true
        else if (ch === ',') { fields.push(current); current = '' }
        else current += ch
      }
    }
    fields.push(current)
    return fields
  }

  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return []

  const headers = splitRow(lines[0]).map((h) => h.trim())

  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.trim()) continue
    const cells = splitRow(line)
    const row = {}
    headers.forEach((h, j) => { row[h] = (cells[j] ?? '').trim() })

    const cruiseName = row['CruiseName'] ?? ''
    if (!cruiseName || cruiseName === '0' || /^,*$/.test(cruiseName)) continue

    rows.push(row)
  }
  return rows
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useOerDashboard() {
  const [expeditions, setExpeditions] = useState([])
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)
  const [mode, setMode]               = useState('offline')
  const [csvFilename, setCsvFilename] = useState(null)
  const [lastSynced, setLastSynced]   = useState(null)

  const fetchLive = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      let pingOk = false
      try {
        const pingRes = await fetch(API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fn: 'ping' }),
        })
        if (pingRes.ok) {
          const ping = await pingRes.json()
          pingOk = Boolean(ping?.ok)
        }
      } catch {
        // Network error — InfoBroker unreachable.
      }

      if (!pingOk) {
        setMode('offline')
        setExpeditions([])
        return
      }

      const dataRes = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table: 'view_metadata', limit: 500 }),
      })

      if (!dataRes.ok) {
        setMode('offline')
        setError(`InfoBroker returned HTTP ${dataRes.status}`)
        setExpeditions([])
        return
      }

      const data = await dataRes.json()
      if (!data?.ok) {
        setMode('offline')
        setError(data?.error ?? 'Unknown error from InfoBroker')
        setExpeditions([])
        return
      }

      setExpeditions((data.rows ?? []).map(brokerRowToExpedition))
      setMode('live')
      setCsvFilename(null)
      setLastSynced(new Date().toISOString())

    } catch (err) {
      setMode('offline')
      setError(err instanceof Error ? err.message : String(err))
      setExpeditions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadCsv = useCallback((file) => {
    setLoading(true)
    setError(null)

    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const text = e.target?.result ?? ''
        const rows = parseCsvText(text)

        if (rows.length === 0) {
          setError('CSV appears empty or the CruiseName column was not found')
          setLoading(false)
          return
        }

        setExpeditions(rows.map(csvRowToExpedition))
        setMode('csv')
        setCsvFilename(file.name)
        setLastSynced(new Date().toISOString())
        setError(null)
      } catch (err) {
        setError(`CSV parse failed: ${err instanceof Error ? err.message : String(err)}`)
      } finally {
        setLoading(false)
      }
    }

    reader.onerror = () => {
      setError('Could not read the file')
      setLoading(false)
    }

    reader.readAsText(file)
  }, [])

  useEffect(() => {
    fetchLive()
  }, [fetchLive])

  return {
    expeditions,
    loading,
    error,
    mode,
    csvFilename,
    lastSynced,
    refetch: fetchLive,
    loadCsv,
  }
}
