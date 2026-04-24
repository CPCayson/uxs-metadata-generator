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
 *   onValidateAll: () => void,
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
  onValidateAll,
  onServerRulesValidate,
  serverRulesBusy = false,
  serverRulesSummary = '',
  statusMessage,
  onIssueNavigate,
  getFieldLabel = (field) => field,
}) {
  const pct = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  const announce = `${errCount} errors, ${warnCount} warnings, ${issues.length} issues`

  return (
    <div className="validation-panel">
      <header className="validation-panel__intro">
        <h2>Validator</h2>
        <p className="card-intro">
          In-app validation mode, completeness, and issue list update as you edit. CoMET preflight is separate.
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
          <button type="button" className="button" onClick={onValidateAll}>
            Mark touched &amp; validate
          </button>
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
        <strong id="validation-issues-heading">Issues ({issues.length})</strong>
        {issues.length ? (
          <ul className="issue-list">
            {issues.map((iss, i) => {
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
        ) : (
          <p className="hint">No issues for current mode.</p>
        )}
      </section>

      <div className="validation-panel__feed">
        <p className="status-message" role="status" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>
      </div>
    </div>
  )
}
