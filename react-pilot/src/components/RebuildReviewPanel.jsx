/**
 * RebuildReviewPanel — Step 4 of the Reverse Paper Shredder
 *
 * Shows the user:
 * 1. A summary of what was reconstructed (source count, field count, fingerprint)
 * 2. Conflicts — fields where sources disagreed, user picks the winner
 * 3. Suggestions — llm-suggestion fields waiting for explicit acceptance
 * 4. An "Apply to wizard" button that merges the accepted result into pilotState
 *
 * Props:
 *   result     {object}    — from useMultiSourceReconstruct / buildMultiSourceReconstructResult
 *   onApply    {function}  — called with the final mergedState to apply to pilotState
 *   onDismiss  {function}  — called when user closes the panel
 */

import { useMemo, useState } from 'react'
import { evidenceClassLabel } from '../core/fragments/MetadataFragment.js'

// Design tokens — matches Manta dark navy theme
const COLORS = {
  bg: '#0d1117',
  surface: '#161b22',
  border: '#30363d',
  teal: '#00CED1',
  orange: '#FF6B35',
  amber: '#f0a500',
  green: '#2ea043',
  red: '#da3633',
  textPrimary: '#e6edf3',
  textMuted: '#8b949e',
  fontMono: '"DM Mono", "Fira Code", monospace',
  fontSans: '"Syne", system-ui, sans-serif',
}

/** @param {string} evidence */
function evidencePillColor(evidence) {
  const rank = {
    'user-confirmed': '#2ea043',
    'on-prod-record': '#1f6feb',
    'comet-pull': '#388bfd',
    'iso-xpath-exact': '#00CED1',
    'iso-xpath-recovered': '#a371f7',
    'template-token-resolved': '#d29922',
    'cruisepack-json': '#d29922',
    'csv-column-mapped': '#f0883e',
    'scanner-structured': '#f0883e',
    'llm-suggestion': '#8b949e',
    'regex-text': '#6e7681',
  }
  return rank[evidence] ?? '#6e7681'
}

/** @param {string} evidence */
function pill(evidence) {
  return {
    display: 'inline-block',
    padding: '2px 7px',
    borderRadius: '10px',
    fontSize: '11px',
    fontFamily: COLORS.fontMono,
    fontWeight: 600,
    background: evidencePillColor(evidence),
    color: '#fff',
    letterSpacing: '0.02em',
  }
}

/** @param {unknown} value */
function formatValue(value) {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

/** @param {unknown} str @param {number} [max] */
function truncate(str, max = 80) {
  const s = String(str ?? '')
  return s.length > max ? `${s.slice(0, max)}…` : s
}

function SummaryBar({ result }) {
  const {
    sourceCount,
    fragmentCount,
    fingerprint,
    appliedCount,
    skippedCount,
    conflicts,
    suggestions,
    extractionErrors,
  } = result

  return (
    <div
      style={{
        padding: '12px 16px',
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '16px',
        alignItems: 'center',
        fontSize: '13px',
        fontFamily: COLORS.fontMono,
      }}
    >
      <span style={{ color: COLORS.teal, fontWeight: 700 }}>🔬 Reconstructed</span>
      <span style={{ color: COLORS.textMuted }}>
        {sourceCount} source{sourceCount !== 1 ? 's' : ''}
      </span>
      <span style={{ color: COLORS.textMuted }}>{fragmentCount} fragments</span>
      <span style={{ color: COLORS.textMuted }}>
        {appliedCount} applied · {skippedCount} skipped
      </span>
      {fingerprint ? (
        <span
          style={{
            color: COLORS.textPrimary,
            background: '#1f2937',
            padding: '2px 8px',
            borderRadius: '6px',
            fontSize: '11px',
          }}
        >
          🔑 {fingerprint}
        </span>
      ) : null}
      {conflicts?.length > 0 ? (
        <span style={{ color: COLORS.amber }}>
          ⚠ {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''}
        </span>
      ) : null}
      {suggestions?.length > 0 ? (
        <span style={{ color: COLORS.orange }}>
          💡 {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
        </span>
      ) : null}
      {extractionErrors?.length > 0 ? (
        <span style={{ color: COLORS.red }}>
          ✗ {extractionErrors.length} extraction error{extractionErrors.length !== 1 ? 's' : ''}
        </span>
      ) : null}
    </div>
  )
}

/**
 * @param {{ field: import('../core/reconcile/reconcileFragments.js').ReconciledField, onResolve: (path: string, value: unknown, evidence: string) => void }} props
 */
function ConflictRow({ field, onResolve }) {
  const [chosen, setChosen] = useState(null)

  const allOptions = [
    {
      value: field.value,
      evidence: field.evidence,
      source: field.sources?.[0],
      isWinner: true,
    },
    ...field.conflicts.map((c) => ({
      value: c.value,
      evidence: c.evidence,
      source: c.source,
      isWinner: false,
    })),
  ]

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: chosen !== null ? '#0d1f0d' : 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '8px',
        }}
      >
        <span style={{ color: COLORS.amber, fontSize: '12px' }}>⚠ CONFLICT</span>
        <code
          style={{
            color: COLORS.teal,
            fontSize: '12px',
            fontFamily: COLORS.fontMono,
          }}
        >
          {field.fieldPath}
        </code>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {allOptions.map((opt, i) => (
          <label
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              border: `1px solid ${chosen === i ? COLORS.teal : COLORS.border}`,
              background: chosen === i ? '#0a2a2a' : COLORS.surface,
              cursor: 'pointer',
            }}
          >
            <input
              type="radio"
              name={`conflict-${field.fieldPath.replace(/\./g, '-')}`}
              checked={chosen === i}
              onChange={() => {
                setChosen(i)
                onResolve(field.fieldPath, opt.value, opt.evidence)
              }}
              style={{ marginTop: '2px', accentColor: COLORS.teal }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={pill(opt.evidence)}>{evidenceClassLabel(opt.evidence)}</span>
                {opt.isWinner ? (
                  <span
                    style={{
                      ...pill('user-confirmed'),
                      background: '#1f6feb',
                      fontSize: '10px',
                    }}
                  >
                    auto-selected
                  </span>
                ) : null}
                {opt.source?.id ? (
                  <span style={{ color: COLORS.textMuted, fontSize: '11px' }}>{opt.source.id}</span>
                ) : null}
              </div>
              <div
                style={{
                  color: COLORS.textPrimary,
                  fontSize: '12px',
                  fontFamily: COLORS.fontMono,
                  wordBreak: 'break-word',
                }}
              >
                {truncate(formatValue(opt.value), 120)}
              </div>
            </div>
          </label>
        ))}
      </div>
    </div>
  )
}

