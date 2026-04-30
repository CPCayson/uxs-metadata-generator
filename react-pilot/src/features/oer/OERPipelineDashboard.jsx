/**
 * OERPipelineDashboard — standalone view for OER expedition pipeline status.
 * Styled using the futuristic.css / index.css design system variables only.
 */

import { useEffect, useRef, useState } from 'react'
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

const COMET_LOOP_STEPS = [
  'Select 10 mission UUIDs (mix clean + messy records).',
  'Pull XML fixtures from CoMET and keep a baseline copy.',
  'Run local swarm + hygiene checks on every fixture.',
  'Run MetaServer and OneStop parity checks.',
  'Gate PASS only when CoMET roundtrip works: import then pull back out.',
  'Capture any new failure as a rule/map update and rerun all 10 fixtures.',
]
const COMET_LOOP_STORAGE_KEY = 'oer.cometValidationLoop.steps.v1'

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
          ? <a className="btn btn-sm btn-outline-secondary" href={daLink} target="_blank" rel="noopener noreferrer">View</a>
          : <span style={{ color: 'var(--muted-text-color)', fontSize: '0.78rem' }}>—</span>}
      </td>
    </tr>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

export default function OERPipelineDashboard({ onLaunch }) {
  const { expeditions, loading, error, mode, csvFilename, lastSynced, refetch, loadCsv } = useOerDashboard()
  const csvRef = useRef(null)
  const [loopChecks, setLoopChecks] = useState(() => COMET_LOOP_STEPS.map(() => false))

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COMET_LOOP_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const next = COMET_LOOP_STEPS.map((_, idx) => !!parsed[idx])
      setLoopChecks(next)
    } catch {
      // ignore storage parse errors
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(COMET_LOOP_STORAGE_KEY, JSON.stringify(loopChecks))
    } catch {
      // ignore storage write errors
    }
  }, [loopChecks])

  const completedSteps = loopChecks.filter(Boolean).length
  const completionPct = Math.round((completedSteps / COMET_LOOP_STEPS.length) * 100)

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

  function toggleLoopStep(index) {
    setLoopChecks((prev) => prev.map((v, i) => (i === index ? !v : v)))
  }

  function resetLoopChecks() {
    setLoopChecks(COMET_LOOP_STEPS.map(() => false))
  }

  return (
    <div className="oer-dashboard">

      {/* ── Inline styles scoped to this component ── */}
      <style>{`
        .oer-dashboard {
          padding: 1.5rem;
          max-width: 100%;
          color: var(--text-color);
        }

        /* Header row */
        .oer-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }

        .oer-title {
          margin: 0;
          font-size: 1.12rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: var(--primary-color);
          position: relative;
        }

        .oer-title::after {
          content: '';
          display: block;
          width: 56px;
          height: 3px;
          margin-top: 0.3rem;
          border-radius: 3px;
          background: linear-gradient(120deg, var(--primary-color), var(--primary-light));
        }

        .oer-count-chip {
          font-size: 0.72rem;
          font-weight: 700;
          padding: 0.18rem 0.5rem;
          border-radius: 6px;
          border: 1px solid var(--border-color);
          background: color-mix(in srgb, var(--primary-color) 10%, var(--card-bg));
          color: var(--primary-color);
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
          border-radius: var(--radius-md, 10px);
          padding: 0.75rem 1.25rem;
          margin-bottom: 1rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-size: 0.82rem;
          color: var(--muted-text-color);
          background: color-mix(in srgb, var(--primary-color) 3%, var(--card-bg));
          transition: border-color 0.15s, background 0.15s;
        }

        .oer-drop-zone:hover, .oer-drop-zone:focus-visible {
          border-color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 6%, var(--card-bg));
          outline: none;
        }

        .oer-filename {
          font-size: 0.75rem;
          color: var(--primary-color);
          font-weight: 600;
          margin-left: auto;
        }

        /* Lane legend */
        .oer-legend {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
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

        /* Table card */
        .oer-table-card {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md, 10px);
          overflow: hidden;
          background: var(--card-bg);
          box-shadow: var(--shadow-card, 0 1px 3px rgb(0 0 0 / 0.06));
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
          background: color-mix(in srgb, var(--primary-color) 4%, var(--card-bg));
        }

        :root[data-theme='dark'] .oer-table-row:hover {
          background: color-mix(in srgb, var(--primary-color) 7%, var(--card-bg));
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
          color: var(--primary-color);
          text-decoration: none;
          font-weight: 600;
        }

        .oer-link:hover {
          color: var(--primary-light);
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
          background: color-mix(in srgb, var(--primary-color) 8%, var(--card-bg));
          border: 1px solid var(--border-color);
          border-radius: 4px;
          padding: 0 4px;
          color: var(--primary-color);
        }

        .oer-playbook-card {
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md, 10px);
          background: color-mix(in srgb, var(--primary-color) 5%, var(--card-bg));
          padding: 0.85rem 1rem;
          margin-bottom: 0.9rem;
        }

        .oer-playbook-title {
          margin: 0 0 0.3rem;
          font-size: 0.84rem;
          font-weight: 800;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          color: var(--primary-color);
        }

        .oer-playbook-lede {
          margin: 0 0 0.55rem;
          font-size: 0.76rem;
          color: var(--text-color);
          line-height: 1.45;
        }

        .oer-playbook-list {
          margin: 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 0.35rem;
          font-size: 0.74rem;
          color: var(--muted-text-color);
          line-height: 1.4;
        }

        .oer-playbook-step {
          display: flex;
          align-items: flex-start;
          gap: 0.45rem;
          color: var(--text-color);
        }

        .oer-playbook-step input[type='checkbox'] {
          margin-top: 0.15rem;
          accent-color: var(--primary-color);
          cursor: pointer;
        }

        .oer-playbook-step label {
          cursor: pointer;
          user-select: none;
        }

        .oer-playbook-step--done label {
          text-decoration: line-through;
          color: var(--muted-text-color);
        }

        .oer-playbook-toolbar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.55rem;
          flex-wrap: wrap;
        }

        .oer-playbook-progress-chip {
          font-size: 0.7rem;
          font-weight: 700;
          border: 1px solid var(--border-color);
          border-radius: 999px;
          padding: 0.14rem 0.5rem;
          color: var(--primary-color);
          background: color-mix(in srgb, var(--primary-color) 12%, var(--card-bg));
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
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
          className="btn btn-sm btn-outline-secondary"
          onClick={refetch}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {typeof onLaunch === 'function' ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: '0.8rem' }}>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => onLaunch('bediGranule', null)}
          >
            Open BEDI granule wizard
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => onLaunch('bediCollection', null)}
          >
            Open BEDI collection wizard
          </button>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={() => onLaunch('mission', 'underwater')}
          >
            Open UxS mission wizard
          </button>
        </div>
      ) : null}

      <section className="oer-playbook-card" aria-label="CoMET validation loop playbook">
        <h3 className="oer-playbook-title">CoMET Validation Loop</h3>
        <p className="oer-playbook-lede">
          Operational gate: a record is only pass-ready when CoMET accepts import and the same record can be pulled back out.
        </p>
        <div className="oer-playbook-toolbar">
          <span className="oer-playbook-progress-chip">
            {completedSteps}/{COMET_LOOP_STEPS.length} complete ({completionPct}%)
          </span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary"
            onClick={resetLoopChecks}
          >
            Reset checklist
          </button>
        </div>
        <ol className="oer-playbook-list">
          {COMET_LOOP_STEPS.map((step, idx) => (
            <li key={step} className={`oer-playbook-step ${loopChecks[idx] ? 'oer-playbook-step--done' : ''}`}>
              <input
                id={`comet-loop-step-${idx}`}
                type="checkbox"
                checked={!!loopChecks[idx]}
                onChange={() => toggleLoopStep(idx)}
              />
              <label htmlFor={`comet-loop-step-${idx}`}>{step}</label>
            </li>
          ))}
        </ol>
      </section>

      {/* ── Offline banner ──────────────────────────────────────────────── */}
      {mode === 'offline' && (
        <div role="alert" className="oer-offline-banner">
          <strong>InfoBroker not reachable</strong>
          <span>— upload a Cruises CSV to load data.</span>
          {error && <span className="oer-offline-detail">({error})</span>}
        </div>
      )}

      {/* ── CSV drop zone ───────────────────────────────────────────────── */}
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

      {/* ── Lane legend ─────────────────────────────────────────────────── */}
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

      {/* ── Table ───────────────────────────────────────────────────────── */}
      <div className="oer-table-card">
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

      <p className="oer-footnote">
        Lane statuses derived from <code>view_metadata</code> fields.
        Full accuracy requires InfoBroker segment tables or a Cruises Google Sheet export.
      </p>
    </div>
  )
}
