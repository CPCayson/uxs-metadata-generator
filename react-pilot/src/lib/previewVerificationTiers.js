/**
 * Tier 1 (well-formed) and Tier 3 (CoMET preflight) helpers for live preview XML.
 * Tier 2 lives in {@link usePreviewNoaaSchemaValidation}.
 */

/** @typedef {'idle' | 'loading' | 'valid' | 'error'} PreviewVerificationTierStatus */

/**
 * @param {string} xml
 * @returns {{ status: PreviewVerificationTierStatus, ok: boolean | null, detail: string }}
 */
export function computePreviewXmlWellFormedTier(xml) {
  const x = String(xml || '').trim()
  if (!x) return { status: 'idle', ok: null, detail: '' }
  try {
    const doc = new DOMParser().parseFromString(x, 'application/xml')
    const pe = doc.getElementsByTagName('parsererror')[0]
    if (pe) {
      const detail = String(pe.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)
      return { status: 'error', ok: false, detail }
    }
    return { status: 'valid', ok: true, detail: '' }
  } catch {
    return { status: 'error', ok: false, detail: 'XML parser error' }
  }
}

/**
 * @param {{ overall?: string } | null | undefined} preflightSummary
 */
export function computeCometPreflightTier(preflightSummary) {
  const overall = String(preflightSummary?.overall || '').trim()
  const overallUp = overall.toUpperCase()
  const ran = Boolean(overallUp && overallUp !== 'IDLE')
  const pass = overallUp === 'PASS'
  return {
    status: /** @type {PreviewVerificationTierStatus} */ (
      ran ? (pass ? 'valid' : 'error') : 'idle'
    ),
    ran,
    pass,
    overall,
    busy: false,
  }
}