/**
 * @param {{ field: import('../core/reconcile/reconcileFragments.js').ReconciledField, onAccept: (path: string, value: unknown) => void, onReject: (path: string) => void }} props
 */
function SuggestionRow({ field, onAccept, onReject }) {
  const [decided, setDecided] = useState(null)

  return (
    <div
      style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${COLORS.border}`,
        opacity: decided ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginBottom: '6px',
        }}
      >
        <span style={{ color: COLORS.orange, fontSize: '12px' }}>💡 SUGGESTION</span>
        <code style={{ color: COLORS.teal, fontSize: '12px', fontFamily: COLORS.fontMono }}>{field.fieldPath}</code>
        <span style={pill('llm-suggestion')}>llm-suggestion</span>
        {field.sources?.[0]?.id ? (
          <span style={{ color: COLORS.textMuted, fontSize: '11px' }}>{field.sources[0].id}</span>
        ) : null}
      </div>

      <div
        style={{
          color: COLORS.textPrimary,
          fontSize: '12px',
          fontFamily: COLORS.fontMono,
          marginBottom: '8px',
          padding: '6px 10px',
          background: COLORS.surface,
          borderRadius: '4px',
          borderLeft: `3px solid ${COLORS.orange}`,
          wordBreak: 'break-word',
        }}
      >
        {truncate(formatValue(field.value), 200)}
      </div>

      {decided === null ? (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => {
              setDecided('accepted')
              onAccept(field.fieldPath, field.value)
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${COLORS.green}`,
              background: 'transparent',
              color: COLORS.green,
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
            }}
          >
            ✓ Accept
          </button>
          <button
            type="button"
            onClick={() => {
              setDecided('rejected')
              onReject(field.fieldPath)
            }}
            style={{
              padding: '4px 12px',
              borderRadius: '6px',
              border: `1px solid ${COLORS.border}`,
              background: 'transparent',
              color: COLORS.textMuted,
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            ✗ Reject
          </button>
        </div>
      ) : (
        <span
          style={{
            fontSize: '12px',
            color: decided === 'accepted' ? COLORS.green : COLORS.textMuted,
          }}
        >
          {decided === 'accepted' ? '✓ Accepted' : '✗ Rejected'}
        </span>
      )}
    </div>
  )
}

/** @param {object} state */
function clonePilotState(state) {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(state)
    } catch {
      /* fall through */
    }
  }
  return JSON.parse(JSON.stringify(state))
}

/**
 * @param {{ result: object, onApply: (state: object) => void, onDismiss: () => void }} props
 */
