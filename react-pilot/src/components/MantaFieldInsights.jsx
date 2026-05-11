/**
 * MantaFieldInsights — collapsible field suggestions panel.
 *
 * Shows inline below a field group when issues or suggestions exist.
 * Surfaces: what's missing, GCMD suggestions, platform hints, date checks.
 *
 * Fires manta:set-pilot-field to apply quick suggestions directly.
 *
 * Usage (inside a step component):
 *   <MantaFieldInsights
 *     issues={issues}
 *     pilotState={pilotState}
 *     activeStep="mission"
 *     onApply={(field, value) => onMissionPatch({ [field]: value })}
 *   />
 */

import { useState, memo } from 'react'

// ── Suggestion builders ───────────────────────────────────────────────────────

function buildSuggestions(issues, pilotState, activeStep) {
  const sugg = []
  const mission = pilotState?.mission ?? {}
  const stepIssues = issues.filter((i) =>
    String(i.field || '').startsWith(activeStep === 'mission' ? 'mission.' : activeStep),
  )

  // Abstract length
  if (activeStep === 'mission') {
    const abs = mission.abstract || ''
    if (abs.length > 0 && abs.length < 100) {
      sugg.push({
        id: 'abstract-short',
        icon: '✏',
        label: 'Expand abstract',
        detail: `Abstract is ${abs.length} chars. Include platform type, instruments, survey area, dates, and data products (aim for 150+).`,
        field: null,
        value: null,
        severity: 'warn',
      })
    }

    // Temporal extent
    if (!mission.startDate) {
      sugg.push({
        id: 'no-start-date',
        icon: '📅',
        label: 'Add temporal extent',
        detail: 'Start and end dates are missing. Required for ISO compliance and catalog discovery.',
        field: null,
        value: null,
        severity: 'warn',
      })
    }

    // Bounding box
    const sp = pilotState?.spatial ?? {}
    const hasBox = sp.westLon !== undefined && sp.westLon !== '' && sp.westLon !== -180 || false
    if (!hasBox) {
      sugg.push({
        id: 'no-bbox',
        icon: '🗺',
        label: 'Add spatial extent',
        detail: 'Bounding box is missing or set to global defaults. Add the actual survey area.',
        field: null,
        value: null,
        severity: 'warn',
      })
    }

    // GCMD keywords
    const kw = pilotState?.keywords ?? {}
    const hasGcmd = Array.isArray(kw.scienceKeywords) && kw.scienceKeywords.length > 0
    if (!hasGcmd) {
      sugg.push({
        id: 'no-gcmd',
        icon: '🔑',
        label: 'Add GCMD Keywords',
        detail: 'No science keywords detected. Required for OneStop and NOAA catalog discovery.',
        field: null,
        value: null,
        severity: 'error',
      })
    }

    // Platform
    const plat = pilotState?.platform ?? {}
    if (!plat.platformType || !plat.platformId) {
      sugg.push({
        id: 'no-platform',
        icon: '🤖',
        label: 'Add platform',
        detail: 'Platform type or identifier is missing. Required for UxS/PED records.',
        field: null,
        value: null,
        severity: 'warn',
      })
    }
  }

  // Issues-driven suggestions
  for (const iss of stepIssues.slice(0, 4)) {
    if (sugg.find((s) => s.id === iss.field)) continue
    sugg.push({
      id: iss.field,
      icon: iss.severity === 'e' ? '✗' : '⚠',
      label: iss.message,
      detail: `Field: ${iss.field}`,
      field: null,
      value: null,
      severity: iss.severity === 'e' ? 'error' : 'warn',
    })
  }

  return sugg.slice(0, 6)
}

// ── Automation definitions ────────────────────────────────────────────────────

const AUTOMATIONS = [
  { id: 'auto-keyword', label: 'Auto keyword suggest', detail: 'Watching text…', defaultOn: true },
  { id: 'auto-date',    label: 'Auto date normalize',  detail: 'MM/DD/YYYY',     defaultOn: true },
  { id: 'auto-iso',     label: 'Auto ISO mapping',     detail: 'gmd:CI_DateTypeCode', defaultOn: true },
]

// ── Main component ────────────────────────────────────────────────────────────

