import { useEffect, useMemo, useRef, useState } from 'react'
import { earthdataSearchUrlForGcmdKeyword, gcmdConceptUrlFromUuid } from '../lib/gcmdKmsUrl.js'
import PreviewVerificationTierStrip from './PreviewVerificationTierStrip.jsx'

const KEYWORD_UUID_FIELD_RE = /^keywords\.(\w+)\[(\d+)\]\.uuid$/

/**
 * @param {string} field
 * @param {object | undefined} pilotState
 * @returns {{ conceptUrl: string, searchUrl: string } | null}
 */
function keywordUuidIssueLinks(field, pilotState) {
  if (!pilotState?.keywords || typeof field !== 'string') return null
  const m = field.match(KEYWORD_UUID_FIELD_RE)
  if (!m) return null
  const facet = m[1]
  const idx = Number(m[2])
  const list = pilotState.keywords[facet]
  if (!Array.isArray(list) || Number.isNaN(idx) || idx < 0 || idx >= list.length) return null
  const chip = list[idx]
  const conceptUrl = gcmdConceptUrlFromUuid(String(chip?.uuid || ''))
  const label = String(chip?.label || '').trim()
  const searchUrl = !conceptUrl && label ? earthdataSearchUrlForGcmdKeyword(label) : ''
  if (!conceptUrl && !searchUrl) return null
  return { conceptUrl, searchUrl }
}

/**
 * @param {{
 *   mode: string,
 *   onModeChange: (m: string) => void,
 *   score: number,
 *   maxScore: number,
 *   errCount: number,
 *   warnCount: number,
 *   issues: Array<{ severity: 'e'|'w', field: string, message: string, xpath?: string }>,
 *   hostBridgeReady: boolean,
 *   hostRuntimeLabel: string,
 *   summary: { platforms: string, templates: string },
 *   loading: boolean,
 *   onBridgeCheck: () => void,
 *   inlineEverywhere: boolean,
 *   onInlineEverywhereChange: (next: boolean) => void,
 *   onServerRulesValidate?: () => void,
 *   serverRulesBusy?: boolean,
 *   serverRulesSummary?: string,
 *   statusMessage: string,
 *   onIssueNavigate?: (field: string) => void,
 *   getFieldLabel?: (field: string) => string,
 *   hideSurfaceIntro?: boolean,
 *   hideModePills?: boolean,
 *   collapseConnectionTools?: boolean,
 *   collapseFieldHints?: boolean,
 *   quietSurface?: boolean,
 *   hideScoreChips?: boolean,
 *   railIntroProfileLabel?: string,
 *   validationIdle?: boolean,
 *   pilotState?: object,
 * }} props
 */
function displayIssueXpath(xpath) {
  return String(xpath || '').replace(/^\/gmd:MD_Metadata\b/, '/gmi:MI_Metadata')
}

const VALIDATION_MODE_TITLE = {
  lenient: 'Lenient — permissive checks while drafting; fewer blocking rules.',
  strict: 'Strict — tighter required fields and formats before handoff.',
  catalog: 'Catalog — layers NCEI/catalog expectations on top of strict checks.',
}

const BRIDGE_CHECK_TITLE =
  'Tests same-origin /api/db (use npm run dev:netlify or a deployed Netlify function). Optional if you only validate locally.'
const SERVER_RULES_TITLE =
  'Runs catalog/server rules when the database bridge is connected. Disabled without /api/db.'
const INLINE_TOUCHED_TITLE = 'Show inline hints only on fields you have edited.'
const INLINE_ALL_TITLE = 'Show inline hints for every field with an issue (all steps).'

