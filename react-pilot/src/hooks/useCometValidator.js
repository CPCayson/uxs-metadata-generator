/**
 * useCometValidator — Tier 3 CoMET preflight validation hook
 *
 * Uses cometClient (same-origin /api/comet-proxy, X-Comet-JSessionId from session).
 *
 * @typedef {{
 *   isoValid: boolean,
 *   isoErrors: string[],
 *   rubricScore: string | number | null,
 *   rubricBreakdown: object | null,
 *   resolverErrors: string[],
 * }} CometTier3Result
 */

import { useState, useCallback } from 'react'
import { getRubricScore, resolveXlinks, validateIsoXml } from '../lib/cometClient.js'

/**
 * @param {unknown} payload
 * @returns {number | null}
 */
function cometIsoErrorCount(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null
  const o = /** @type {Record<string, unknown>} */ (payload)
  if (o.raw != null && o.error_count == null) return null
  const n = Number.parseInt(String(o.error_count ?? '0'), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * @param {string} msg
 */
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

/**
 * @param {unknown} payload
 * @returns {string[]}
 */
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
        const msg = /** @type {Record<string, unknown>} */ (item).message ?? /** @type {Record<string, unknown>} */ (item).text
        if (msg != null) out.push(String(msg))
        else out.push(JSON.stringify(item))
      }
    }
  }
  const n = cometIsoErrorCount(payload)
  if (out.length === 0 && n != null && n > 0) {
    out.push(`CoMET reported ${n} validation issue(s). See full JSON in Network → isoValidate response.`)
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

    try {
      let isoValid = false
      let isoErrors = []

      try {
        const isoRes = await validateIsoXml(xmlString, 'manta-preview.xml')
        const count = cometIsoErrorCount(isoRes)
        if (count == null) {
          isoValid = false
          isoErrors = ['CoMET ISO validate returned an unparseable response (missing error_count).']
        } else {
          isoValid = count === 0
          isoErrors = isoValid ? [] : isoErrorsFromValidatePayload(isoRes)
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (isAuthFailureMessage(msg)) {
          setStatus('unauthenticated')
          setError('CoMET session expired or missing. Log in via the CoMET panel and try again.')
          setIsLoading(false)
          return
        }
        throw e
      }

      let rubricScore = null
      let rubricBreakdown = null

      if (runRubric && isoValid) {
        try {
          const rubricRes = await getRubricScore('manta-preview', xmlString)
          rubricScore = rubricRes?.totalScore ?? null
          rubricBreakdown = {
            totalScore: rubricRes?.totalScore,
            errorCount: rubricRes?.errorCount,
            categories: rubricRes?.categories,
          }
        } catch {
          /* non-fatal */
        }
      }

      let resolverErrors = []

      if (runResolver && isoValid) {
        try {
          await resolveXlinks(xmlString)
        } catch (e) {
          resolverErrors = [e instanceof Error ? e.message : String(e)]
        }
      }

      const finalResult = { isoValid, isoErrors, rubricScore, rubricBreakdown, resolverErrors }
      setResult(finalResult)
      setStatus(isoValid ? 'valid' : 'invalid')
    } catch (err) {
      console.error('CoMET Tier 3 error:', err)
      setStatus('error')
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { runCometValidation, status, result, isLoading, error }
}
