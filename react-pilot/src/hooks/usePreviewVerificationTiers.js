import { useMemo } from 'react'
import {
  computeCometPreflightTier,
  computePreviewXmlWellFormedTier,
} from '../lib/previewVerificationTiers.js'
import { usePreviewNoaaSchemaValidation } from './usePreviewNoaaSchemaValidation.js'

const IDLE_TIER1 = { status: 'idle', ok: null, detail: '' }
const IDLE_TIER3 = { status: 'idle', ran: false, pass: false, overall: '', busy: false }

/**
 * Integrated preview verification: T1 well-formed, T2 NOAA XSD (wasm), T3 CoMET preflight.
 *
 * @param {string} previewXml
 * @param {{ enabled?: boolean, preflightSummary?: { overall?: string } | null, preflightBusy?: boolean }} [options]
 */
export function usePreviewVerificationTiers(previewXml, options = {}) {
  const enabled = options.enabled !== false
  const xml = enabled ? previewXml : ''

  const tier1 = useMemo(
    () => (enabled ? computePreviewXmlWellFormedTier(xml) : IDLE_TIER1),
    [enabled, xml],
  )

  const tier2 = usePreviewNoaaSchemaValidation(xml)

  const tier3Base = useMemo(
    () => (enabled ? computeCometPreflightTier(options.preflightSummary) : IDLE_TIER3),
    [enabled, options.preflightSummary],
  )

  const tier3 = useMemo(
    () => ({
      ...tier3Base,
      busy: Boolean(options.preflightBusy),
    }),
    [tier3Base, options.preflightBusy],
  )

  const previewXmlReady = tier1.ok === true && tier2.isValid

  return {
    tier1,
    tier2,
    tier3,
    previewXmlReady,
  }
}

export const IDLE_PREVIEW_VERIFICATION_TIERS = {
  tier1: IDLE_TIER1,
  tier2: { status: 'idle', errors: [], errorCount: 0, isLoading: false, isValid: false },
  tier3: IDLE_TIER3,
  previewXmlReady: false,
}
