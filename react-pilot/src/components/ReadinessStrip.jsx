import { memo } from 'react'

/**
 * Snapshot entry from {@link import('../lib/readinessSummary.js').computeReadinessSnapshot}.
 * @typedef {{ errCount: number, warnCount: number, score: number, maxScore: number }} ReadinessModeResult
 */

/**
 * @param {{
 *   snapshot: Record<'lenient'|'strict'|'catalog', ReadinessModeResult>,
 *   bundles?: Array<{ id: string, label: string, ready: boolean, detail: string, scope?: string }>,
 *   activeMode: string,
 *   onSelectMode: (mode: string) => void,
 *   className?: string,
 * }} props
 */
function ReadinessStrip({ snapshot, bundles = [], activeMode, onSelectMode, className = '' }) {
  const modes = [
    { id: 'lenient', label: 'Lenient', hint: 'Baseline / internal draft' },
    { id: 'strict', label: 'Strict', hint: 'Publication-style required fields' },
    { id: 'catalog', label: 'Catalog', hint: 'Discovery: DOI, landing URL, download, etc.' },
  ]

  return (
    <section className={`readiness-strip${className ? ` ${className}` : ''}`} aria-label="Readiness across validation modes">
      <div className="readiness-strip__head">
        <h3 className="readiness-strip__title">Readiness</h3>
        <p className="readiness-strip__hint" title="Mode pills are local editor checks; named goals distinguish internal and external readiness.">
          Local editor rules — tap to switch validator mode
        </p>
      </div>
      <div className="readiness-strip__pills" role="group">
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
        <div className="readiness-strip__pills" role="list" aria-label="Named readiness goals">
          {bundles.map((bundle) => (
            <span
              key={bundle.id}
              role="listitem"
              className={`readiness-pill${bundle.ready ? ' readiness-pill--ok' : ' readiness-pill--err'}`}
              title={`${bundle.scope ? `${bundle.scope}: ` : ''}${bundle.detail}`}
            >
              <span className="readiness-pill__label">{bundle.label}</span>
              <span className="readiness-pill__badge" aria-hidden="true">
                {bundle.ready ? '✓' : '✗'}
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </section>
  )
}

export default memo(ReadinessStrip)
