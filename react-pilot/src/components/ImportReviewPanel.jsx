/**
 * ImportReviewPanel — shows every field change from an import, lets the user
 * accept or reject conflicts field-by-field, then applies decisions.
 *
 * Props:
 *   changes       — FieldChange[] from diffPilotStates()
 *   sourceType    — string (e.g. 'rawIso', 'comet')
 *   filename      — optional original filename
 *   importedAt    — optional ISO timestamp
 *   onApply(changes) — called with final decisions array
 *   onCancel()    — discard import entirely
 */

import { useState, useMemo } from 'react'
import { evidenceClassLabel } from '../core/fragments/MetadataFragment.js'
import { partitionChanges } from '../core/fragments/diffPilotStates.js'

// ── Smart-resolve heuristics ─────────────────────────────────────────────────

const PLACEHOLDER_RE = /EXAMPLE|REPLACE_WITH|placeholder/i

const GLOBAL_BBOX_DEFAULTS = {
  'mission.west':  ['-180', '-180.0', -180],
  'mission.east':  ['180',  '180.0',  180],
  'mission.south': ['-90',  '-90.0',  -90],
  'mission.north': ['90',   '90.0',   90],
}

function isPlaceholder(value) {
  return PLACEHOLDER_RE.test(String(value ?? ''))
}

function isGlobalBboxDefault(fieldPath, value) {
  const defaults = GLOBAL_BBOX_DEFAULTS[fieldPath]
  if (!defaults) return false
  return defaults.map(String).includes(String(value))
}

/**
 * Returns true (accept), false (reject), or null (leave unresolved) for a conflict.
 */
function smartDecide(change) {
  // Always reject if the incoming value is a placeholder string
  if (isPlaceholder(change.newValue)) return false
  // Accept spatial bound when the old value was the global default
  if (isGlobalBboxDefault(change.fieldPath, change.previousValue)) return true
  // Accept if new value is a strict expansion of the old (e.g. full ISO name vs abbreviated)
  if (
    typeof change.newValue === 'string' &&
    typeof change.previousValue === 'string' &&
    change.newValue.startsWith(change.previousValue) &&
    change.newValue.length > change.previousValue.length
  ) return true
  return null
}

const SOURCE_LABELS = {
  rawIso:      'ISO XML import',
  comet:       'CoMET pull',
  cruisepack:  'CruisePack package',
  bediXml:     'BEDI XML import',
  lensScanner: 'Lens scanner',
  unknown:     'Unknown source',
}

const FIELD_LABELS = {
  'mission.fileId':             'File identifier',
  'mission.title':              'Title',
  'mission.abstract':           'Abstract',
  'mission.purpose':            'Purpose',
  'mission.status':             'Status',
  'mission.language':           'Language',
  'mission.startDate':          'Start date',
  'mission.endDate':            'End date',
  'mission.west':               'West bound',
  'mission.east':               'East bound',
  'mission.south':              'South bound',
  'mission.north':              'North bound',
  'mission.vmin':               'Vertical min',
  'mission.vmax':               'Vertical max',
  'mission.individualName':     'Contact name',
  'mission.org':                'Organization',
  'mission.email':              'Email',
  'mission.doi':                'DOI',
  'mission.accession':          'NCEI accession',
  'mission.dataLicensePreset':  'License preset',
  'mission.licenseUrl':         'License URL',
  'mission.citeAs':             'Cite as',
  'platform.platformId':        'Platform ID',
  'platform.platformDesc':      'Platform description',
  'platform.platformType':      'Platform type',
  'platform.model':             'Platform model',
  'platform.manufacturer':      'Manufacturer',
  'sensors':                    'Sensors',
  'spatial.geographicDescription': 'Geographic description',
  'spatial.verticalCrsUrl':     'Vertical CRS URL',
  'distribution.format':        'Distribution format',
  'distribution.downloadUrl':   'Download URL',
  'distribution.landingUrl':    'Landing URL',
}

function fieldLabel(path) {
  if (FIELD_LABELS[path]) return FIELD_LABELS[path]
  if (path.startsWith('keywords.')) return `Keywords — ${path.replace('keywords.', '')}`
  if (path.startsWith('distribution.')) return path.replace('distribution.', 'Distribution — ')
  return path
}

function truncate(v, max = 80) {
  if (v === null || v === undefined) return '(empty)'
  const s = String(v)
  return s.length > max ? `${s.slice(0, max)}…` : s
}

