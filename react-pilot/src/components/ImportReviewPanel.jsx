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
      <div
        className="import-review-panel"
        style={{
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
          width: '100%',
          maxWidth: 680,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >

        {/* Header */}
        <div className="import-review-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--fx-ocean, #006994)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '1rem', flexShrink: 0,
            }}>↓</div>
            <div>
              <div className="import-review-title">Review import</div>
              <div className="import-review-subtitle">
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
        <div className="import-review-body">

          {/* Conflicts section */}
          {conflicts.length > 0 && (
            <section>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: '0.5rem',
              }}>
                <h3 className="import-review-section-title import-review-section-title--conflicts">
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
              <h3 className="import-review-section-title import-review-section-title--new">
                ✓ New fields — added to empty slots
              </h3>
              <div className="import-review-new-fields-grid">
                {newFields.map(c => (
                  <div key={c.fieldPath} className="import-review-new-field-row">
                    <span className="import-review-new-field-plus">+</span>
                    <div style={{ minWidth: 0 }}>
                      <span className="import-review-new-field-name">{fieldLabel(c.fieldPath)}</span>
                      <span className="import-review-new-field-value">
                        {truncate(c.newValue, 40)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {changes.length === 0 && (
            <div className="import-review-empty">
              No new fields found in this import.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="import-review-footer">
          <div className="import-review-footer-note">
            Evidence: <strong>{evidenceClassLabel(decisions[0]?.evidenceClass ?? 'iso-xpath-exact')}</strong>
            {acceptedCount > 0 && ` · ${acceptedCount} field${acceptedCount !== 1 ? 's' : ''} will be applied`}
          </div>
          <div className="import-review-footer-actions">
            <button type="button" className="import-review-btn import-review-btn--cancel" onClick={onCancel}>
              Cancel import
            </button>
            <button
              type="button"
              className="import-review-btn import-review-btn--apply"
              disabled={unresolvedCount > 0}
              onClick={() => onApply(decisions)}
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
    <div
      className="import-review-conflict-row"
      style={{
        border: `1.5px solid ${borderColor}`,
        borderRadius: 7,
        background: bgColor,
        padding: '0.5rem 0.65rem',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: '0.35rem 0.75rem',
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div className="import-review-conflict-field">{fieldLabel(change.fieldPath)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.72rem' }}>
          <div>
            <span className="import-review-val-label import-review-val-label--was">Was: </span>
            <span className="import-review-val-text import-review-val-text--muted">{truncate(change.previousValue)}</span>
          </div>
          <div>
            <span className="import-review-val-label import-review-val-label--new">New: </span>
            <span className="import-review-val-text import-review-val-text--emph">{truncate(change.newValue)}</span>
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
      className={`import-review-decision-btn${active ? ' import-review-decision-btn--active' : ''}`}
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
    <span className="import-review-pill" style={{ '--pill-accent': color }}>
      {label}
    </span>
  )
}

function InlineBtn({ label, onClick, highlight = false }) {
  return (
    <button
      type="button"
      className={`import-review-inline-btn${highlight ? ' import-review-inline-btn--highlight' : ''}`}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
