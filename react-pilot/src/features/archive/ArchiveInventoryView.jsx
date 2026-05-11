/**
 * ArchiveInventoryView — record browser over **your** bundled XML fixtures.
 *
 * Every `*.xml` under `./demo-records/` is included at build time (`import.meta.glob`).
 * Titles, file IDs, issue counts, and chips come from **real import + lenient validation**
 * of each file — not a hand-maintained storyboard list.
 *
 * Add or replace XML in `src/features/archive/demo-records/` and rebuild / hot-reload.
 *
 * Layout matches IntakeScreen: `pilot-intake-surface` (App.jsx) + ClassifyCard-style rows.
 */
import { useState } from 'react'

import { defaultPilotState, mergeLoadedPilotState, validatePilotState } from '../../lib/pilotValidation.js'
import { importPilotPartialStateFromXml } from '../../lib/xmlPilotImport.js'

const STATUS = {
  VALID:    { label: 'VALID',        color: '#16a34a', bg: '#dcfce7', text: '#14532d' },
  REPAIR:   { label: 'NEEDS REPAIR', color: '#dc2626', bg: '#fee2e2', text: '#7f1d1d' },
  REAL:     { label: 'REAL RECORD',  color: '#2563eb', bg: '#dbeafe', text: '#1e3a8a' },
  TEMPLATE: { label: 'TEMPLATE',     color: '#7c3aed', bg: '#ede9fe', text: '#3b0764' },
  COMET:    { label: 'CoMET EXPORT', color: '#0891b2', bg: '#cffafe', text: '#164e63' },
}

const KW_FACET_KEYS = [
  'sciencekeywords',
  'datacenters',
  'platforms',
  'instruments',
  'locations',
  'projects',
  'providers',
]

/** CoMET-style fixture filenames */
const UUID_FILENAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.xml$/i

/** Cruise / UxS fixture naming — REAL filter + REAL badge for messy operational extracts */
function looksOperationalFilename(id) {
  const base = String(id ?? '').replace(/\.xml$/i, '')
  return (
    /^PS\d+/i.test(base)
    || /norbit-mb/i.test(base)
    || /^navy-uxs/i.test(base)
    || /^uxs-/i.test(base)
  )
}

const FILTER_ACTIVE = '#534AB7'

/** All XML under demo-records — add your files here; they ship with the bundle. */
const XML_GLOB = import.meta.glob('./demo-records/*.xml', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/**
 * @param {string} s
 * @param {number} n
 */
function truncate(s, n) {
  const t = String(s || '').trim()
  if (!t || t.length <= n) return t
  return `${t.slice(0, n - 1).trimEnd()}…`
}

/** Strip `<!-- ... -->` so instructional {{placeholders}} in comments do not mark the whole file as TEMPLATE. */
function xmlWithoutComments(xmlText) {
  return String(xmlText ?? '').replace(/<!--[\s\S]*?-->/g, '')
}

/**
 * @param {string} xmlText
 * @param {number} lenientErrCount
 * @param {boolean} parseOk
 * @param {string} filename
 */
function inferStatus(xmlText, lenientErrCount, parseOk, filename) {
  const id = filename.replace(/\.xml$/i, '')
  if (!parseOk) return STATUS.REPAIR
  if (UUID_FILENAME.test(filename)) return STATUS.COMET
  if (/\{\{[^}]+\}\}/.test(xmlWithoutComments(xmlText))) return STATUS.TEMPLATE
  if (lenientErrCount === 0) return STATUS.VALID
  if (/-BAD$/i.test(id)) return STATUS.REPAIR
  if (looksOperationalFilename(id)) return STATUS.REAL
  return STATUS.REPAIR
}

