/**
 * OERPipelineDashboard — standalone view for OER expedition pipeline status.
 * Styled using the futuristic.css / index.css design system variables only.
 */

import { useRef, useState } from 'react'
import { BEDI_QA_ROWS } from './bediQaCommands.js'
import { useOerDashboard } from './useOerDashboard.js'

// ── Lane config ──────────────────────────────────────────────────────────────

const LANES = [
  { id: 'geophysical',   label: 'Geo' },
  { id: 'oceanographic', label: 'Ocean' },
  { id: 'video',         label: 'Video' },
  { id: 'samples',       label: 'Samples' },
  { id: 'documents',     label: 'Docs' },
  { id: 'gis',           label: 'GIS' },
  { id: 'nofo',          label: 'NOFO' },
  { id: 'bag',           label: 'BAG' },
]

// ── Status pill ──────────────────────────────────────────────────────────────

const STATUS_META = {
  ready:         { color: '#16a34a', darkColor: '#4ade80', label: 'Ready' },
  'in-progress': { color: '#d97706', darkColor: '#fbbf24', label: 'In progress' },
  blocked:       { color: '#dc2626', darkColor: '#f87171', label: 'Blocked' },
  unknown:       { color: '#64748b', darkColor: '#94a3b8', label: '—' },
}

/** IntakeScreen profile color for `oerDashboard` — matches Record Studio SaaS tiles */
const OER_ACCENT = '#1D9E75'

const saasBtnPrimary = {
  padding: '0.35rem 0.9rem',
  border: 'none',
  borderRadius: 6,
  background: OER_ACCENT,
  color: '#fff',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
}

const saasBtnSecondary = {
  padding: '0.35rem 0.85rem',
  border: '1px solid var(--border-color, #e2e8f0)',
  borderRadius: 7,
  background: 'var(--card-bg, #fff)',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
  color: 'var(--text-color, #0f172a)',
}

function LanePill({ status, label }) {
  const meta = STATUS_META[status] ?? STATUS_META.unknown
  return (
    <span
      title={`${label}: ${meta.label}`}
      className={`oer-lane-pill oer-lane-pill--${status}`}
    >
      {label}
    </span>
  )
}

// ── Expedition table row ─────────────────────────────────────────────────────

const TD = { padding: '4px 8px', verticalAlign: 'middle', lineHeight: 1.2, fontSize: '0.8rem' }
const TD_MONO = { ...TD, fontFamily: 'monospace', fontSize: '0.74rem', maxWidth: 0, overflow: 'hidden' }
const TD_MUTED = { ...TD, color: 'var(--muted-text-color)', fontSize: '0.74rem', maxWidth: 0, overflow: 'hidden' }
const TD_DATES = { ...TD, whiteSpace: 'nowrap', fontSize: '0.74rem', color: 'var(--muted-text-color)' }
/** Outer td: must overflow hidden for ellipsis children under table-layout: fixed */
const TD_NAME  = { ...TD, overflow: 'hidden', maxWidth: 0 }
const TD_LANES = { ...TD, overflow: 'hidden', paddingTop: 2, paddingBottom: 2 }