export function RebuildReviewPanel({ result, onApply, onDismiss }) {
  const [conflictResolutions, setConflictResolutions] = useState({})
  const [acceptedSuggestions, setAcceptedSuggestions] = useState({})

  const [activeTab, setActiveTab] = useState(() =>
    result.conflicts?.length > 0 ? 'conflicts' : 'suggestions',
  )

  const handleConflictResolve = (fieldPath, value, evidence) => {
    setConflictResolutions((prev) => ({ ...prev, [fieldPath]: { value, evidence } }))
  }

  const handleSuggestionAccept = (fieldPath, value) => {
    setAcceptedSuggestions((prev) => ({ ...prev, [fieldPath]: value }))
  }

  const handleSuggestionReject = (fieldPath) => {
    setAcceptedSuggestions((prev) => {
      const next = { ...prev }
      delete next[fieldPath]
      return next
    })
  }

  const unresolvedConflicts = useMemo(
    () => (result.conflicts ?? []).filter((f) => !conflictResolutions[f.fieldPath]),
    [result.conflicts, conflictResolutions],
  )

  const handleApply = () => {
    let finalState = clonePilotState(result.mergedState)

    for (const [fieldPath, resolution] of Object.entries(conflictResolutions)) {
      setAtPath(finalState, fieldPath, resolution.value)
    }

    for (const [fieldPath, value] of Object.entries(acceptedSuggestions)) {
      setAtPath(finalState, fieldPath, value)
    }

    onApply(finalState)
  }

  const tabs = [
    { id: 'conflicts', label: `Conflicts (${result.conflicts?.length ?? 0})`, color: COLORS.amber },
    { id: 'suggestions', label: `Suggestions (${result.suggestions?.length ?? 0})`, color: COLORS.orange },
  ].filter((t) => {
    if (t.id === 'conflicts') return (result.conflicts?.length ?? 0) > 0
    if (t.id === 'suggestions') return (result.suggestions?.length ?? 0) > 0
    return false
  })

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: '10px',
        overflow: 'hidden',
        fontFamily: COLORS.fontSans,
        color: COLORS.textPrimary,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              fontSize: '16px',
              fontWeight: 700,
              fontFamily: COLORS.fontSans,
              color: COLORS.teal,
            }}
          >
            🔄 Reverse Paper Shredder
          </span>
          <span style={{ color: COLORS.textMuted, fontSize: '13px' }}>Review reconstruction</span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          style={{
            background: 'none',
            border: 'none',
            color: COLORS.textMuted,
            cursor: 'pointer',
            fontSize: '18px',
            lineHeight: 1,
            padding: '2px 6px',
          }}
          aria-label="Close"
        >
          ×
        </button>
      </div>

      <SummaryBar result={result} />

      {tabs.length > 0 ? (
        <div
          style={{
            display: 'flex',
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surface,
          }}
        >
          {tabs.map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? 700 : 400,
                color: activeTab === tab.id ? tab.color : COLORS.textMuted,
                borderBottom:
                  activeTab === tab.id ? `2px solid ${tab.color}` : '2px solid transparent',
                transition: 'color 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      ) : null}

      <div style={{ overflowY: 'auto', flex: 1 }}>
        {tabs.length === 0 ? (
          <div
            style={{
              padding: '32px',
              textAlign: 'center',
              color: COLORS.textMuted,
              fontSize: '14px',
            }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>✓</div>
            No conflicts or suggestions — reconstruction applied cleanly.
          </div>
        ) : null}

        {activeTab === 'conflicts'
          ? result.conflicts?.map((field, i) => (
              <ConflictRow key={`${field.fieldPath}-${i}`} field={field} onResolve={handleConflictResolve} />
            ))
          : null}

        {activeTab === 'suggestions'
          ? result.suggestions?.map((field, i) => (
              <SuggestionRow
                key={`${field.fieldPath}-${i}`}
                field={field}
                onAccept={handleSuggestionAccept}
                onReject={handleSuggestionReject}
              />
            ))
          : null}
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: `1px solid ${COLORS.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: COLORS.surface,
        }}
      >
        <div style={{ fontSize: '12px', color: COLORS.textMuted }}>
          {unresolvedConflicts.length > 0
            ? `${unresolvedConflicts.length} conflict${unresolvedConflicts.length !== 1 ? 's' : ''} still need resolution`
            : Object.keys(conflictResolutions).length > 0
              ? 'All conflicts resolved'
              : ''}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={onDismiss}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: `1px solid ${COLORS.border}`,
              background: 'transparent',
              color: COLORS.textMuted,
              cursor: 'pointer',
              fontSize: '13px',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              background: COLORS.teal,
              color: '#000',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
            }}
          >
            Apply to wizard →
          </button>
        </div>
      </div>
    </div>
  )
}

/** @param {object} obj @param {string} path @param {unknown} value */
function setAtPath(obj, path, value) {
  const parts = path.split('.')
  let current = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {}
    }
    current = current[key]
  }
  current[parts[parts.length - 1]] = value
}
