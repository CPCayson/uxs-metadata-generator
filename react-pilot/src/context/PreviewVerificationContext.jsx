import { createContext, useContext } from 'react'
import { IDLE_PREVIEW_VERIFICATION_TIERS } from '../hooks/usePreviewVerificationTiers.js'

/** @typedef {ReturnType<typeof import('../hooks/usePreviewVerificationTiers.js').usePreviewVerificationTiers>} PreviewVerificationTiers */

const PreviewVerificationContext = createContext(
  /** @type {PreviewVerificationTiers | null} */ (null),
)

/**
 * @param {{
 *   value: PreviewVerificationTiers,
 *   children: import('react').ReactNode,
 * }} props
 */
export function PreviewVerificationProvider({ value, children }) {
  return (
    <PreviewVerificationContext.Provider value={value}>
      {children}
    </PreviewVerificationContext.Provider>
  )
}

/** @returns {PreviewVerificationTiers} */
export function usePreviewVerification() {
  return useContext(PreviewVerificationContext) ?? IDLE_PREVIEW_VERIFICATION_TIERS
}
