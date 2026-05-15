/**
 * useCometValidator — Tier 3 CoMET preflight validation hook
 *
 * Runs ISO validate and Rubric V2 in parallel; both execute regardless of
 * whether validate passes so the user always gets a rubric score.
 *
 * @typedef {{
 *   isoValid: boolean,
 *   isoErrorCount: number | null,
 *   isoErrors: string[],
 *   rubricScore: string | null,
 *   rubricBreakdown: object | null,
 *   resolverErrors: string[],
 * }} CometTier3Result
 */

import { useState, useCallback } from 'react'
import { getRubricScore, validateIsoXml, resolveXlinks, extractCometIsoValidateErrorCount } from '../lib/cometClient.js'

function isAuthFailureMessage(msg) {
  const m = String(msg || '').toLowerCase()
  return (
    m.includes('401') ||
    m.includes('403') ||
    m.includes('no comet jsessionid') ||
    m.includes('session expired') ||
    m.includes('access denied') ||
    m.includes('log in from the app')
  )
}

function isoErrorsFromValidatePayload(payload) {
  if (!payload || typeof payload !== 'object') return []
  const o = /** @type {Record<string, unknown>} */ (payload)
  const out = []
  for (const key of ['messages', 'errors', 'validationMessages', 'details', 'issues']) {
    const v = o[key]
    if (!Array.isArray(v)) continue
    for (const item of v) {
      if (typeof item === 'string') out.push(item)
      else if (item && typeof item === 'object') {
        const r = /** @type {Record<string, unknown>} */ (item)
        const msg = r.message ?? r.text
        out.push(msg != null ? String(msg) : JSON.stringify(item))
      }
    }
  }
  return out
}

export function useCometValidator() {
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(/** @type {CometTier3Result | null} */ (null))
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(/** @type {string | null} */ (null))

  const runCometValidation = useCallback(async (xmlString, { runRubric = true, runResolver = false } = {}) => {
    if (!xmlString?.trim()) {
      setError('No XML to validate.')
      setStatus('error')
      return
    }

    setIsLoading(true)
    setStatus('running')
    setError(null)
    setResult(null)

    // Run validate and rubric in parallel — rubric runs regardless of validate result
    const validatePromise = validateIsoXml(xmlString, 'manta-preview.xml').catch((e) => ({ __err: e }))
    const rubricPromise = runRubric
      ? getRubricScore('manta-preview', xmlString).catch(() => null)
      : Promise.resolve(null)
    const resolverPromise = runResolver
      ? resolveXlinks(xmlString).catch((e) => ({ __err: e }))
      : Promise.resolve(null)

    try {
      const [valRes, rubricRes, resolverRes] = await Promise.all([validatePromise, rubricPromise, resolverPromise])

      // ── Validate ────────────────────────────────────────────────────────
      let isoValid = false
      let isoErrorCount = null
      let isoErrors = []

      if (valRes && typeof valRes === 'object' && '__err' in valRes) {
        const msg = valRes.__err instanceof Error ? valRes.__err.message : String(valRes.__err)
        if (isAuthFailureMessage(msg)) {
          setStatus('unauthenticated')
          setError('CoMET session expired or missing. Set COMET_USER + COMET_PASS on the server, or log in via the CoMET panel.')
          setIsLoading(false)
          return
        }
        isoErrors = [msg]
        isoErrorCount = null
      } else {
        const count = extractCometIsoValidateErrorCount(valRes)
        isoErrorCount = count
        if (count == null) {
          isoErrors = ['CoMET validate returned an unrecognized response — see Network → isoValidate.']
        } else {
          isoValid = count === 0
          isoErrors = isoValid ? [] : isoErrorsFromValidatePayload(valRes)
          if (isoErrors.length === 0 && count > 0) {
            isoErrors = [`CoMET reported ${count} schema error(s). See Network → isoValidate for details.`]
          }
        }
      }

      // ── Rubric ──────────────────────────────────────────────────────────
      let rubricScore = null
      let rubricBreakdown = null
      if (rubricRes) {
        rubricScore = rubricRes.totalScore ?? null
        rubricBreakdown = {
          totalScore: rubricRes.totalScore,
          errorCount: rubricRes.errorCount,
          categories: rubricRes.categories,
        }
      }

      // ── Resolver ────────────────────────────────────────────────────────
      const resolverErrors = resolverRes && typeof resolverRes === 'object' && '__err' in resolverRes
        ? [resolverRes.__err instanceof Error ? resolverRes.__err.message : String(resolverRes.__err)]
        : []

      const finalResult = { isoValid, isoErrorCount, isoErrors, rubricScore, rubricBreakdown, resolverErrors }
      setResult(finalResult)
      setStatus(isoValid ? 'valid' : isoErrorCount != null ? 'invalid' : 'error')
    } catch (err) {
      console.error('CoMET Tier 3 error:', err)
      const msg = err instanceof Error ? err.message : String(err)
      if (isAuthFailureMessage(msg)) {
        setStatus('unauthenticated')
        setError('CoMET session expired or missing. Set COMET_USER + COMET_PASS on the server, or log in via the CoMET panel.')
      } else {
        setStatus('error')
        setError(msg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { runCometValidation, status, result, isLoading, error }
}
