/**
 * Split-float Manta Tools: bottom FAB with lens + ASK · SEARCH · LIVE · CoMET tabs;
 * active tab content renders in a sheet anchored above the bar.
 * When a tab with `id: 'lens'` is present, that tab is the only lens entry (no duplicate ⬡ button).
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
  qualityScore,
  /** When a standalone ⬡ LENS bar button is shown (no `lens` tab), reflects scanner on/off. */
  lensActive = false,
  onToggleLens,
  /** simple = calm wizard surface + Lens for detail; granular = full helper copy */
  workspaceDensity = 'simple',
  onWorkspaceDensityChange,
  tipFooter,
  children,
}) {
  const issueTotal = errorsCount + warningsCount
  const hasErrors = errorsCount > 0
  const hasWarnings = warningsCount > 0
  const hasLensTab = tabs.some((t) => t.id === 'lens')
  /** Extra lens button only when there is no dedicated LENS tab (avoids two identical entry points). */
  const showLensShortcutButton = typeof onToggleLens === 'function' && !hasLensTab

  const handleTab = (id) => {
    onTabChange(id)
    onSheetOpenChange(true)
  }

  return (
    <div className="manta-tools-fab-dock">
      {/* Keep mounted when hidden so ASK/SEARCH/LIVE/CoMET state is preserved */}
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
        <div className="manta-tools-fab-dock__bar-main">
          <span className="manta-tools-fab-dock__wing" aria-hidden="true" />
          <span className="manta-tools-fab-dock__brand">MANTA TOOLS</span>

          {typeof onWorkspaceDensityChange === 'function' ? (
            <div className="manta-tools-fab-dock__density" role="group" aria-label="Workspace detail level">
              <button
                type="button"
                className={`manta-tools-fab-dock__density-btn${workspaceDensity === 'simple' ? ' manta-tools-fab-dock__density-btn--active' : ''}`}
                aria-pressed={workspaceDensity === 'simple'}
                title="Less text on the wizard — open Lens for guidance and issues"
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
                className={`manta-tools-fab-dock__tab${activeTab === tab.id ? ' manta-tools-fab-dock__tab--active' : ''}`}
                onClick={() => handleTab(tab.id)}
              >
                {tab.label}
                {tab.dot ? (
                  <span className={`manta-tools-fab-dock__tab-dot manta-tools-fab-dock__tab-dot--${tab.dot}`} aria-hidden="true" />
                ) : null}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`manta-tools-fab-dock__panel-toggle${sheetOpen ? ' manta-tools-fab-dock__panel-toggle--open' : ''}`}
            onClick={() => onSheetOpenChange(!sheetOpen)}
            title={sheetOpen ? 'Hide tools panel' : 'Show tools panel'}
            aria-expanded={sheetOpen}
            aria-label={sheetOpen ? 'Hide tools panel' : 'Show tools panel'}
          >
            <span aria-hidden="true">{sheetOpen ? '▼' : '▲'}</span>
          </button>

          {showLensShortcutButton ? (
            <button
              type="button"
              className={`manta-tools-fab-dock__lens${lensActive ? ' manta-tools-fab-dock__lens--active' : ''}`}
              onClick={() => onToggleLens()}
              title={lensActive ? 'Close Manta Lens (Esc)' : 'Open Manta Lens — scanner over workspace'}
              aria-pressed={lensActive}
              aria-label={lensActive ? 'Close Manta Lens scanner' : 'Open Manta Lens scanner'}
            >
              ⬡ LENS
            </button>
          ) : null}
        </div>

        <div className="manta-tools-fab-dock__meta" aria-live="polite">
          <span className="manta-tools-fab-dock__meta-line">{workflowLine}</span>
          <span className="manta-tools-fab-dock__chip-row">
            <span className="manta-tools-fab-dock__chip manta-tools-fab-dock__chip--info">
              {liveFieldCount} field{liveFieldCount === 1 ? '' : 's'}
            </span>
            {issueTotal > 0 ? (
              <span
                className={[
                  'manta-tools-fab-dock__chip',
                  hasErrors
                    ? 'manta-tools-fab-dock__chip--err'
                    : hasWarnings
                      ? 'manta-tools-fab-dock__chip--warn'
                      : 'manta-tools-fab-dock__chip--ok',
                ].join(' ')}
              >
                {issueTotal} issue{issueTotal === 1 ? '' : 's'}
              </span>
            ) : typeof qualityScore === 'number' ? (
              <span className="manta-tools-fab-dock__chip manta-tools-fab-dock__chip--ok">
                {qualityScore} readiness
              </span>
            ) : (
              <span className="manta-tools-fab-dock__chip manta-tools-fab-dock__chip--idle">
                —
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  )
}
