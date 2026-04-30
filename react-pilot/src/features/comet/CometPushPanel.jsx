/**
 * CoMET pull / preflight / push panel for the wizard side stack.
 *
 * Rendered only when the active profile declares at least one of
 * `cometPull`, `cometPreflight`, or `cometPush`.
 *
 * @module features/comet/CometPushPanel
 */

import { memo } from 'react'

/**
 * @param {{
 *   cometUuid: string,
 *   localUuidInput: string,
 *   setLocalUuidInput: (v: string) => void,
 *   similarUuidCandidates?: Array<{ uuid: string, score: number, count: number, lastUsedAt: string }>,
 *   capPull: boolean,
 *   capPreflight: boolean,
 *   capPush: boolean,
 *   pullBusy: boolean,
 *   pushBusy: boolean,
 *   preflightBusy: boolean,
 *   metaserverBusy?: boolean,
 *   preflightSummary: { overall: string, steps: Array<{ id: string, label: string, ok: boolean, detail?: string }> } | null,
 *   metaserverSummary?: { ok: boolean, detail: string } | null,
 *   onPull: () => void,
 *   onPreflight: () => void,
 *   onMetaserverValidate?: () => void,
 *   onPush: () => void,
 *   cometUsername?: string,
 *   setCometUsername?: (v: string) => void,
 *   cometPassword?: string,
 *   setCometPassword?: (v: string) => void,
 *   authBusy?: boolean,
 *   authStatus?: { hasCometSession?: boolean, cometSessionSource?: string, hasMetaserverSession?: boolean, metaserverSessionSource?: string } | null,
 *   onRefreshAuthStatus?: () => void,
 *   onCometLogin?: () => void,
 *   onMetaserverLogin?: () => void,
 *   onClearAuth?: () => void,
 * }} props
 */
