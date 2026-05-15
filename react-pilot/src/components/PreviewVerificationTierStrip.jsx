import { usePreviewVerification } from '../context/PreviewVerificationContext.jsx'

/**
 * @param {{
 *   variant?: 'cmd-center' | 'verify' | 'xml-compact' | 'xml-expanded',
 *   className?: string,
 * }} props
 */
export default function PreviewVerificationTierStrip({
  variant = 'cmd-center',
  className = '',
}) {
  const { tier1, tier2, tier3 } = usePreviewVerification()

  const rootClass = [
    'preview-verification-tier-strip',
    `preview-verification-tier-strip--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div
      className={rootClass}
      role="group"
      aria-label="XML verification tiers: well-formed, NOAA XSD, CoMET preflight"
    >
      <span
        className={pillClass(tier1.status === 'valid', tier1.status === 'error')}
        title="T1: XML well-formed (browser DOMParser on live preview)"
      >
        {tier1.status === 'valid' ? 'T1 ✓' : tier1.status === 'error' ? 'T1 ✗' : 'T1 —'}
      </span>
      <span
        className={pillClass(tier2.isValid, tier2.status === 'error', tier2.isLoading)}
        title="T2: NOAA ISO 19139 XSD — in-browser xmllint-wasm + /public/schemas catalog"
      >
        {tier2.isLoading
          ? 'T2 …'
          : tier2.isValid
            ? 'T2 ✓'
            : tier2.status === 'error'
              ? `T2 ${tier2.errorCount}✗`
              : 'T2 —'}
      </span>
      <span
        className={pillClass(tier3.pass, tier3.ran && !tier3.pass, tier3.busy)}
        title={
          tier3.ran
            ? `T3: CoMET preflight — ${tier3.overall || 'done'}`
            : 'T3: CoMET preflight — run from CoMET tab'
        }
      >
        {tier3.busy
          ? 'T3 …'
          : tier3.pass
            ? 'T3 ✓'
            : tier3.ran
              ? 'T3 ✗'
              : 'T3 —'}
      </span>
    </div>
  )
}

/**
 * @param {boolean} ok
 * @param {boolean} err
 * @param {boolean} [loading]
 */
function pillClass(ok, err, loading = false) {
  if (loading) return 'cmd-center-pill'
  if (ok) return 'cmd-center-pill cmd-center-pill--ok'
  if (err) return 'cmd-center-pill cmd-center-pill--err'
  return 'cmd-center-pill'
}