function BediLocalQaSection() {
  const [copyFlash, setCopyFlash] = useState(null)

  async function handleCopy(id, cmd) {
    try {
      await navigator.clipboard.writeText(cmd)
      setCopyFlash({ id, ok: true })
      window.setTimeout(() => setCopyFlash(null), 2000)
    } catch {
      setCopyFlash({ id, ok: false })
      window.setTimeout(() => setCopyFlash(null), 2000)
    }
  }

  return (
    <details className="pilot-saas-card oer-bedi-qa-details">
      <summary className="oer-bedi-qa-summary">
        BEDI local QA
        <span className="oer-bedi-qa-summary-hint">terminal commands · react-pilot repo root</span>
      </summary>
      <p className="oer-bedi-qa-lede">
        Run these from your <code className="oer-bedi-qa-code">react-pilot/</code> checkout (paths point at a sibling{' '}
        <code className="oer-bedi-qa-code">oer/</code> folder — edit <code className="oer-bedi-qa-code">bediQaCommands.js</code> if yours differs).
      </p>
      <ul className="oer-bedi-qa-list">
        {BEDI_QA_ROWS.map((row) => (
          <li key={row.id} className="oer-bedi-qa-item">
            <div className="oer-bedi-qa-item-head">
              <span className="oer-bedi-qa-label">{row.label}</span>
              <button
                type="button"
                className="oer-bedi-qa-copy"
                style={{
                  ...saasBtnSecondary,
                  fontSize: '0.68rem',
                  padding: '0.12rem 0.45rem',
                }}
                onClick={() => handleCopy(row.id, row.cmd)}
              >
                {copyFlash?.id === row.id ? (copyFlash.ok ? 'Copied' : 'Failed') : 'Copy'}
              </button>
            </div>
            {row.hint && <p className="oer-bedi-qa-hint">{row.hint}</p>}
            <pre className="oer-bedi-qa-cmd" tabIndex={0}>{row.cmd}</pre>
          </li>
        ))}
      </ul>
    </details>
  )
}

