/**
 * Lens scanner chrome shared by fullscreen overlay and split-float FAB sheet.
 * @module components/LensScannerWorkspacePanel
 */

import { getCoachingPrompts } from '../lib/lensFixGuide.js'
import { getLensChipsForIssue } from '../lib/lensIssueChips.js'
import { getFieldDefinition } from '../shell/metadataKnowledgeBase.js'

function scoreColor(score) {
  if (score >= 80) return '#22d3ee'
  if (score >= 50) return '#fbbf24'
  return '#f87171'
}

function ScoreRing({ score, size = 76, sw = 6 }) {
  const color = scoreColor(score)
  const r = (size - sw * 2) / 2
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  return (
    <div className="manta-score-ring-wrap" style={{ width: size, height: size, position: 'relative', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circ}`}
          style={{ transition: 'stroke-dasharray 0.9s cubic-bezier(0.4,0,0.2,1), stroke 0.5s ease', filter: `drop-shadow(0 0 7px ${color}99)` }}
        />
      </svg>
      <div className="manta-score-ring-label">
        <span className="manta-score-ring-num" style={{ color, textShadow: `0 0 16px ${color}88` }}>{score}</span>
        <span className="manta-score-ring-denom">/100</span>
      </div>
    </div>
  )
}

/** Shared with {@link LensSectionNavigator} for split-float left rail. */
export function SectionBar({ label, pct, errors, warnings, onClick, active }) {
  const color = errors > 0 ? '#f87171' : warnings > 0 ? '#fbbf24' : '#22d3ee'
  const fill =
    pct === 100 ? 'linear-gradient(90deg,#22d3ee,#34d399)' : `linear-gradient(90deg,${color}88,${color})`
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`manta-section-bar${active ? ' manta-section-bar--active' : ''}${onClick ? ' manta-section-bar--clickable' : ''}`}
      onClick={onClick}
      title={onClick ? 'Section scope' : undefined}
    >
      <span className="manta-section-bar__label">{label}</span>
      <div className="manta-section-bar__track">
        <div className="manta-section-bar__fill" style={{ width: `${pct}%`, background: fill, boxShadow: `0 0 8px ${color}55` }} />
      </div>
      <span className="manta-section-bar__stat" style={{ color }}>
        {errors > 0 ? `${errors}✗` : warnings > 0 ? `${warnings}⚠` : '✓'}
      </span>
    </Tag>
  )
}

/**
 * @param {{
 *   embeddedInFab: boolean,
 *   profile: { label?: string } | null,
 *   qualityResult: { score: number } | null,
 *   errors: Array<{ severity: string, field?: string, message: string }>,
 *   warnings: Array<{ severity: string, field?: string, message: string }>,
 *   hasErrors: boolean,
 *   hasWarnings: boolean,
 *   lensIssuesScoped: unknown[],
 *   lensIssuesFiltered: unknown[],
 *   lensIssueScope: string,
 *   setLensIssueScope: (s: string) => void,
 *   lensIssueFilter: string,
 *   setLensIssueFilter: (f: string) => void,
 *   wizardActiveStepId: string | null,
 *   lensHlField: string | null,
 *   setLensHlField: (v: string | null | ((p: string | null) => string | null)) => void,
 *   lensHudExpanded: boolean,
 *   setLensHudExpanded: (v: boolean | ((b: boolean) => boolean)) => void,
 *   onOpenMantaAssistant?: () => void,
 *   onOpenEditor?: () => void,
 *   setLensCollapsed: (v: boolean) => void,
 *   fixWalkFieldCount: number,
 *   lensFixGuide: null | { queue: unknown[], index: number },
 *   startOrStopFixGuide: () => void,
 *   lensChipPilot: object,
 *   onLensQuickChip: (chip: object, issue: object) => void,
 *   stepFixGuide: (d: number) => void,
 *   sectionBars: Array<{ id: string, label: string, pct: number, errors: number, warnings: number }>,
 *   lensSearchInputRef: import('react').RefObject<HTMLInputElement | null>,
 *   lensHelpOpen: boolean,
 *   setLensHelpOpen: (v: boolean | ((b: boolean) => boolean)) => void,
 *   runQualityCheck: (mode: string) => void,
 *   qualityMode: string,
 *   qualityLoading: boolean,
 *   onToggleLens: () => void,
 *   onFabExit?: () => void,
 *   onFabAskTools?: () => void,
 *   lensAsk: null | { issue: { field?: string }, answer: string },
 *   setLensAsk: (v: unknown) => void,
 *   activeDefIssue: null | { field: string, message: string },
 *   setActiveDefIssue: (v: unknown) => void,
 *   hideSectionBars?: boolean,
 * }} props
 */
export default function LensScannerWorkspacePanel({
  embeddedInFab,
  hideSectionBars = false,
  profile = null,
  qualityResult,
  errors,
  warnings,
  hasErrors,
  hasWarnings,
  lensIssuesScoped,
  lensIssuesFiltered,
  lensIssueScope,
  setLensIssueScope,
  lensIssueFilter,
  setLensIssueFilter,
  wizardActiveStepId,
  lensHlField,
  setLensHlField,
  lensHudExpanded,
  setLensHudExpanded,
  onOpenMantaAssistant,
  onOpenEditor,
  setLensCollapsed,
  fixWalkFieldCount,
  lensFixGuide,
  startOrStopFixGuide,
  lensChipPilot,
  onLensQuickChip,
  stepFixGuide,
  sectionBars,
  lensHelpOpen,
  setLensHelpOpen,
  runQualityCheck,
  qualityMode,
  qualityLoading,
  onToggleLens,
  onFabExit,
  onFabAskTools,
  lensAsk,
  setLensAsk,
  activeDefIssue,
  setActiveDefIssue,
}) {
  const defText = activeDefIssue ? getFieldDefinition(activeDefIssue.field) : null
  const onExit = embeddedInFab ? onFabExit ?? onToggleLens : onToggleLens
  /** Split-float FAB: scores & counts live on the dock tab dot + left Validation rail */
  const slimFabChrome = Boolean(embeddedInFab)

  const askToolsClick = () => {
    if (embeddedInFab && typeof onFabAskTools === 'function') {
      onFabAskTools()
      return
    }
    if (typeof onOpenMantaAssistant === 'function') onOpenMantaAssistant()
  }

  return (
    <div className={embeddedInFab ? 'manta-lens-fab-panel__inner' : undefined}>
      <div className="manta-lens-top-chrome">
        <header className="manta-lens-bar">
          <span className="manta-lens-bar__brand">⬡ MANTA LENS</span>

          {!slimFabChrome && qualityResult && <ScoreRing score={qualityResult.score} size={30} sw={3} />}

          {!slimFabChrome ? (
          <div className="manta-lens-bar__tags">
            {hasErrors && <span className="manta-lens-tag manta-lens-tag--err">{errors.length}✗</span>}
            {hasWarnings && <span className="manta-lens-tag manta-lens-tag--warn">{warnings.length}⚠</span>}
            {!hasErrors && !hasWarnings && qualityResult && <span className="manta-lens-tag manta-lens-tag--ok">✓</span>}
          </div>
          ) : null}

          <div className="manta-lens-bar__val-wrap" role="group" aria-label="Which issues show as inline hints on fields">
            <span className="manta-lens-bar__val-label" title="Filters apply to glass strips next to inputs">
              Inline
            </span>
            {(errors.length > 0 || warnings.length > 0) && (
              <span className="manta-lens-bar__issue-meta" aria-live="polite">
                {lensIssuesScoped.length}
                {lensIssueScope === 'active' && wizardActiveStepId && lensIssuesScoped.length < lensIssuesFiltered.length
                  ? ` / ${lensIssuesFiltered.length}`
                  : lensIssueFilter !== 'all'
                    ? ` · ${errors.length + warnings.length} total`
                    : ''}
              </span>
            )}
            <div className="manta-lens-bar__filters-inline" role="group" aria-label="Issue list scope">
              {[
                { id: 'active', label: 'STEP' },
                { id: 'all', label: 'ALL' },
              ].map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`manta-lens-filter-chip${lensIssueScope === s.id ? ' manta-lens-filter-chip--active' : ''}`}
                  onClick={() => setLensIssueScope(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="manta-lens-bar__filters-inline" role="group" aria-label="Filter issues by severity">
              {[
                { id: 'all', label: 'ALL' },
                { id: 'errors', label: 'ERR' },
                { id: 'warnings', label: 'WRN' },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`manta-lens-filter-chip${lensIssueFilter === f.id ? ' manta-lens-filter-chip--active' : ''}`}
                  onClick={() => setLensIssueFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            {!(slimFabChrome && hideSectionBars) ? (
            <button
              type="button"
              className={`manta-lens-bar__hud-toggle${lensHudExpanded ? ' manta-lens-bar__hud-toggle--active' : ''}`}
              aria-pressed={lensHudExpanded}
              onClick={() => setLensHudExpanded((v) => !v)}
              title={
                lensHudExpanded
                  ? 'Hide the section overview row (mode controls stay in the side panel)'
                  : 'Show section overview — jump by wizard step'
              }
            >
              {lensHudExpanded ? 'Less' : 'More'}
            </button>
            ) : null}
          </div>

          <div className="manta-lens-bar__right">
            {!embeddedInFab && typeof onOpenMantaAssistant === 'function' && (
              <button
                type="button"
                className="manta-lens-bar__assistant"
                onClick={askToolsClick}
                title="Open full Manta panel — ASK, SEARCH, LIVE XML preview, CoMET (exits scanner)"
              >
                Ask & tools
              </button>
            )}
            {!embeddedInFab && (
              <button
                type="button"
                className="manta-widget__fix-btn manta-lens-bar__fix-issues"
                onClick={onOpenEditor}
                title="Open validation panel — full issue list and actions"
              >
                Fix Issues →
              </button>
            )}
            {!embeddedInFab && (
              <button
                type="button"
                className="manta-lens-bar__collapse"
                onClick={() => setLensCollapsed(true)}
                title="Collapse into glass manta tab"
              >
                Collapse
              </button>
            )}
            <button
              type="button"
              className="manta-lens-bar__fixwalk"
              disabled={fixWalkFieldCount === 0}
              aria-pressed={Boolean(lensFixGuide)}
              onClick={startOrStopFixGuide}
              title={
                lensFixGuide
                  ? 'Exit guided fix walk (Esc)'
                  : 'Guided walk: jump to each field, coaching, quick chips, wizard step sync (j/k n/p; respects STEP / severity filters)'
              }
            >
              {lensFixGuide ? 'Exit walk' : 'Fix walk'}
            </button>
            <button
              type="button"
              className="manta-lens-bar__help"
              aria-pressed={lensHelpOpen}
              onClick={() => setLensHelpOpen((v) => !v)}
              title="Keyboard shortcuts"
            >
              ?
            </button>
            <button
              type="button"
              className="manta-lens-bar__refresh"
              onClick={() => runQualityCheck(qualityMode)}
              disabled={qualityLoading}
              title="Re-run validation"
            >
              {qualityLoading ? '…' : '↻'}
            </button>
            <button type="button" className="manta-lens-bar__exit" onClick={onExit}>
              {embeddedInFab ? 'Close' : '⬡ EXIT'}
            </button>
          </div>
        </header>

        {lensFixGuide && lensFixGuide.queue.length > 0 && (() => {
          const fwIssue = lensFixGuide.queue[lensFixGuide.index]
          const atLast = lensFixGuide.index >= lensFixGuide.queue.length - 1
          const coaching = getCoachingPrompts(fwIssue)
          const walkChips = getLensChipsForIssue(fwIssue, lensChipPilot)
          return (
            <div className="manta-lens-fixguide" role="region" aria-label="Guided fix walk">
              <div className="manta-lens-fixguide__head">
                <span className="manta-lens-fixguide__title">Fix walk</span>
                <span className="manta-lens-fixguide__step">
                  {lensFixGuide.index + 1}
                  {' / '}
                  {lensFixGuide.queue.length}
                </span>
                {fwIssue.field ? <code className="manta-lens-fixguide__path">{fwIssue.field}</code> : null}
                <span
                  className={
                    fwIssue.severity === 'e'
                      ? 'manta-lens-fixguide__sev manta-lens-fixguide__sev--e'
                      : 'manta-lens-fixguide__sev manta-lens-fixguide__sev--w'
                  }
                >
                  {fwIssue.severity === 'e' ? 'Error' : 'Warning'}
                </span>
              </div>
              <ul className="manta-lens-fixguide__prompts">
                {coaching.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
              {walkChips.length > 0 && (
                <div className="manta-lens-fixguide__chips" role="group" aria-label="Quick actions for this field">
                  {walkChips.map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      className={`manta-lens-chip manta-lens-chip--${chip.kind}${chip.secondary ? ' manta-lens-chip--secondary' : ''}`}
                      onClick={() => onLensQuickChip(chip, fwIssue)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              )}
              <div className="manta-lens-fixguide__row">
                <div className="manta-lens-fixguide__kbd">
                  <kbd>j</kbd>
                  <kbd>k</kbd>
                  {' '}
                  next / back ·
                  {' '}
                  <kbd>n</kbd>
                  <kbd>p</kbd>
                  {' '}
                  next / back ·
                  {' '}
                  <kbd>Esc</kbd>
                  {' '}
                  exit walk
                </div>
                <div className="manta-lens-fixguide__actions">
                  <button
                    type="button"
                    className="manta-lens-fixguide__btn"
                    disabled={lensFixGuide.index === 0}
                    onClick={() => {
                      stepFixGuide(-1)
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="manta-lens-fixguide__btn manta-lens-fixguide__btn--primary"
                    onClick={() => {
                      stepFixGuide(1)
                    }}
                  >
                    {atLast ? 'Finish' : 'Next →'}
                  </button>
                </div>
              </div>
            </div>
          )
        })()}
      </div>

      {!hideSectionBars && lensHudExpanded && sectionBars.length > 0 && (
        <div className="manta-lens-section-bars">
          {sectionBars.map((sec) => (
            <SectionBar
              key={sec.id}
              label={sec.label}
              pct={sec.pct}
              errors={sec.errors}
              warnings={sec.warnings}
              active={lensHlField === sec.id}
              onClick={() => {
                setLensHlField((prev) => (prev === sec.id ? null : sec.id))
                try {
                  window.dispatchEvent(new CustomEvent('manta:goto-step', { detail: { stepId: sec.id } }))
                } catch {
                  /* */
                }
              }}
            />
          ))}
        </div>
      )}

      {(lensHlField || lensHelpOpen) && (
        <div className="manta-lens-glass manta-lens-glass--form">
          {lensHlField && (
            <div className="manta-lens-glass__hl-label" aria-live="polite">
              <span className="manta-lens-glass__hl-dot" aria-hidden="true" />
              {`field: ${lensHlField}`}
              <button
                type="button"
                className="manta-lens-bar__clear-hl"
                onClick={() => setLensHlField(null)}
                title="Clear field highlight"
              >
                ✕
              </button>
            </div>
          )}
          {lensHelpOpen && (
            <div className="manta-lens-glass__kbd-hint">
              {lensFixGuide ? (
                <>
                  <kbd>Esc</kbd> end fix walk · <kbd>j</kbd><kbd>k</kbd> or <kbd>n</kbd><kbd>p</kbd> next / back
                </>
              ) : (
                <>
                  <kbd>Esc</kbd> exit · <kbd>j</kbd><kbd>k</kbd> jump issues · Fix walk: guided fields with chips
                </>
              )}
            </div>
          )}
        </div>
      )}

      {(lensAsk || (activeDefIssue && defText)) && (
        <div className="manta-lens-floating-stack" aria-live="polite">
          {lensAsk && (
            <div className="manta-lens-ask-answer">
              <div className="manta-lens-ask-answer__label">
                <span>ℹ</span>
                <code>{lensAsk.issue.field?.split('.').pop() ?? ''}</code>
                <button type="button" className="manta-lens-ask-answer__close" onClick={() => setLensAsk(null)}>
                  ✕
                </button>
              </div>
              <p className="manta-lens-ask-answer__text">{lensAsk.answer}</p>
            </div>
          )}
          {activeDefIssue && defText && (
            <div className="manta-def-panel">
              <div className="manta-def-panel__header">
                <span className="manta-def-panel__label">DEF</span>
                <code className="manta-def-panel__field">{activeDefIssue.field}</code>
                <button type="button" className="manta-def-panel__close" onClick={() => setActiveDefIssue(null)}>
                  ✕
                </button>
              </div>
              <p className="manta-def-panel__text">{defText}</p>
            </div>
          )}
        </div>
      )}

      {embeddedInFab && profile?.label ? (
        <p className="manta-lens-fab-panel__profile-hint" title={profile.label}>
          Profile · {profile.label}
        </p>
      ) : null}
    </div>
  )
}