function MantaFieldInsights({ issues = [], pilotState = {}, activeStep = 'mission', onApply }) {
  const [open, setOpen] = useState(false)
  const [automations, setAutomations] = useState(() =>
    Object.fromEntries(AUTOMATIONS.map((a) => [a.id, a.defaultOn])),
  )

  const suggestions = buildSuggestions(issues, pilotState, activeStep)
  const errCount   = suggestions.filter((s) => s.severity === 'error').length
  const warnCount  = suggestions.filter((s) => s.severity === 'warn').length
  const autoActive = Object.values(automations).filter(Boolean).length

  function toggleAuto(id) {
    setAutomations((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const triggerColor = errCount > 0 ? '#dc2626' : warnCount > 0 ? '#ca8a04' : 'var(--primary-color)'

  return (
    <div style={{
      margin: '0.5rem 0 0.75rem',
      border: `1px solid ${open ? triggerColor + '44' : 'var(--border-color)'}`,
      borderRadius: 8,
      background: 'var(--card-bg, #fff)',
      transition: 'border-color 0.15s',
      overflow: 'hidden',
    }}>
      {/* trigger bar */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0.45rem 0.75rem',
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        aria-expanded={open}
      >
        <span style={{ fontSize: '0.8rem' }}>☆</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, flex: 1, color: 'var(--text-color)' }}>
          Field Insights
        </span>
        {suggestions.length > 0 && (
          <span style={{
            fontSize: '0.67rem', fontWeight: 800,
            background: errCount > 0 ? '#fee2e2' : '#fefce8',
            color: errCount > 0 ? '#7f1d1d' : '#713f12',
            border: `1px solid ${errCount > 0 ? '#dc262633' : '#ca8a0433'}`,
            padding: '1px 7px', borderRadius: 9999,
          }}>
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        )}
        <span style={{
          fontSize: '0.67rem', fontWeight: 700,
          background: '#dbeafe', color: '#1e3a8a',
          border: '1px solid #3b82f633',
          padding: '1px 7px', borderRadius: 9999,
        }}>
          {autoActive} active
        </span>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▼</span>
      </button>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          {/* Suggestions */}
          {suggestions.length > 0 && (
            <div style={{ padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 2 }}>
                Suggestions · {suggestions.length}
              </div>
              {suggestions.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '0.4rem 0.6rem',
                  background: s.severity === 'error' ? '#fee2e211' : s.severity === 'warn' ? '#fefce811' : 'var(--card-bg)',
                  border: `1px solid ${s.severity === 'error' ? '#dc262622' : s.severity === 'warn' ? '#ca8a0422' : 'var(--border-color)'}`,
                  borderRadius: 6,
                }}>
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 1 }}>{s.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '0.76rem', fontWeight: 700,
                      color: s.severity === 'error' ? '#dc2626' : s.severity === 'warn' ? '#ca8a04' : 'var(--text-color)',
                    }}>{s.label}</div>
                    <div style={{ fontSize: '0.71rem', color: 'var(--text-muted)', marginTop: 2, lineHeight: 1.4 }}>{s.detail}</div>
                  </div>
                  {s.field && s.value != null && (
                    <button
                      type="button"
                      onClick={() => {
                        // Fire manta:set-pilot-field so WizardShell applies it directly to pilotState.
                        window.dispatchEvent(new CustomEvent('manta:set-pilot-field', {
                          detail: { field: s.field, value: s.value },
                        }))
                        if (typeof onApply === 'function') onApply(s.field, s.value)
                      }}
                      style={{
                        fontSize: '0.68rem', fontWeight: 700, flexShrink: 0,
                        padding: '2px 9px',
                        background: 'var(--primary-color, #006994)', color: '#fff',
                        border: 'none', borderRadius: 4, cursor: 'pointer',
                      }}
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Automations */}
          <div style={{
            padding: '0.55rem 0.75rem',
            borderTop: suggestions.length > 0 ? '1px solid var(--border-color)' : 'none',
            background: 'var(--intake-drop-idle-bg, rgba(248,250,252,0.9))',
          }}>
            <div style={{ fontSize: '0.67rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: 6 }}>
              Automations · {autoActive} active
            </div>
            {AUTOMATIONS.map((auto) => (
              <div key={auto.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '3px 0', gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-color)' }}>{auto.label}</span>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginLeft: 6 }}>{auto.detail}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={automations[auto.id]}
                  onClick={() => toggleAuto(auto.id)}
                  style={{
                    width: 36, height: 20, flexShrink: 0,
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: automations[auto.id] ? 'var(--primary-color, #006994)' : '#cbd5e1',
                    position: 'relative', transition: 'background 0.2s',
                    padding: 0,
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: automations[auto.id] ? 18 : 2,
                    width: 16, height: 16, borderRadius: '50%',
                    background: '#fff',
                    transition: 'left 0.2s',
                    display: 'block',
                  }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(MantaFieldInsights)
