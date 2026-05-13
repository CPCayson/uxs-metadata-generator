/**
 * Split-float Manta Tools: bottom FAB with ⬡ LENS + ASK · SEARCH · LIVE · CoMET tabs;
 * sheet anchors above the bar. Hero floater row matches lens HUD mockup (brand + switch + status + Expand).
 */

export default function MantaToolsFabDock({
  tabs,
  activeTab,
  onTabChange,
  sheetOpen,
  onSheetOpenChange,
  profile,
  workflowLine,
  liveFieldCount,
  errorsCount,
  warningsCount,
  /** Split-float: scanner session on — drives the floater switch. */
  lensFloaterOn = false,
  /** Split-float: toggle scanner (parent `lensMode`). */
  onLensFloaterToggle,
  /** simple = calm wizard surface + Lens for detail; granular = full helper copy */
  workspaceDensity = 'simple',
  onWorkspaceDensityChange,
  tipFooter,
  children,
}) {
  const issueTotal = errorsCount + warningsCount
  const hasErrors = errorsCount > 0

  const handleTab = (id) => {
    if (id === activeTab) {
      onSheetOpenChange(!sheetOpen)
      return
    }
    onTabChange(id)
    onSheetOpenChange(true)
  }

  return (
    <div className="manta-tools-fab-dock">
      <div
        className="manta-tools-fab-dock__sheet"
        role="region"
        aria-label="Manta assistant tools panel"
        hidden={!sheetOpen}
      >
        <div className="manta-tools-fab-dock__sheet-head">
          <span className="manta-tools-fab-dock__sheet-title">
            {tabs.find((t) => t.id === activeTab)?.label ?? 'Tools'}
            {profile?.label ? (
              <span className="manta-tools-fab-dock__sheet-profile" title={profile.label}>
                {' · '}
                {profile.label}
              </span>
            ) : null}
          </span>
          <button
            type="button"
            className="manta-tools-fab-dock__sheet-close"
            onClick={() => onSheetOpenChange(false)}
            aria-label="Close tools panel"
          >
            ×
          </button>
        </div>
        <div className="manta-tools-fab-dock__sheet-body">
          <div className="manta-widget__panel manta-tools-fab-dock__panel">{children}</div>
        </div>
        {tipFooter ? (
          <div className="manta-tools-fab-dock__sheet-tip">{tipFooter}</div>
        ) : null}
      </div>

      <div className="manta-tools-fab-dock__bar">
        <div className="manta-tools-fab-dock__floater-hero">
          <span className="manta-tools-fab-dock__floater-brand">MANTA LENS</span>

          {typeof onLensFloaterToggle === 'function' ? (
            <button
              type="button"
              className={`manta-tools-fab-dock__lens-switch${lensFloaterOn ? ' manta-tools-fab-dock__lens-switch--on' : ''}`}
              role="switch"
              aria-checked={lensFloaterOn}
              title={lensFloaterOn ? 'Scanner on — click to exit lens workspace' : 'Scanner off — click to open lens'}
              onClick={() => onLensFloaterToggle()}
            >
              <span className="manta-tools-fab-dock__lens-switch__track">
                <span className="manta-tools-fab-dock__lens-switch__label">{lensFloaterOn ? 'ON' : 'OFF'}</span>
                <span className="manta-tools-fab-dock__lens-switch__knob" aria-hidden="true" />
              </span>
            </button>
          ) : null}

          <div className="manta-tools-fab-dock__floater-status" role="status" aria-live="polite">
            <span className="manta-tools-fab-dock__floater-detect" title={workflowLine}>
              {workflowLine}
            </span>
            <div className="manta-tools-fab-dock__floater-metrics">
              <span className="manta-tools-fab-dock__floater-metric manta-tools-fab-dock__floater-metric--ok">
                <span className="manta-tools-fab-dock__floater-dot manta-tools-fab-dock__floater-dot--ok" aria-hidden="true" />
                {liveFieldCount} field{liveFieldCount === 1 ? '' : 's'} recognized
              </span>
              {issueTotal > 0 ? (
                <span
                  className={[
                    'manta-tools-fab-dock__floater-metric',
                    hasErrors
                      ? 'manta-tools-fab-dock__floater-metric--err'
                      : 'manta-tools-fab-dock__floater-metric--warn',
                  ].join(' ')}
                >
                  <span
                    className={`manta-tools-fab-dock__floater-dot${hasErrors ? ' manta-tools-fab-dock__floater-dot--err' : ' manta-tools-fab-dock__floater-dot--warn'}`}
                    aria-hidden="true"
                  />
                  {issueTotal} issue{issueTotal === 1 ? '' : 's'} found
                </span>
              ) : (
                <span className="manta-tools-fab-dock__floater-metric manta-tools-fab-dock__floater-metric--clear">
                  <span className="manta-tools-fab-dock__floater-dot manta-tools-fab-dock__floater-dot--ok" aria-hidden="true" />
                  No issues found
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            className="manta-tools-fab-dock__floater-expand"
            onClick={() => onSheetOpenChange(!sheetOpen)}
            aria-expanded={sheetOpen}
            title={sheetOpen ? 'Collapse tools panel' : 'Expand tools panel'}
          >
            <span className="manta-tools-fab-dock__floater-expand__label">{sheetOpen ? 'Collapse' : 'Expand'}</span>
            <span className="manta-tools-fab-dock__floater-expand__chev" aria-hidden="true">
              {sheetOpen ? '⌄' : '⌃'}
            </span>
          </button>
        </div>

        <div className="manta-tools-fab-dock__floater-rail">
          {typeof onWorkspaceDensityChange === 'function' ? (
            <div className="manta-tools-fab-dock__density" role="group" aria-label="Workspace detail level">
              <button
                type="button"
                className={`manta-tools-fab-dock__density-btn${workspaceDensity === 'simple' ? ' manta-tools-fab-dock__density-btn--active' : ''}`}
                aria-pressed={workspaceDensity === 'simple'}
                title="Less text on the wizard — use the ⬡ LENS tab for guidance and issues"
                onClick={() => onWorkspaceDensityChange('simple')}
              >
                Simple
              </button>
              <button
                type="button"
                className={`manta-tools-fab-dock__density-btn${workspaceDensity === 'granular' ? ' manta-tools-fab-dock__density-btn--active' : ''}`}
                aria-pressed={workspaceDensity === 'granular'}
                title="Show helper copy on the wizard surface"
                onClick={() => onWorkspaceDensityChange('granular')}
              >
                Granular
              </button>
            </div>
          ) : null}

          <div className="manta-tools-fab-dock__tabs" role="tablist" aria-label="Assistant tools">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-expanded={activeTab === tab.id ? sheetOpen : undefined}
                title={
                  activeTab === tab.id
                    ? sheetOpen
                      ? 'Hide tools panel (tap again, or use ×)'
                      : 'Show tools panel'
                    : `Open ${tab.label}`
                }
                className={[
                  'manta-tools-fab-dock__tab',
                  tab.id === 'lens' ? 'manta-tools-fab-dock__tab--lens' : '',
                  activeTab === tab.id ? 'manta-tools-fab-dock__tab--active' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => handleTab(tab.id)}
              >
                {tab.label}
                {tab.dot ? (
                  <span className={`manta-tools-fab-dock__tab-dot manta-tools-fab-dock__tab-dot--${tab.dot}`} aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
