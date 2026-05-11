/**
 * MantaMissionCapabilityStrip — mission **breadcrumb + validation mode** row when shown.
 * Wizard step pills live in the app header ({@link MissionWizardStepPills} → #pilot-header-steps-slot).
 */

import { useWorkbenchChrome } from '../shell/useWorkbenchChrome.js'

export default function MantaMissionCapabilityStrip({
  validationMode,
  onSetMode,
  errCount = 0,
  score = 0,
  /** Breadcrumb nav merged into the strip: { label, onHome, onNewRecord } — New record omitted in chrome */
  breadcrumb,
}) {
  const { assistantLayout } = useWorkbenchChrome()
  const hideDupValidationRow = assistantLayout === 'split-float'

  const showBreadcrumb = Boolean(breadcrumb)
  const showScoreRow = !hideDupValidationRow

  if (!showBreadcrumb && !showScoreRow) {
    return null
  }

  const modeColor = {
    lenient: { bg: '#dcfce7', text: '#14532d', border: '#16a34a44' },
    strict:  { bg: '#dbeafe', text: '#1e3a8a', border: '#3b82f644' },
    catalog: { bg: '#f3e8ff', text: '#581c87', border: '#9333ea44' },
  }

  return (
    <div
      className="pilot-mission-capability-strip"
      style={{
      background: 'var(--card-bg, #fff)',
      borderBottom: '1px solid var(--border-color)',
      padding: breadcrumb ? '0.3rem 0.85rem 0.45rem' : '0.45rem 0.85rem',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}
    >
      {/* Breadcrumb nav row — merged from the standalone bar */}
      {breadcrumb && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          marginBottom: 2,
          paddingBottom: '0.3rem',
          borderBottom: '1px solid color-mix(in srgb, var(--border-color, #e2e8f0) 55%, transparent)',
          fontSize: '0.78rem',
        }}>
          <button
            type="button"
            onClick={breadcrumb.onHome}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', padding: '0 2px', fontSize: '0.78rem' }}
            aria-label="Back to home"
          >
            ← Home
          </button>
          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>·</span>
          <span style={{ color: 'var(--text-color)', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {breadcrumb.label}
          </span>
        </div>
      )}

      {/* Score + validation mode — gap check / CoMET / exports live in header XmlToolsBar */}
      {showScoreRow ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
            <span style={{
              fontSize: '0.68rem', fontWeight: 800,
              background: errCount === 0 ? '#dcfce7' : '#fee2e2',
              color: errCount === 0 ? '#14532d' : '#7f1d1d',
              border: `1px solid ${errCount === 0 ? '#16a34a44' : '#dc262644'}`,
              padding: '2px 8px', borderRadius: 9999,
            }}>
              {errCount === 0 ? `✓ ${Math.round(score)}%` : `✗ ${errCount} err · ${Math.round(score)}%`}
            </span>
            {['lenient', 'strict', 'catalog'].map((m) => {
              const c = modeColor[m]
              const active = validationMode === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => onSetMode?.(m)}
                  style={{
                    fontSize: '0.67rem', fontWeight: active ? 800 : 600,
                    padding: '2px 8px',
                    background: active ? c.bg : 'transparent',
                    color: active ? c.text : 'var(--text-muted)',
                    border: `1px solid ${active ? c.border : 'transparent'}`,
                    borderRadius: 9999,
                    cursor: 'pointer',
                    textTransform: 'capitalize',
                  }}
                >
                  {m}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}

    </div>
  )
}