function CometPushPanel({
  cometUuid,
  localUuidInput,
  setLocalUuidInput,
  similarUuidCandidates = [],
  capPull,
  capPreflight,
  capPush,
  pullBusy,
  pushBusy,
  preflightBusy,
  metaserverBusy = false,
  preflightSummary,
  metaserverSummary = null,
  onPull,
  onPreflight,
  onMetaserverValidate,
  onPush,
  cometUsername = '',
  setCometUsername = () => {},
  cometPassword = '',
  setCometPassword = () => {},
  authBusy = false,
  authStatus = null,
  onRefreshAuthStatus,
  onCometLogin,
  onMetaserverLogin,
  onClearAuth,
}) {
  const anyBusy = pullBusy || pushBusy || preflightBusy || metaserverBusy
  const pushDisabled = !capPush || !cometUuid || pushBusy || anyBusy
  const pullDisabled = !capPull || pullBusy || anyBusy
  const preflightDisabled = !capPreflight || preflightBusy || anyBusy

  const overall = preflightSummary?.overall ?? 'idle'
  const statusLabel =
    overall === 'BLOCK' ? 'BLOCK'
      : overall === 'WARN' ? 'WARN'
        : overall === 'PASS' ? 'PASS'
          : '—'

  return (
    <section
      className="comet-push-panel"
      role="region"
      aria-label="CoMET integration"
    >
      <h3 className="h6 mb-2" id="comet-panel-heading">
        CoMET
      </h3>
      <p className="small text-muted mb-3">
        Session is via Netlify proxy (<code>COMET_SESSION_ID</code>). Pull imports ISO into this profile; preflight runs resolver, validate, link check, and rubric; push updates the loaded UUID. PASS requires zero reported CoMET validate/link/rubric errors.
      </p>

      <div className="mb-3 p-2 border rounded">
        <div className="small fw-semibold mb-2">Auth / Token</div>
        <div className="row g-2 mb-2">
          <div className="col-12 col-md-7">
            <input
              type="text"
              className="form-control form-control-sm"
              value={cometUsername}
              onChange={(e) => setCometUsername(e.target.value)}
              placeholder="NOAA username/email"
              autoComplete="username"
              disabled={authBusy}
            />
          </div>
          <div className="col-12 col-md-5">
            <input
              type="password"
              className="form-control form-control-sm"
              value={cometPassword}
              onChange={(e) => setCometPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              disabled={authBusy}
            />
          </div>
        </div>
        <div className="d-flex flex-wrap gap-2 mb-2">
          {onCometLogin ? (
            <button type="button" className="button button-secondary button-tiny" onClick={() => void onCometLogin()} disabled={authBusy}>
              Login CoMET
            </button>
          ) : null}
          {onMetaserverLogin ? (
            <button type="button" className="button button-secondary button-tiny" onClick={() => void onMetaserverLogin()} disabled={authBusy}>
              Login MetaServer
            </button>
          ) : null}
          {onRefreshAuthStatus ? (
            <button type="button" className="button button-secondary button-tiny" onClick={() => void onRefreshAuthStatus()} disabled={authBusy}>
              Check token
            </button>
          ) : null}
          {onClearAuth ? (
            <button type="button" className="button button-secondary button-tiny" onClick={() => void onClearAuth()} disabled={authBusy}>
              Clear token
            </button>
          ) : null}
        </div>
        <div className="small text-muted">
          CoMET session: {authStatus?.hasCometSession ? `ready (${authStatus?.cometSessionSource || 'unknown'})` : 'missing'} · MetaServer session: {authStatus?.hasMetaserverSession ? `ready (${authStatus?.metaserverSessionSource || 'unknown'})` : 'missing'}
        </div>
      </div>

      <div className="mb-2">
        <label htmlFor="comet-uuid-input" className="form-label small mb-1">
          CoMET UUID or URL
        </label>
        <input
          id="comet-uuid-input"
          type="text"
          className="form-control form-control-sm"
          value={localUuidInput}
          onChange={(e) => setLocalUuidInput(e.target.value)}
          placeholder="e.g. a1b2c3d4-e5f6-7890-abcd-ef1234567890"
          disabled={!capPull || pullBusy}
          autoComplete="off"
        />
      </div>
      {capPull && similarUuidCandidates.length > 0 ? (
        <div className="mb-3">
          <div className="small text-muted mb-1">Recent/similar UUIDs</div>
          <div className="d-flex flex-wrap gap-1">
            {similarUuidCandidates.map((c) => (
              <button
                key={c.uuid}
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setLocalUuidInput(c.uuid)}
                title={`Used ${c.count}x`}
              >
                {c.uuid.slice(0, 8)}… ({Math.round(c.score * 100)}%)
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="d-flex flex-wrap gap-2 mb-3">
        {capPull ? (
          <button
            type="button"
            className="button button-secondary button-tiny"
            onClick={() => void onPull()}
            disabled={pullDisabled}
            aria-busy={pullBusy}
          >
            {pullBusy ? 'Pulling…' : 'Pull ISO'}
          </button>
        ) : null}
        {capPreflight ? (
          <button
            type="button"
            className="button button-secondary button-tiny"
            onClick={() => void onPreflight()}
            disabled={preflightDisabled}
            aria-busy={preflightBusy}
          >
            {preflightBusy ? 'Preflight…' : 'Run preflight'}
          </button>
        ) : null}
        {onMetaserverValidate ? (
          <button
            type="button"
            className="button button-secondary button-tiny"
            onClick={() => void onMetaserverValidate()}
            disabled={anyBusy}
            aria-busy={metaserverBusy}
          >
            {metaserverBusy ? 'MetaServer…' : 'Run MetaServer validate'}
          </button>
        ) : null}
        {capPush ? (
          <button
            type="button"
            className={`button button-tiny${cometUuid ? '' : ' button-secondary'}`}
            onClick={() => void onPush()}
            disabled={pushDisabled}
            aria-busy={pushBusy}
            title={!cometUuid ? 'Pull a record or load from the assistant first' : undefined}
          >
            {pushBusy ? 'Pushing…' : 'Push draft'}
          </button>
        ) : null}
      </div>
      {metaserverSummary ? (
        <div className={`small mb-2 ${metaserverSummary.ok ? '' : 'text-danger'}`} aria-live="polite">
          <strong>MetaServer:</strong> {metaserverSummary.ok ? 'PASS' : 'CHECK'}{' '}
          {metaserverSummary.detail ? <span className="text-muted">— {metaserverSummary.detail}</span> : null}
        </div>
      ) : null}

      <div className="small mb-2" aria-live="polite">
        <strong>Preflight:</strong>{' '}
        <span className={overall === 'BLOCK' ? 'text-danger' : overall === 'WARN' ? 'text-warning' : ''}>
          {statusLabel}
        </span>
        {cometUuid ? (
          <>
            {' · '}
            <a
              className="link-secondary"
              href={`https://data.noaa.gov/cedit/collection/${cometUuid}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in CoMET
            </a>
          </>
        ) : null}
      </div>

      {preflightSummary?.steps?.length ? (
        <ul className="list-unstyled small mb-0 comet-push-panel__steps">
          {preflightSummary.steps.map((s) => (
            <li key={s.id} className={s.ok ? '' : 'text-danger'}>
              {s.ok ? '✓' : '✗'} {s.label}
              {s.detail ? <span className="text-muted"> — {s.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}

export default memo(CometPushPanel)