export default function ImportReviewPanel({ changes, sourceType, filename, importedAt, onApply, onCancel }) {
  const [decisions, setDecisions] = useState(() =>
    changes.map(c => ({ ...c, accepted: c.isConflict ? null : true }))
  )

  const { newFields, conflicts } = useMemo(() => partitionChanges(decisions), [decisions])

  const unresolvedCount = decisions.filter(d => d.isConflict && d.accepted === null).length
  const acceptedCount   = decisions.filter(d => d.accepted === true).length

  function setAccepted(fieldPath, val) {
    setDecisions(prev => prev.map(d => d.fieldPath === fieldPath ? { ...d, accepted: val } : d))
  }

  function acceptAll() {
    setDecisions(prev => prev.map(d => ({ ...d, accepted: true })))
  }

  function rejectAll() {
    setDecisions(prev => prev.map(d => ({ ...d, accepted: false })))
  }

  function smartResolve() {
    setDecisions(prev => prev.map(d => {
      if (!d.isConflict) return d
      const decision = smartDecide(d)
      return decision === null ? d : { ...d, accepted: decision }
    }))
  }

  const smartResolvableCount = useMemo(() =>
    decisions.filter(d => d.isConflict && d.accepted === null && smartDecide(d) !== null).length,
    [decisions]
  )

  const importedAtDisplay = importedAt
    ? new Date(importedAt).toLocaleString()
    : null

  return (
    <div
      className="import-review-overlay"
      style={{
        /* z-index: see .import-review-overlay in futuristic.css (!important beats FAB dock) */
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
        paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{
        background: 'var(--card-bg, #fff)',
        borderRadius: 12,
        boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
        width: '100%',
        maxWidth: 680,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* Header */}
        <div style={{
          padding: '1rem 1.25rem 0.75rem',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--fx-ocean, #006994)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1rem', flexShrink: 0,
            }}>↓</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-color)' }}>
                Review import
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--muted-text-color)' }}>
                {SOURCE_LABELS[sourceType] ?? sourceType}
                {filename ? ` — ${filename}` : ''}
                {importedAtDisplay ? ` · ${importedAtDisplay}` : ''}
              </div>
            </div>
          </div>

          {/* Summary pills */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Pill color="#0ea5e9" label={`${changes.length} field${changes.length !== 1 ? 's' : ''} found`} />
            <Pill color="#22c55e" label={`${newFields.length} new`} />
            {conflicts.length > 0 && (
              <Pill color="#f59e0b" label={`${conflicts.length} conflict${conflicts.length !== 1 ? 's' : ''}`} />
            )}
            {unresolvedCount > 0 && (
              <Pill color="#ef4444" label={`${unresolvedCount} unresolved`} />
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1, padding: '0.75rem 1.25rem' }}>

          {/* Conflicts section */}
          {conflicts.length > 0 && (
            <section>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#b45309', margin: 0 }}>
                  ⚠ Conflicts — existing values will be overwritten
                </h3>
                <div style={{ display: 'flex', gap: 6 }}>
                  {smartResolvableCount > 0 && (
                    <InlineBtn
                      onClick={smartResolve}
                      label={`✦ Smart resolve (${smartResolvableCount})`}
                      highlight
                    />
                  )}
                  <InlineBtn onClick={acceptAll} label="Accept all" />
                  <InlineBtn onClick={rejectAll} label="Reject all" />
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: '1rem' }}>
                {conflicts.map(c => (
                  <ConflictRow
                    key={c.fieldPath}
                    change={c}
                    accepted={decisions.find(d => d.fieldPath === c.fieldPath)?.accepted ?? null}
                    onAccept={() => setAccepted(c.fieldPath, true)}
                    onReject={() => setAccepted(c.fieldPath, false)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* New fields section */}
          {newFields.length > 0 && (
            <section>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#15803d', margin: '0 0 0.5rem' }}>
                ✓ New fields — added to empty slots
              </h3>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 1rem',
                fontSize: '0.75rem', color: 'var(--text-color)',
              }}>
                {newFields.map(c => (
                  <div key={c.fieldPath} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', minWidth: 0 }}>
                    <span style={{ color: '#16a34a', flexShrink: 0 }}>+</span>
                    <div style={{ minWidth: 0 }}>
                      <span style={{ fontWeight: 600 }}>{fieldLabel(c.fieldPath)}</span>
                      <span style={{ color: 'var(--muted-text-color)', marginLeft: 4 }}>
                        {truncate(c.newValue, 40)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {changes.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--muted-text-color)', padding: '2rem 0', fontSize: '0.85rem' }}>
              No new fields found in this import.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid var(--border-color, #e2e8f0)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--muted-text-color)' }}>
            Evidence: <strong>{evidenceClassLabel(decisions[0]?.evidenceClass ?? 'iso-xpath-exact')}</strong>
            {acceptedCount > 0 && ` · ${acceptedCount} field${acceptedCount !== 1 ? 's' : ''} will be applied`}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onCancel}
              style={{
                padding: '0.4rem 0.9rem',
                border: '1px solid var(--border-color)',
                borderRadius: 6,
                background: 'transparent',
                fontSize: '0.82rem', fontWeight: 600,
                cursor: 'pointer',
                color: 'var(--text-color)',
              }}
            >
              Cancel import
            </button>
            <button
              type="button"
              disabled={unresolvedCount > 0}
              onClick={() => onApply(decisions)}
              style={{
                padding: '0.4rem 0.9rem',
                border: 'none',
                borderRadius: 6,
                background: unresolvedCount > 0 ? '#cbd5e1' : 'var(--fx-ocean, #006994)',
                color: '#fff',
                fontSize: '0.82rem', fontWeight: 700,
                cursor: unresolvedCount > 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {unresolvedCount > 0 ? `Resolve ${unresolvedCount} conflict${unresolvedCount !== 1 ? 's' : ''}` : `Apply ${acceptedCount} field${acceptedCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ConflictRow({ change, accepted, onAccept, onReject }) {
  // Dark-theme cards: light #fffbeb + var(--text-color) was illegible; use translucent tints on dark.
  const borderColor = accepted === true
    ? 'rgba(34, 197, 94, 0.55)'
    : accepted === false
      ? 'rgba(148, 163, 184, 0.45)'
      : 'rgba(245, 158, 11, 0.5)'
  const bgColor = accepted === true
    ? 'rgba(34, 197, 94, 0.12)'
    : accepted === false
      ? 'rgba(148, 163, 184, 0.1)'
      : 'rgba(245, 158, 11, 0.1)'

  return (
    <div style={{
      border: `1.5px solid ${borderColor}`,
      borderRadius: 7,
      background: bgColor,
      padding: '0.5rem 0.65rem',
      display: 'grid',
      gridTemplateColumns: '1fr auto',
      gap: '0.35rem 0.75rem',
      alignItems: 'start',
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-color)', marginBottom: 3 }}>
          {fieldLabel(change.fieldPath)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem' }}>
          <div>
            <span style={{ color: '#b45309', fontWeight: 600 }}>Was: </span>
            <span style={{ color: 'var(--muted-text-color)' }}>{truncate(change.previousValue)}</span>
          </div>
          <div>
            <span style={{ color: '#16a34a', fontWeight: 600 }}>New: </span>
            <span style={{ color: 'var(--text-color)' }}>{truncate(change.newValue)}</span>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignSelf: 'center', flexShrink: 0 }}>
        <DecisionBtn
          label="Accept"
          active={accepted === true}
          activeColor="#16a34a"
          onClick={onAccept}
        />
        <DecisionBtn
          label="Reject"
          active={accepted === false}
          activeColor="#64748b"
          onClick={onReject}
        />
      </div>
    </div>
  )
}

function DecisionBtn({ label, active, activeColor, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.28rem 0.65rem',
        border: active
          ? `1.5px solid ${activeColor}`
          : '1.5px solid rgba(148, 163, 184, 0.55)',
        borderRadius: 6,
        background: active ? activeColor : 'rgba(15, 23, 42, 0.85)',
        color: active ? '#fff' : '#f8fafc',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        boxShadow: active ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
      }}
    >
      {label}
    </button>
  )
}

function Pill({ color, label }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 9999,
      background: `${color}18`,
      border: `1px solid ${color}40`,
      color,
      fontSize: '0.72rem',
      fontWeight: 700,
    }}>
      {label}
    </span>
  )
}

function InlineBtn({ label, onClick, highlight = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '4px 10px',
        border: highlight ? '1.5px solid #f59e0b' : '1px solid rgba(148, 163, 184, 0.45)',
        borderRadius: 6,
        background: highlight ? '#f59e0b' : 'rgba(15, 23, 42, 0.55)',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
        color: highlight ? '#1c1917' : '#f1f5f9',
      }}
    >
      {label}
    </button>
  )
}
