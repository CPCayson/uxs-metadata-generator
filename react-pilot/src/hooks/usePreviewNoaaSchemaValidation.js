import { useEffect, useState } from 'react'
import { useNoaaValidator } from './useNoaaValidator.js'

/**
 * Debounced NOAA ISO 19139 XSD check on live preview XML (xmllint-wasm + /public/schemas).
 * Shared by XmlPreviewPanel Tier 2 pill and command-center T2 badge.
 *
 * @param {string} xmlData
 * @param {{ debounceMs?: number }} [options]
 */
export function usePreviewNoaaSchemaValidation(xmlData, options = {}) {
  const debounceMs = options.debounceMs ?? 500
  const { runStrictValidation } = useNoaaValidator()
  const [status, setStatus] = useState(/** @type {'idle' | 'loading' | 'valid' | 'error'} */ ('idle'))
  const [errors, setErrors] = useState(/** @type {string[]} */ ([]))

  useEffect(() => {
    if (!String(xmlData || '').trim()) {
      setStatus('idle')
      setErrors([])
      return undefined
    }

    setStatus('loading')
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const result = await runStrictValidation(xmlData)
          if (result.valid) {
            setStatus('valid')
            setErrors([])
          } else {
            setStatus('error')
            setErrors(result.errors || [])
          }
        } catch (e) {
          setStatus('error')
          setErrors([e instanceof Error ? e.message : String(e)])
        }
      })()
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [xmlData, runStrictValidation, debounceMs])

  return {
    status,
    errors,
    errorCount: errors.length,
    isLoading: status === 'loading',
    isValid: status === 'valid',
  }
}
