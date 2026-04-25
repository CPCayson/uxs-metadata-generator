import { useMemo, useState } from 'react'

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
 * }} props
 */
function displayIssueXpath(xpath) {
  return String(xpath || '').replace(/^\/gmd:MD_Metadata\b/, '/gmi:MI_Metadata')
}

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
}) {
  const [issueFilter, setIssueFilter] = useState(/** @type {'all' | 'e' | 'w'} */ ('all'))

  const filteredIssues = useMemo(() => {
    if (issueFilter === 'all') return issues
    return issues.filter((i) => i.severity === issueFilter)
  }, [issues, issueFilter])

  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const announce = `${errCount} errors, ${warnCount} warnings, ${issues.length} issues`
  const listLabel =
    issueFilter === 'all' || filteredIssues.length === issues.length
      ? `Issues (${issues.length})`
      : `Issues (${filteredIssues.length} of ${issues.length})`

  return (
    <div className="validation-panel">
      <header className="validation-panel__intro">
        <h2>Live validator</h2>
        <p className="card-intro">
          Rules and scores track your edits in real time (work stays responsive — validation is deferred). Jump from the list to
          any field. Toggle inline hints to cover every step at once, or only fields you have touched.
        </p>
      </header>

      <section className="validation-panel__mode-score" aria-label="Validation mode and completeness">
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
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="score-row">
          <div className="score-bar-wrap" aria-label={`Completeness ${pct} percent`}>
            <div className="score-bar-bg">
              <div className="score-bar-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <div className="score-chips">
            <span className="chip chip-err">{errCount} errors</span>
            <span className="chip chip-warn">{warnCount} warnings</span>
          </div>
        </div>
        <p className="visually-hidden" aria-live="polite" aria-atomic="true">
          {announce}
        </p>
      </section>

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
            >
              Touched
            </button>
            <button
              type="button"
              className={`inline-mode-pill${inlineEverywhere ? ' active' : ''}`}
              aria-pressed={inlineEverywhere}
              onClick={() => onInlineEverywhereChange(true)}
            >
              All fields
            </button>
          </div>
        </div>
        <p className="inline-mode-hint">
          <strong>All fields</strong> shows messages under every control that has an issue, on every step — same data as this list.
          <strong> Touched</strong> is quieter while you first fill a step.
        </p>
      </section>

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

      <section className="validator-list validation-panel__issues-wrap" aria-labelledby="validation-issues-heading">
        <div className="validation-issues-head">
          <strong id="validation-issues-heading">{listLabel}</strong>
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
          <ul className="issue-list">
            {filteredIssues.map((iss, i) => {
              const label = getFieldLabel(iss.field)
              return (
                <li key={`${iss.field}-${i}`} className={iss.severity === 'e' ? 'issue-err' : 'issue-warn'}>
                  <button
                    type="button"
                    className="issue-jump"
                    disabled={typeof onIssueNavigate !== 'function'}
                    onClick={() => onIssueNavigate?.(iss.field)}
                    data-pilot-issue-field={iss.field}
                    data-pilot-issue-sev={iss.severity}
                  >
                    <span className="issue-sev">{iss.severity === 'e' ? 'Error' : 'Warn'}</span>
                    <span className="issue-field">{label}</span>
                    {label !== iss.field ? <code className="issue-xpath">{iss.field}</code> : null}
                    <span className="issue-msg">{iss.message}</span>
                    {iss.xpath ? <code className="issue-xpath">{displayIssueXpath(iss.xpath)}</code> : null}
                  </button>
                </li>
              )
            })}
          </ul>
        ) : !issues.length ? (
          <p className="hint">No issues for current mode.</p>
        ) : null}
      </section>

      <div className="validation-panel__feed">
        <p className="status-message" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
      </div>
    </div>
  )
}