export default function ValidationPanel({
  mode,
  onModeChange,
  score,
  maxScore,
  errCount,
  warnCount,
  issues,
  hostBridgeReady,
  hostRuntimeLabel = hostBridgeReady ? 'Host connected' : 'Host not connected',
  summary,
  loading,
  onBridgeCheck,
  inlineEverywhere,
  onInlineEverywhereChange,
  onServerRulesValidate,
  serverRulesBusy = false,
  serverRulesSummary = '',
  statusMessage,
  onIssueNavigate,
  getFieldLabel = (field) => field,
  hideSurfaceIntro = false,
  hideModePills = false,
  collapseConnectionTools = false,
  collapseFieldHints = false,
  quietSurface = false,
  hideScoreChips = false,
  railIntroProfileLabel = '',
  validationIdle = false,
  pilotState,
}) {
  const [issueFilter, setIssueFilter] = useState(/** @type {'all' | 'e' | 'w'} */ ('all'))
  const [issueNavIndex, setIssueNavIndex] = useState(0)
  const issueListRef = useRef(/** @type {HTMLUListElement | null} */ (null))

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return issues
    return issues.filter((i) => i.severity === issueFilter)
  }, [issues, issueFilter])

  useEffect(() => {
    setIssueNavIndex((i) => {
      if (!filteredIssues.length) return 0
      return Math.min(i, filteredIssues.length - 1)
    })
  }, [filteredIssues])

  /** Keep the active issue row visible when stepping with Prev/Next or after filter changes */
  useEffect(() => {
    if (!filteredIssues.length) return
    const root = issueListRef.current
    if (!root) return
    const btn = root.querySelector(`button.issue-jump[data-issue-nav-index="${issueNavIndex}"]`)
    if (btn instanceof HTMLElement) {
      btn.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    // Intentionally omit `filteredIssues` reference — parent often passes a new array each render;
    // we only need to re-scroll when index, filter, or list length changes.
  }, [issueNavIndex, issueFilter, filteredIssues.length])

  function stepIssue(delta) {
    if (!filteredIssues.length || typeof onIssueNavigate !== 'function') return
    const next = (issueNavIndex + delta + filteredIssues.length) % filteredIssues.length
    setIssueNavIndex(next)
    onIssueNavigate(filteredIssues[next].field)
  }

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const announce = `${errCount} errors, ${warnCount} warnings, ${issues.length} issues`
  const listLabel =
    issueFilter === 'all' || filteredIssues.length === issues.length
      ? `Issues (${issues.length})`
      : `Issues (${filteredIssues.length} of ${issues.length})`

  const showStatusFeed = Boolean(
    String(statusMessage || '').trim() && String(statusMessage).trim() !== 'Ready',
  )

  /** Prev/Next + issue list above the score band while blocking errors exist */
  const issuesFirstRail = errCount > 0

  const connectionSections = (
    <>
      <section className="validation-panel__meta" aria-label="Bridge status">
        <div className="status-list">
          <div>
            <strong>Runtime</strong>
            <span>{hostRuntimeLabel}</span>
          </div>
          <div>
            <strong>Platforms</strong>
            <span>{summary.platforms}</span>
          </div>
          <div>
            <strong>Templates</strong>
            <span>{summary.templates}</span>
          </div>
        </div>
      </section>

      <section className="validation-panel__tools" aria-label="Validation actions">
        <div className="mission-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={onBridgeCheck}
            disabled={!hostBridgeReady || loading}
            aria-describedby={!hostBridgeReady ? 'bridgeHintVal' : undefined}
            aria-busy={loading}
            title={BRIDGE_CHECK_TITLE}
          >
            {loading ? 'Checking…' : 'Bridge check'}
          </button>
          <button
            type="button"
            className="button button-secondary"
            onClick={() => onServerRulesValidate?.()}
            disabled={!hostBridgeReady || serverRulesBusy || typeof onServerRulesValidate !== 'function'}
            aria-describedby={
              !hostBridgeReady ? 'bridgeHintVal' : serverRulesSummary ? 'serverRulesHint' : undefined
            }
            aria-busy={serverRulesBusy}
            title={SERVER_RULES_TITLE}
          >
            {serverRulesBusy ? 'Server rules…' : 'Server rules validate'}
          </button>
        </div>
        {!hostBridgeReady ? (
          <p className="hint" id="bridgeHintVal">
            Bridge check needs a reachable <code>/api/db</code> on the same origin as this app (e.g. Netlify function → Postgres).
          </p>
        ) : null}
        {hostBridgeReady && serverRulesSummary ? (
          <p className="hint" id="serverRulesHint" role="status">
            {serverRulesSummary}
          </p>
        ) : null}
      </section>
    </>
  )

  const surfaceIntro = (
    <>
      {hideSurfaceIntro && !quietSurface ? (
        <p className="hint validation-panel__rail-ew validation-panel__rail-ew--top">
          {railIntroProfileLabel ? (
            <>
              <strong>{railIntroProfileLabel}</strong>{' '}
            </>
          ) : null}
          <strong>Errors</strong> reduce your readiness score in this mode; <strong>warnings</strong> are advisory. Use
          Prev/Next or tap an issue to jump to its field.
        </p>
      ) : null}
      {!hideSurfaceIntro ? (
        <header className="validation-panel__intro">
          <h2>Validation</h2>
          <p className="hint validation-panel__ew-inline">
            <strong>Errors</strong> block scoring for the selected mode; <strong>warnings</strong> are advisory.
          </p>
          <p className="card-intro">
            Rules and scores update as you edit. Use the list to jump to a field. Turn on field hints for every step, or only where
            you have made changes.
          </p>
          <details className="validation-panel__severity-help">
            <summary>Optional: bridge check · server rules</summary>
            <p className="hint">
              Bridge check tests <code>/api/db</code>; server rules runs catalog checks when the host is connected — both optional
              if you only need local ISO validation.
            </p>
          </details>
        </header>
      ) : null}
    </>
  )

  const modeScoreSection = (
    <section
      className={`validation-panel__mode-score${hideModePills ? ' validation-panel__mode-score--modes-upstream' : ''}`}
      aria-label="Validation mode and completeness"
    >
      {!hideModePills ? (
        <div className="mode-pills" role="group" aria-label="Validation mode">
          {[
            { id: 'lenient', label: 'Lenient' },
            { id: 'strict', label: 'Strict' },
            { id: 'catalog', label: 'Catalog' },
          ].map((m) => (
            <button
              key={m.id}
              type="button"
              className={`mode-pill${mode === m.id ? ' active' : ''}`}
              aria-pressed={mode === m.id}
              onClick={() => onModeChange(m.id)}
              title={VALIDATION_MODE_TITLE[m.id] ?? ''}
            >
              {m.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="score-row">
        <div className="score-bar-wrap" aria-label={`Completeness ${pct} percent`}>
          <div className="score-bar-bg">
            <div className="score-bar-fill" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {!hideScoreChips ? (
          <div className="score-chips">
            <span className="chip chip-err">{errCount} errors</span>
            <span className="chip chip-warn">{warnCount} warnings</span>
          </div>
        ) : null}
      </div>
      <p className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announce}
      </p>
    </section>
  )

  const issuesSection = (
    <section className="validator-list validation-panel__issues-wrap" aria-labelledby="validation-issues-heading">
        <div className="validation-issues-head">
          <strong id="validation-issues-heading">{listLabel}</strong>
          {filteredIssues.length && typeof onIssueNavigate === 'function' ? (
            <div className="issue-step-nav" role="group" aria-label="Step through issues">
              <button
                type="button"
                className="button button-secondary button-tiny issue-step-nav__btn"
                onClick={() => stepIssue(-1)}
                aria-label="Previous validation issue"
                title="Previous issue"
              >
                ← Prev
              </button>
              <button
                type="button"
                className="button button-secondary button-tiny issue-step-nav__btn"
                onClick={() => stepIssue(1)}
                aria-label="Next validation issue"
                title="Next issue"
              >
                Next →
              </button>
              <span className="issue-step-nav__pos" aria-live="polite">
                {issueNavIndex + 1}/{filteredIssues.length}
              </span>
            </div>
          ) : null}
          <div className="issue-filter" role="group" aria-label="Filter issues by severity">
            {(
              [
                { id: 'all', label: 'All' },
                { id: 'e', label: 'Errors' },
                { id: 'w', label: 'Warnings' },
              ]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={`issue-filter-pill${issueFilter === f.id ? ' active' : ''}`}
                aria-pressed={issueFilter === f.id}
                onClick={() => setIssueFilter(/** @type {'all' | 'e' | 'w'} */ (f.id))}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        {issues.length && !filteredIssues.length ? (
          <p className="hint">No issues match this filter.</p>
        ) : null}
        {filteredIssues.length ? (
          <ul className="issue-list" ref={issueListRef}>
            {filteredIssues.map((iss, i) => {
              const label = getFieldLabel(iss.field)
              const navActive = i === issueNavIndex
              const kwLinks = keywordUuidIssueLinks(iss.field, pilotState)
              return (
                <li key={`${iss.field}-${i}`} className={iss.severity === 'e' ? 'issue-err' : 'issue-warn'}>
                  <button
                    type="button"
                    className={`issue-jump${navActive ? ' issue-jump--active' : ''}`}
                    disabled={typeof onIssueNavigate !== 'function'}
                    onClick={() => {
                      setIssueNavIndex(i)
                      onIssueNavigate?.(iss.field)
                    }}
                    data-pilot-issue-field={iss.field}
                    data-pilot-issue-sev={iss.severity}
                    data-issue-nav-index={i}
                    aria-current={navActive ? 'true' : undefined}
                  >
                    <span className="issue-sev">{iss.severity === 'e' ? 'Error' : 'Warn'}</span>
                    <span className="issue-field">{label}</span>
                    {label !== iss.field ? <code className="issue-xpath">{iss.field}</code> : null}
                    <span className="issue-msg">{iss.message}</span>
                    {iss.xpath ? <code className="issue-xpath">{displayIssueXpath(iss.xpath)}</code> : null}
                  </button>
                  {kwLinks ? (
                    <div className="issue-row-extras" role="group" aria-label="Keyword KMS helpers">
                      {kwLinks.conceptUrl ? (
                        <a
                          className="linkish issue-row-kms-link"
                          href={kwLinks.conceptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Open GCMD concept
                        </a>
                      ) : null}
                      {kwLinks.searchUrl ? (
                        <a
                          className="linkish issue-row-kms-link"
                          href={kwLinks.searchUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          Search Earthdata
                        </a>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        ) : !issues.length ? (
          <p className="hint">
            {validationIdle
              ? 'Validation starts after you import XML, apply a sheet template, load a draft, or edit a field.'
              : 'All clear for this mode.'}
          </p>
        ) : null}
      </section>
  )

  return (
    <div
      className={`validation-panel${quietSurface ? ' validation-panel--quiet-surface' : ''}${
        issuesFirstRail ? ' validation-panel--issues-first' : ''
      }`}
    >
      {hideSurfaceIntro ? (
        <section className="validation-panel__xml-tiers" aria-label="XML verification tiers">
          <p className="hint validation-panel__xml-tiers-lede">
            Live preview XML: T1 well-formed · T2 NOAA XSD (wasm) · T3 CoMET preflight.
          </p>
          <PreviewVerificationTierStrip variant="verify" />
        </section>
      ) : null}
      {surfaceIntro}
      {issuesFirstRail ? (
        <>
          {issuesSection}
          {modeScoreSection}
        </>
      ) : (
        <>
          {modeScoreSection}
          {issuesSection}
        </>
      )}

      {showStatusFeed ? (
        <div className="validation-panel__feed">
          <p className="status-message" role="status" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>
        </div>
      ) : null}

      {!quietSurface ? (
        collapseFieldHints ? (
          <details className="validation-panel__field-hints-acc">
            <summary className="validation-panel__field-hints-acc-summary">
              Field hints · {inlineEverywhere ? 'All fields' : 'Touched'}
            </summary>
            <section className="validation-panel__inline-mode validation-panel__inline-mode--nested" aria-label="Inline field messages">
              <div className="inline-mode-row">
                <span className="inline-mode-label" id="inline-hints-label">
                  Scope
                </span>
                <div
                  className="inline-mode-toggle"
                  role="group"
                  aria-labelledby="inline-hints-label"
                >
                  <button
                    type="button"
                    className={`inline-mode-pill${!inlineEverywhere ? ' active' : ''}`}
                    aria-pressed={!inlineEverywhere}
                    onClick={() => onInlineEverywhereChange(false)}
                    title={INLINE_TOUCHED_TITLE}
                  >
                    Touched
                  </button>
                  <button
                    type="button"
                    className={`inline-mode-pill${inlineEverywhere ? ' active' : ''}`}
                    aria-pressed={inlineEverywhere}
                    onClick={() => onInlineEverywhereChange(true)}
                    title={INLINE_ALL_TITLE}
                  >
                    All fields
                  </button>
                </div>
              </div>
            </section>
          </details>
        ) : (
          <section className="validation-panel__inline-mode" aria-label="Inline field messages">
            <div className="inline-mode-row">
              <span className="inline-mode-label" id="inline-hints-label">
                Field hints
              </span>
              <div
                className="inline-mode-toggle"
                role="group"
                aria-labelledby="inline-hints-label"
              >
                <button
                  type="button"
                  className={`inline-mode-pill${!inlineEverywhere ? ' active' : ''}`}
                  aria-pressed={!inlineEverywhere}
                  onClick={() => onInlineEverywhereChange(false)}
                  title={INLINE_TOUCHED_TITLE}
                >
                  Touched
                </button>
                <button
                  type="button"
                  className={`inline-mode-pill${inlineEverywhere ? ' active' : ''}`}
                  aria-pressed={inlineEverywhere}
                  onClick={() => onInlineEverywhereChange(true)}
                  title={INLINE_ALL_TITLE}
                >
                  All fields
                </button>
              </div>
            </div>
            <p className="inline-mode-hint">
              <strong>Touched</strong>: hints only on fields you have edited.
              <strong> All fields</strong>: every issue on every step (same as this list).
            </p>
          </section>
        )
      ) : null}

      {collapseConnectionTools ? (
        <details
          className="validation-panel__advanced"
          open={!hostBridgeReady}
        >
          <summary className="validation-panel__advanced-summary">
            Connection & tools
          </summary>
          {connectionSections}
        </details>
      ) : (
        connectionSections
      )}
    </div>
  )
}