function buildArchiveRecords() {
  /** @type {Array<{
   *   id: string,
   *   status: typeof STATUS.VALID,
   *   title: string,
   *   sub: string,
   *   fileId: string,
   *   profileId: string,
   *   platformHint: string | null,
   *   xml: string,
   *   chips: string[],
   *   issueCount: number | null,
   * }>} */
  const items = []

  for (const [path, mod] of Object.entries(XML_GLOB)) {
    const filename = path.replace(/^.*\//, '')
    const id = filename.replace(/\.xml$/i, '')

    try {
      const xml = typeof mod === 'string' ? mod : ''
      const parsed = importPilotPartialStateFromXml(xml)
      if (!parsed.ok) {
        items.push({
          id,
          status: STATUS.REPAIR,
          title: filename,
          sub: `Import failed: ${parsed.error}`,
          fileId: '—',
          profileId: 'mission',
          platformHint: 'underwater',
          xml,
          chips: ['XML did not map to mission pilotState'],
          issueCount: null,
        })
        continue
      }

      const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
      const { issues } = validatePilotState('lenient', merged)
      const errCount = issues.filter((i) => i.severity === 'e').length

      const m = merged.mission || {}
      const title = String(m.title || '').trim() || filename
      const abstract = String(m.abstract || '').trim()
      const purpose = String(m.purpose || '').trim()
      const sub =
        truncate(abstract, 160) ||
        truncate(purpose, 160) ||
        'Imported mission metadata (no abstract/purpose in file)'

      const fileId = String(m.fileId || '').trim() || '(no fileIdentifier)'
      const status = inferStatus(xml, errCount, true, filename)

      const facetTotal = KW_FACET_KEYS.reduce((n, k) => {
        const arr = merged.keywords?.[k]
        return n + (Array.isArray(arr) ? arr.length : 0)
      }, 0)

      const chips = []
      chips.push(errCount === 0 ? 'Lenient: 0 blocking issues' : `${errCount} blocking issues (lenient)`)
      if (facetTotal > 0) chips.push(`${facetTotal} GCMD keyword chips`)
      const warnN = Array.isArray(parsed.warnings) ? parsed.warnings.length : 0
      if (warnN > 0) chips.push(`${warnN} import warning${warnN === 1 ? '' : 's'}`)

      items.push({
        id,
        status,
        title,
        sub,
        fileId,
        profileId: 'mission',
        platformHint: 'underwater',
        xml,
        chips,
        issueCount: errCount,
      })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      items.push({
        id,
        status: STATUS.REPAIR,
        title: filename,
        sub: `Catalog build error: ${msg}`,
        fileId: '—',
        profileId: 'mission',
        platformHint: 'underwater',
        xml: typeof mod === 'string' ? mod : '',
        chips: ['Exception while validating — check console'],
        issueCount: null,
      })
    }
  }

  items.sort((a, b) => a.id.localeCompare(b.id))
  return items
}

const RECORDS = buildArchiveRecords()

/**
 * Same structure as IntakeScreen `ClassifyCard`: colored ring, avatar circle, title stack, primary CTA.
 */
function RecordCard({ record, onOpen, loading }) {
  const { status } = record
  const color = status.color
  const busy = loading === record.id
  const letter = String(record.title || '?').trim().slice(0, 1).toUpperCase() || '?'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        padding: '0.75rem 1rem',
        border: `1.5px solid ${color}`,
        borderRadius: 8,
        background: 'var(--card-bg, #fff)',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: '50%',
          background: color,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '1rem',
          flexShrink: 0,
        }}
      >
        {letter}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color }}>
          {record.title}
          <span
            style={{
              marginLeft: 8,
              fontSize: '0.65rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              background: status.bg,
              color: status.text,
              border: `1px solid ${color}44`,
              padding: '2px 7px',
              borderRadius: 4,
              verticalAlign: 'middle',
            }}
          >
            {status.label}
          </span>
        </div>
        <div
          style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            marginTop: 4,
            lineHeight: 1.45,
          }}
        >
          {record.sub}
        </div>
        {record.issueCount !== null && (
          <div
            style={{
              display: 'inline-block',
              marginTop: 4,
              fontSize: '0.73rem',
              fontWeight: 600,
              background: '#e0f2fe',
              color: '#0369a1',
              padding: '1px 8px',
              borderRadius: 9999,
            }}
          >
            {record.issueCount === 0 ? '0 blocking (lenient)' : `${record.issueCount} blocking (lenient)`}
          </div>
        )}
        <div
          style={{
            marginTop: 8,
            fontSize: '0.72rem',
            fontWeight: 600,
            fontFamily: 'monospace',
            color: 'var(--text-muted)',
            lineHeight: 1.4,
            wordBreak: 'break-word',
          }}
        >
          {record.fileId}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {record.chips.map((c) => (
            <span
              key={c}
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                background: '#e0f2fe',
                color: '#0369a1',
                padding: '1px 8px',
                borderRadius: 9999,
              }}
            >
              {c}
            </span>
          ))}
        </div>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onOpen(record)}
        style={{
          padding: '0.35rem 0.9rem',
          border: 'none',
          borderRadius: 6,
          background: busy ? '#cbd5e1' : color,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.82rem',
          cursor: busy ? 'wait' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          alignSelf: 'center',
        }}
      >
        {busy ? 'Opening…' : 'Open wizard →'}
      </button>
    </div>
  )
}

