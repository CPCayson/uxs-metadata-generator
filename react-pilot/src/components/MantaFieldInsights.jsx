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
import './MantaFieldInsights.css'

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

  const tone = errCount > 0 ? 'err' : warnCount > 0 ? 'warn' : 'ok'

  function toggleAuto(id) {
    setAutomations((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <div
      className={`manta-field-insights${open ? ' manta-field-insights--open' : ''}`}
      data-tone={tone}
    >
      <button
        type="button"
        className="manta-field-insights__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={{ fontSize: '0.8rem' }} aria-hidden>☆</span>
        <span className="manta-field-insights__title">Field Insights</span>
        {suggestions.length > 0 && (
          <span
            className={`manta-field-insights__pill ${errCount > 0 ? 'manta-field-insights__pill--sugg-err' : 'manta-field-insights__pill--sugg-warn'}`}
          >
            {suggestions.length} suggestion{suggestions.length !== 1 ? 's' : ''}
          </span>
        )}
        <span className="manta-field-insights__pill manta-field-insights__pill--auto">
          {autoActive} active
        </span>
        <span
          className={`manta-field-insights__chevron${open ? ' manta-field-insights__chevron--open' : ''}`}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open && (
        <div className="manta-field-insights__panel">
          {suggestions.length > 0 && (
            <div className="manta-field-insights__suggestions">
              <div className="manta-field-insights__section-label">
                Suggestions · {suggestions.length}
              </div>
              {suggestions.map((s) => (
                <div
                  key={s.id}
                  className={`manta-field-insights__suggestion${
                    s.severity === 'error'
                      ? ' manta-field-insights__suggestion--error'
                      : s.severity === 'warn'
                        ? ' manta-field-insights__suggestion--warn'
                        : ''
                  }`}
                >
                  <span style={{ fontSize: '0.85rem', flexShrink: 0, marginTop: 2 }} aria-hidden>{s.icon}</span>
                  <div className="manta-field-insights__suggestion-main">
                    <div className="manta-field-insights__suggestion-title">{s.label}</div>
                    <div className="manta-field-insights__suggestion-detail">{s.detail}</div>
                  </div>
                  {s.field && s.value != null && (
                    <button
                      type="button"
                      className="manta-field-insights__apply"
                      onClick={() => {
                        window.dispatchEvent(new CustomEvent('manta:set-pilot-field', {
                          detail: { field: s.field, value: s.value },
                        }))
                        if (typeof onApply === 'function') onApply(s.field, s.value)
                      }}
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div
            className={`manta-field-insights__automations${suggestions.length === 0 ? ' manta-field-insights__automations--flush-top' : ''}`}
          >
            <div className="manta-field-insights__section-label">
              Automations · {autoActive} active
            </div>
            {AUTOMATIONS.map((auto) => (
              <div key={auto.id} className="manta-field-insights__auto-row">
                <div className="manta-field-insights__auto-text">
                  <span className="manta-field-insights__auto-label">{auto.label}</span>
                  <span className="manta-field-insights__auto-detail">{auto.detail}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={automations[auto.id]}
                  aria-label={`${auto.label}: ${automations[auto.id] ? 'on' : 'off'}`}
                  data-on={automations[auto.id] ? 'true' : 'false'}
                  className="manta-field-insights__switch"
                  onClick={() => toggleAuto(auto.id)}
                >
                  <span className="manta-field-insights__switch-knob" />
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
