import { memo } from 'react'

/**
 * Snapshot entry from {@link import('../lib/readinessSummary.js').computeReadinessSnapshot}.
 * @typedef {{ errCount: number, warnCount: number, score: number, maxScore: number }} ReadinessModeResult
 */

/**
 * @param {{
 *   snapshot: Record<'lenient'|'strict'|'catalog', ReadinessModeResult>,
 *   bundles?: Array<{ id: string, label: string, ready: boolean, detail: string, scope?: string, status?: 'pass'|'check'|'block' }>,
 *   activeMode: string,
 *   onSelectMode: (mode: string) => void,
 *   className?: string,
 *   hideSectionHead?: boolean,
 *   accordion?: boolean,
 *   accordionDefaultOpen?: boolean,
 * }} props
 */
function ReadinessStrip({
  snapshot,
  bundles = [],
  activeMode,
  onSelectMode,
  className = '',
  hideSectionHead = false,
  accordion = false,
  accordionDefaultOpen = false,
}) {
  const modes = [
    { id: 'lenient', label: 'Lenient', hint: 'Baseline / internal draft' },
    { id: 'strict', label: 'Strict', hint: 'Publication-style required fields' },
    { id: 'catalog', label: 'Catalog', hint: 'Discovery: DOI, landing URL, download, etc.' },
  ]

  const activeMeta = modes.find((m) => m.id === activeMode)
  const curSnap = snapshot[activeMode]
  const errN = curSnap?.errCount ?? 0
  const warnN = curSnap?.warnCount ?? 0
  const summaryMeta = curSnap
    ? `${errN} error${errN !== 1 ? 's' : ''} · ${warnN} warn`
    : ''

  const pillsAndBundles = (
    <>
      <div className="readiness-strip__pills" role="group" aria-label="Validation mode">
        {modes.map(({ id, label, hint }) => {
          const r = snapshot[id]
          const errs = r?.errCount ?? 0
          const warns = r?.warnCount ?? 0
          const ok = errs === 0
          const active = activeMode === id
          return (
            <button
              key={id}
              type="button"
              className={`readiness-pill${ok ? ' readiness-pill--ok' : ' readiness-pill--err'}${active ? ' readiness-pill--active' : ''}`}
              title={`${hint} — ${errs} error(s), ${warns} warning(s), score ${r?.score ?? '—'}`}
              onClick={() => onSelectMode(id)}
            >
              <span className="readiness-pill__label">{label}</span>
              <span className="readiness-pill__badge" aria-hidden="true">
                {ok ? '✓' : `${errs}✗`}
              </span>
            </button>
          )
        })}
      </div>
      {bundles.length ? (
        <div className="readiness-strip__bundles" role="group" aria-label="Named readiness goals">
          {bundles.map((bundle) => {
            const status = bundle.status || (bundle.ready ? 'pass' : 'block')
            const pillClass = status === 'pass'
              ? 'readiness-pill readiness-pill--ok'
              : status === 'check'
                ? 'readiness-pill readiness-pill--check'
                : 'readiness-pill readiness-pill--err'
            const scopePrefix = bundle.scope ? `${bundle.scope}: ` : ''
            return (
              <details key={bundle.id} className="readiness-bundle">
                <summary className={pillClass}>
                  <span className="readiness-pill__label">{bundle.label}</span>
                  <span className="readiness-pill__badge" aria-hidden="true">
                    {status === 'pass' ? '✓' : status === 'check' ? '!' : '✗'}
                  </span>
                </summary>
                <div className="readiness-bundle__detail">
                  {scopePrefix}{bundle.detail}
                </div>
              </details>
            )
          })}
        </div>
      ) : null}
    </>
  )

  return (
    <section
      className={`readiness-strip${hideSectionHead ? ' readiness-strip--no-head' : ''}${accordion ? ' readiness-strip--accordion-shell' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Validation modes (Lenient, Strict, Catalog)"
    >
      {accordion ? (
        <details className="readiness-strip__accordion" defaultOpen={accordionDefaultOpen}>
          <summary className="readiness-strip__accordion-summary">
            <span className="readiness-strip__accordion-summary-text">
              {activeMeta?.label ?? activeMode}
              {summaryMeta ? ` · ${summaryMeta}` : ''}
              {bundles.length ? ` · ${bundles.length} goal${bundles.length !== 1 ? 's' : ''}` : ''}
            </span>
          </summary>
          <div className="readiness-strip__accordion-body">{pillsAndBundles}</div>
        </details>
      ) : (
        <>
          {!hideSectionHead ? (
            <div className="readiness-strip__head">
              <h3 className="readiness-strip__title">Readiness</h3>
              <p className="readiness-strip__hint" title="Lenient, Strict, and Catalog change which fields are required. Named goals track packaging or publication readiness.">
                How strict should checks be? Tap a mode.
              </p>
            </div>
          ) : null}
          {pillsAndBundles}
        </>
      )}
    </section>
  )
}

export default memo(ReadinessStrip)