export default function ArchiveInventoryView({ onOpenRecord }) {
  const [loading, setLoading] = useState(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  function handleLoad(record) {
    setError('')
    setLoading(record.id)
    try {
      if (typeof onOpenRecord === 'function') {
        onOpenRecord({ xmlText: record.xml, profileId: record.profileId, platformHint: record.platformHint })
      }
    } catch (e) {
      setError(`Could not open record: ${e.message}`)
    } finally {
      setLoading(null)
    }
  }

  const FILTERS = [
    { id: 'all',      label: 'All records' },
    { id: 'VALID',    label: 'Valid' },
    { id: 'REPAIR',   label: 'Needs repair' },
    { id: 'REAL',     label: 'Real records' },
    { id: 'TEMPLATE', label: 'Templates' },
    { id: 'COMET',    label: 'CoMET exports' },
  ]

  const visible =
    filter === 'all'
      ? RECORDS
      : RECORDS.filter((r) => {
          if (filter === 'VALID') return r.status === STATUS.VALID
          if (filter === 'REPAIR') return r.status === STATUS.REPAIR
          if (filter === 'REAL') {
            return r.status === STATUS.REAL || (looksOperationalFilename(r.id) && r.status === STATUS.VALID)
          }
          if (filter === 'TEMPLATE') return r.status === STATUS.TEMPLATE
          if (filter === 'COMET') return r.status === STATUS.COMET
          return true
        })

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2
        style={{
          fontSize: '1.35rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '0.35rem',
          color: 'var(--text-color, #0f172a)',
        }}
      >
        Demo records
      </h2>
      <p
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          lineHeight: 1.5,
          color: 'var(--text-muted)',
          marginBottom: '1.25rem',
        }}
      >
        Each row is built from an XML file in{' '}
        <code style={{ fontSize: '0.82rem', fontWeight: 700 }}>src/features/archive/demo-records/</code> — titles,
        identifiers, and issue counts come from <strong style={{ color: 'var(--text-color, #0f172a)' }}>import + lenient validation</strong>, not hand-written copy.{' '}
        <strong>Valid</strong> means <strong>0 blocking issues</strong> in lenient mode and{' '}
        <strong>no <code style={{ fontSize: '0.78rem' }}>{'{{placeholders}}'}</code></strong> in metadata elements
        (instructional braces inside <code style={{ fontSize: '0.78rem' }}>&lt;!-- comments --&gt;</code> are ignored).
      </p>

      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
        Filter list:
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: '1rem' }}>
        {FILTERS.map((f) => {
          const active = filter === f.id
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                padding: '0.6rem 0.85rem',
                border: `1px solid ${active ? FILTER_ACTIVE : 'var(--border-color, #e2e8f0)'}`,
                borderRadius: 7,
                background: active ? 'rgba(83, 74, 183, 0.06)' : 'var(--card-bg, #fff)',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: active ? `inset 0 0 0 1px ${FILTER_ACTIVE}33` : 'none',
              }}
            >
              <span style={{ fontWeight: 600, fontSize: '0.85rem', color: active ? FILTER_ACTIVE : 'var(--text-color, #0f172a)' }}>
                {f.label}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.8rem',
            border: '1px solid #dc2626',
            borderRadius: 8,
            background: '#fef2f2',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: '#dc2626',
          }}
        >
          {error}
        </div>
      )}

      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
        Bundled XML files:
      </p>

      {RECORDS.length === 0 ? (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          No <code>.xml</code> files found under <code>demo-records/</code>. Add fixtures and save — Vite will pick them up.
        </p>
      ) : visible.length === 0 ? (
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          No demo records match this filter — try <strong>All records</strong> or another category.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {visible.map((rec) => (
            <RecordCard key={rec.id} record={rec} onOpen={handleLoad} loading={loading} />
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: '1.5rem',
          padding: '0.65rem 0.8rem',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 8,
          background: 'var(--card-bg, #fff)',
          fontSize: '0.78rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: 'var(--text-color, #0f172a)' }}>Your files:</strong>{' '}
        Drop new <code>.xml</code> into <code>react-pilot/src/features/archive/demo-records/</code> (same folder as these fixtures). Rebuild or refresh dev — cards update from file contents automatically.
      </div>
    </div>
  )
}