function ExpeditionRow({ expedition }) {
  const { cruiseId, name, start, end, daLink, accessionId, lanes } = expedition
  const accessionStr = accessionId || '—'
  return (
    <tr className="oer-table-row">
      <td style={TD_MONO}>
        <div className="oer-cell-ellipsis" title={String(cruiseId || '')}>
          {daLink
            ? <a href={daLink} target="_blank" rel="noopener noreferrer" className="oer-link">{cruiseId}</a>
            : (cruiseId || '—')}
        </div>
      </td>
      <td style={TD_NAME}>
        <div className="oer-cell-ellipsis" title={name}>{name}</div>
      </td>
      <td style={TD_DATES}>
        {start && end ? `${start} → ${end}` : start || end || '—'}
      </td>
      <td style={TD_LANES}>
        <div className="oer-lanes-strip" title="Scroll horizontally for all lanes">
          {LANES.map(({ id, label }) => (
            <LanePill key={id} status={lanes[id] ?? 'unknown'} label={label} />
          ))}
        </div>
      </td>
      <td style={TD_MUTED}>
        <div className="oer-cell-ellipsis" title={typeof accessionStr === 'string' && accessionStr.length > 12 ? accessionStr : undefined}>{accessionStr}</div>
      </td>
      <td style={TD}>
        {daLink
          ? (
            <a
              href={daLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...saasBtnSecondary, fontSize: '0.78rem', display: 'inline-block', textDecoration: 'none' }}
            >
              View
            </a>
          )
          : <span style={{ color: 'var(--muted-text-color)', fontSize: '0.78rem' }}>—</span>}
      </td>
    </tr>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OERPipelineDashboard({ onLaunch }) {
  const { expeditions, loading, error, mode, csvFilename, lastSynced, refetch, loadCsv } = useOerDashboard()
  const csvRef = useRef(null)

  function handleCsvChange(e) {
    const file = e.target.files?.[0]
    if (file) loadCsv(file)
    e.target.value = ''
  }

  function handleDrop(e) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) loadCsv(file)
  }

  const syncLabel = lastSynced
    ? `Synced ${new Date(lastSynced).toLocaleTimeString()}`
    : 'Not yet synced'

  return (
    <div className="oer-dashboard pilot-intake-surface pilot-intake-surface--fluid">

      {/* ── Inline styles scoped to this component ── */}
      <style>{`
        .oer-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1rem;
          max-width: 100%;
          color: var(--text-color);
        }

        /* Header row */
        .oer-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0;
        }

        .oer-saas-panel--actions .oer-header {
          margin-bottom: 0.75rem;
        }

        .oer-launch-row {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          align-items: center;
        }

        .oer-title {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: ${OER_ACCENT};
        }

        .oer-count-chip {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.18rem 0.5rem;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: color-mix(in srgb, ${OER_ACCENT} 10%, var(--card-bg));
          color: ${OER_ACCENT};
          letter-spacing: 0.02em;
        }

        .oer-mode-chip {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.18rem 0.5rem;
          border-radius: 6px;
          letter-spacing: 0.02em;
        }

        .oer-mode-chip--live {
          background: color-mix(in srgb, #16a34a 14%, var(--card-bg));
          border: 1px solid color-mix(in srgb, #16a34a 35%, var(--border-color));
          color: #16a34a;
        }

        :root[data-theme='dark'] .oer-mode-chip--live {
          background: rgba(22, 163, 74, 0.18);
          border-color: rgba(74, 222, 128, 0.35);
          color: #4ade80;
        }

        .oer-mode-chip--csv {
          background: color-mix(in srgb, #6366f1 14%, var(--card-bg));
          border: 1px solid color-mix(in srgb, #6366f1 35%, var(--border-color));
          color: #6366f1;
        }

        :root[data-theme='dark'] .oer-mode-chip--csv {
          background: rgba(99, 102, 241, 0.18);
          border-color: rgba(129, 140, 248, 0.35);
          color: #818cf8;
        }

        .oer-sync-label {
          margin-left: auto;
          font-size: 0.75rem;
          color: var(--muted-text-color);
          font-variant-numeric: tabular-nums;
        }

        /* Offline banner — matches chip-warn pattern */
        .oer-offline-banner {
          display: flex;
          align-items: baseline;
          gap: 0.4rem;
          flex-wrap: wrap;
          padding: 0.6rem 1rem;
          border-radius: var(--radius-md, 10px);
          margin-bottom: 1rem;
          font-size: 0.85rem;
          line-height: 1.45;
          border: 1px solid #fde68a;
          background: #fffbeb;
          color: #92400e;
        }

        :root[data-theme='dark'] .oer-offline-banner {
          border-color: rgba(251, 191, 36, 0.35);
          background: rgba(120, 53, 15, 0.35);
          color: #fde68a;
        }

        .oer-offline-banner strong {
          font-weight: 700;
        }

        .oer-offline-detail {
          opacity: 0.8;
          font-size: 0.78rem;
        }

        /* CSV drop zone */
        .oer-drop-zone {
          border: 1.5px dashed var(--border-color);
          border-radius: 8px;
          padding: 0.75rem 1.25rem;
          margin-bottom: 0.75rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.82rem;
          color: var(--muted-text-color);
          background: color-mix(in srgb, ${OER_ACCENT} 5%, var(--card-bg));
          transition: border-color 0.15s, background 0.15s;
        }

        .oer-drop-zone:hover, .oer-drop-zone:focus-visible {
          border-color: ${OER_ACCENT};
          background: color-mix(in srgb, ${OER_ACCENT} 9%, var(--card-bg));
          outline: none;
        }

        .oer-filename {
          font-size: 0.75rem;
          color: ${OER_ACCENT};
          font-weight: 600;
          margin-left: auto;
        }

        /* Lane legend */
        .oer-legend {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.65rem;
          font-size: 0.74rem;
          align-items: center;
          color: var(--muted-text-color);
        }

        .oer-legend-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          margin-right: 3px;
          vertical-align: middle;
        }

        /* Table shell — nested inside pilot-saas-card */
        .oer-table-shell {
          border: 1px solid color-mix(in srgb, var(--border-color) 88%, transparent);
          border-radius: 8px;
          overflow: hidden;
          background: var(--card-bg);
        }

        .oer-table-wrap {
          overflow-x: auto;
        }

        .oer-table {
          width: 100%;
          min-width: 640px;
          table-layout: fixed;
          border-collapse: collapse;
          font-size: 0.83rem;
          color: var(--text-color);
        }

        /* Single-line clip — works with table-layout: fixed + col widths */
        .oer-cell-ellipsis {
          min-width: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oer-cell-ellipsis a {
          display: block;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Keep row height ~one line: pills scroll sideways instead of wrapping */
        .oer-lanes-strip {
          display: flex;
          flex-wrap: nowrap;
          align-items: center;
          gap: 4px;
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 0;
          scrollbar-width: thin;
        }

        .oer-lanes-strip::-webkit-scrollbar {
          height: 4px;
        }

        .oer-lanes-strip::-webkit-scrollbar-thumb {
          background: color-mix(in srgb, var(--muted-text-color) 45%, transparent);
          border-radius: 999px;
        }

        .oer-table thead tr {
          background: color-mix(in srgb, var(--primary-color) 8%, var(--card-bg));
          border-bottom: 1px solid var(--border-color);
        }

        :root[data-theme='dark'] .oer-table thead tr {
          background: color-mix(in srgb, var(--primary-color) 12%, rgba(2, 6, 23, 0.8));
        }

        .oer-th {
          padding: 0.6rem 0.85rem;
          text-align: left;
          font-size: 0.72rem;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--muted-text-color);
          white-space: nowrap;
        }

        .oer-table-row {
          border-bottom: 1px solid color-mix(in srgb, var(--border-color) 60%, transparent);
          transition: background 0.1s;
        }

        .oer-table-row:last-child {
          border-bottom: none;
        }

        .oer-table-row:hover {
          background: color-mix(in srgb, ${OER_ACCENT} 5%, var(--card-bg));
        }

        :root[data-theme='dark'] .oer-table-row:hover {
          background: color-mix(in srgb, ${OER_ACCENT} 8%, var(--card-bg));
        }

        .oer-td {
          padding: 0.5rem 0.85rem;
          vertical-align: middle;
        }

        .oer-td--mono {
          font-family: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;
          font-size: 0.76rem;
          white-space: nowrap;
        }

        .oer-td--name {
          max-width: 240px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .oer-td--dates {
          white-space: nowrap;
          font-size: 0.78rem;
          color: var(--muted-text-color);
        }

        .oer-td--muted {
          color: var(--muted-text-color);
        }

        .oer-link {
          color: ${OER_ACCENT};
          text-decoration: none;
          font-weight: 600;
        }

        .oer-link:hover {
          color: color-mix(in srgb, ${OER_ACCENT} 82%, #000);
          text-decoration: underline;
        }

        .oer-muted {
          color: var(--muted-text-color);
          font-size: 0.78rem;
        }

        .oer-empty-row td {
          padding: 2.5rem 1rem;
          text-align: center;
          color: var(--muted-text-color);
          font-size: 0.85rem;
        }

        /* Lane pills */
        .oer-lane-pill {
          display: inline-block;
          flex: 0 0 auto;
          padding: 0 5px;
          border-radius: 9999px;
          font-size: 0.64rem;
          font-weight: 700;
          white-space: nowrap;
          line-height: 1.5;
          letter-spacing: 0.02em;
        }

        .oer-lane-pill--ready {
          background: color-mix(in srgb, #16a34a 18%, var(--card-bg));
          color: #16a34a;
          border: 1px solid color-mix(in srgb, #16a34a 35%, var(--border-color));
        }

        :root[data-theme='dark'] .oer-lane-pill--ready {
          background: rgba(22, 163, 74, 0.22);
          color: #4ade80;
          border-color: rgba(74, 222, 128, 0.3);
        }

        .oer-lane-pill--in-progress {
          background: color-mix(in srgb, #d97706 14%, var(--card-bg));
          color: #d97706;
          border: 1px solid color-mix(in srgb, #d97706 30%, var(--border-color));
        }

        :root[data-theme='dark'] .oer-lane-pill--in-progress {
          background: rgba(217, 119, 6, 0.22);
          color: #fbbf24;
          border-color: rgba(251, 191, 36, 0.3);
        }

        .oer-lane-pill--blocked {
          background: color-mix(in srgb, #dc2626 12%, var(--card-bg));
          color: #dc2626;
          border: 1px solid color-mix(in srgb, #dc2626 28%, var(--border-color));
        }

        :root[data-theme='dark'] .oer-lane-pill--blocked {
          background: rgba(220, 38, 38, 0.22);
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.3);
        }

        .oer-lane-pill--unknown {
          background: color-mix(in srgb, var(--muted-text-color) 10%, var(--card-bg));
          color: var(--muted-text-color);
          border: 1px solid color-mix(in srgb, var(--border-color) 90%, transparent);
        }

        /* Footer note */
        .oer-footnote {
          font-size: 0.73rem;
          color: var(--muted-text-color);
          margin-top: 0.75rem;
          line-height: 1.5;
        }

        .oer-footnote code {
          font-family: 'JetBrains Mono', monospace;
          font-size: 0.72rem;
          background: color-mix(in srgb, ${OER_ACCENT} 8%, var(--card-bg));
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0 4px;
          color: ${OER_ACCENT};
        }

        /* BEDI local QA — collapsible; shell is pilot-saas-card */
        .oer-bedi-qa-details {
          padding: 0.65rem 0.9rem 0.85rem;
        }

        .oer-bedi-qa-summary {
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: ${OER_ACCENT};
          list-style: none;
          display: flex;
          align-items: baseline;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .oer-bedi-qa-summary::-webkit-details-marker {
          display: none;
        }

        .oer-bedi-qa-summary-hint {
          font-size: 0.68rem;
          font-weight: 600;
          text-transform: none;
          letter-spacing: 0;
          color: var(--muted-text-color);
        }

        .oer-bedi-qa-lede {
          margin: 0.55rem 0 0.65rem;
          font-size: 0.74rem;
          line-height: 1.45;
          color: var(--muted-text-color);
        }

        .oer-bedi-qa-code {
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.7rem;
          padding: 0 4px;
          border-radius: 4px;
          border: 1px solid var(--border-color);
          background: color-mix(in srgb, ${OER_ACCENT} 8%, var(--card-bg));
          color: ${OER_ACCENT};
        }

        .oer-bedi-qa-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 0.65rem;
        }

        .oer-bedi-qa-item {
          border: 1px solid color-mix(in srgb, var(--border-color) 85%, transparent);
          border-radius: 8px;
          padding: 0.45rem 0.55rem;
          background: var(--card-bg);
        }

        .oer-bedi-qa-item-head {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .oer-bedi-qa-label {
          font-size: 0.76rem;
          font-weight: 700;
          color: var(--text-color);
          line-height: 1.35;
        }

        .oer-bedi-qa-hint {
          margin: 0.25rem 0 0.35rem;
          font-size: 0.68rem;
          color: var(--muted-text-color);
          line-height: 1.35;
        }

        .oer-bedi-qa-cmd {
          margin: 0;
          padding: 0.45rem 0.5rem;
          font-family: 'JetBrains Mono', 'Fira Code', monospace;
          font-size: 0.65rem;
          line-height: 1.35;
          white-space: pre-wrap;
          word-break: break-all;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: color-mix(in srgb, var(--muted-text-color) 6%, var(--card-bg));
          color: var(--text-color);
          max-height: 5.5rem;
          overflow: auto;
        }
      `}</style>

      {/* ── Actions — SaaS card (matches intake / libraries panels) ─────── */}
      <section className="pilot-saas-card oer-saas-panel oer-saas-panel--actions" aria-label="OER pipeline">
        <div className="oer-header">
          <h2 className="oer-title">OER Pipeline</h2>

          <span className="oer-count-chip">
            {expeditions.length} expedition{expeditions.length !== 1 ? 's' : ''}
          </span>

          {mode === 'live' && (
            <span className="oer-mode-chip oer-mode-chip--live">Live — InfoBroker</span>
          )}
          {mode === 'csv' && (
            <span className="oer-mode-chip oer-mode-chip--csv">
              CSV{csvFilename ? ` · ${csvFilename}` : ''}
            </span>
          )}

          <span className="oer-sync-label">{syncLabel}</span>

          <button
            type="button"
            style={{ ...saasBtnSecondary, opacity: loading ? 0.65 : 1, cursor: loading ? 'wait' : 'pointer' }}
            onClick={refetch}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>

        {typeof onLaunch === 'function' ? (
          <div className="oer-launch-row">
            <button
              type="button"
              style={saasBtnPrimary}
              onClick={() => onLaunch('bediGranule', null)}
            >
              Open BEDI granule wizard
            </button>
            <button
              type="button"
              style={saasBtnPrimary}
              onClick={() => onLaunch('bediCollection', null)}
            >
              Open BEDI collection wizard
            </button>
            <button
              type="button"
              style={saasBtnSecondary}
              onClick={() => onLaunch('mission', 'underwater')}
            >
              Open UxS mission wizard
            </button>
          </div>
        ) : null}
      </section>

      <BediLocalQaSection />

      {/* ── Cruises / expeditions ───────────────────────────────────────── */}
      <section className="pilot-saas-card oer-expeditions-panel" aria-label="Cruise CSV and expeditions">
      {mode === 'offline' && (
        <div role="alert" className="oer-offline-banner">
          <strong>InfoBroker not reachable</strong>
          <span>— upload a Cruises CSV to load data.</span>
          {error && <span className="oer-offline-detail">({error})</span>}
        </div>
      )}

      <div
        className="oer-drop-zone"
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => csvRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Upload Cruises CSV"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') csvRef.current?.click() }}
      >
        <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
        Drop or click to upload Cruises Google Sheet CSV
        {csvFilename && <span className="oer-filename">{csvFilename}</span>}
        <input
          ref={csvRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: 'none' }}
          onChange={handleCsvChange}
          aria-hidden="true"
        />
      </div>

      <div className="oer-legend">
        <span>Lane key:</span>
        {Object.entries(STATUS_META).map(([status, meta]) => (
          <span key={status} style={{ display: 'flex', alignItems: 'center' }}>
            <span
              className="oer-legend-dot"
              style={{ background: meta.color }}
            />
            {meta.label}
          </span>
        ))}
      </div>

      <div className="oer-table-shell">
        <div className="oer-table-wrap">
          <table className="oer-table">
            <colgroup>
              <col className="oer-col-cruise" style={{ width: '12%' }} />
              <col className="oer-col-name" style={{ width: '26%' }} />
              <col className="oer-col-dates" style={{ width: '14%' }} />
              <col className="oer-col-lanes" style={{ width: '30%' }} />
              <col className="oer-col-accession" style={{ width: '12%' }} />
              <col className="oer-col-action" style={{ width: '6%' }} />
            </colgroup>
            <thead>
              <tr>
                {['Cruise ID','Name','Dates','Pipeline lanes','Accession',''].map(h => (
                  <th key={h} scope="col" style={{
                    padding: '4px 8px',
                    textAlign: 'left',
                    fontSize: '0.68rem',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    color: 'var(--muted-text-color)',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.3,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr className="oer-empty-row">
                  <td colSpan={6}>Loading expeditions…</td>
                </tr>
              )}
              {!loading && expeditions.length === 0 && (
                <tr className="oer-empty-row">
                  <td colSpan={6}>
                    {mode === 'offline'
                      ? 'No data — InfoBroker unreachable. Upload a CSV above to continue.'
                      : 'No expeditions returned.'}
                  </td>
                </tr>
              )}
              {!loading && expeditions.map((exp) => (
                <ExpeditionRow key={exp.cruiseId || exp.name} expedition={exp} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      </section>

      <p className="oer-footnote">
        Lane statuses derived from <code>view_metadata</code> fields.
        Full accuracy requires InfoBroker segment tables or a Cruises Google Sheet export.
      </p>
    </div>
  )
}
