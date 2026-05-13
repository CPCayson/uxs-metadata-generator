import { useCallback, useRef } from 'react'
import { validateXML } from 'xmllint-wasm'

/** @type {{ name: string, path: string, content: string }[] | null} */
let schemaCache = null

/** Single-flight schema load (concurrent callers share one fetch). */
let schemaLoadPromise = /** @type {Promise<{ name: string, path: string, content: string }[]> | null} */ (null)

const manifestUrl = () => {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}schemas/manifest.json`
}

/**
 * @param {unknown} err
 * @returns {string}
 */
function wasmErrorMessage(err) {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const o = /** @type {Record<string, unknown>} */ (err)
    if (String(o.name || '') === 'ErrnoError') {
      const code = o.G ?? o.errno ?? o.code
      return `WASM / libxml error (ErrnoError code ${code ?? '?'}). Often missing or unreadable schema files under /schemas — run \`npm run schemas:noaa-public\` from react-pilot/, hard-refresh, or use Netlify dev (http://127.0.0.1:8888) if workers mis-resolve on plain Vite.`
    }
    try {
      return JSON.stringify(err)
    } catch {
      return String(err)
    }
  }
  return String(err)
}

const loadSchemas = async () => {
  if (schemaCache) return schemaCache
  schemaLoadPromise ??= (async () => {
    const res = await fetch(manifestUrl())
    if (!res.ok) {
      throw new Error(`manifest fetch failed (${res.status}): ${manifestUrl()}`)
    }
    /** @type {{ name: string, path: string }[]} */
    const manifest = await res.json()
    const loaded = await Promise.all(
      manifest.map(async (entry) => {
        const response = await fetch(entry.path)
        if (!response.ok) {
          throw new Error(`Schema fetch failed (${response.status}): ${entry.path}`)
        }
        const content = await response.text()
        if (!String(content || '').trim()) {
          throw new Error(`Schema file empty: ${entry.path}`)
        }
        return { name: entry.name, path: entry.path, content }
      }),
    )

    schemaCache = loaded
    return loaded
  })()
  try {
    return await schemaLoadPromise
  } catch (e) {
    schemaLoadPromise = null
    throw e
  }
}

/**
 * xmllint-wasm rejects with ErrnoError / worker errors; some paths still surface as
 * unhandled rejections unless every rejection is absorbed here.
 *
 * @param {import('xmllint-wasm').XMLLintOptions} opts
 * @returns {Promise<{ valid: boolean, errors: { loc?: { lineNumber: number }, message?: string, rawMessage?: string }[], normalized?: string, rawOutput?: string }>}
 */
async function validateXmlSafe(opts) {
  try {
    return await validateXML(opts)
  } catch (err) {
    const msg = wasmErrorMessage(err)
    return {
      valid: false,
      normalized: '',
      errors: [{ rawMessage: msg, message: msg, loc: null }],
      rawOutput: msg,
    }
  }
}

export function useNoaaValidator() {
  const runSeq = useRef(0)

  const runStrictValidation = useCallback(async (xmlString) => {
    const seq = ++runSeq.current
    if (!xmlString?.trim()) {
      return { valid: false, errors: ['No XML provided'] }
    }

    try {
      const loadedSchemas = await loadSchemas()
      if (seq !== runSeq.current) {
        return { valid: false, errors: ['Validation superseded by a newer preview.'] }
      }

      const root = loadedSchemas.find((s) => s.name === 'schema.xsd')
      if (!root) throw new Error('Root schema.xsd not found in manifest.')

      const preload = loadedSchemas
        .filter((s) => s.name !== 'schema.xsd')
        .map((s) => ({ fileName: s.name, contents: s.content }))

      const result = await validateXmlSafe({
        xml: { fileName: 'pilot-preview.xml', contents: xmlString },
        schema: { fileName: 'schema.xsd', contents: root.content },
        preload,
        maxMemoryPages: 4096,
      })

      if (seq !== runSeq.current) {
        return { valid: false, errors: ['Validation superseded by a newer preview.'] }
      }

      return {
        valid: result.valid,
        errors: (result.errors || []).map((e) => {
          const line = e.loc?.lineNumber
          const msg = e.message || e.rawMessage || ''
          return line != null ? `Line ${line}: ${msg}` : msg
        }),
      }
    } catch (error) {
      if (seq !== runSeq.current) {
        return { valid: false, errors: ['Validation superseded by a newer preview.'] }
      }
      console.error('WASM Validator Error:', error)
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : wasmErrorMessage(error)
      return {
        valid: false,
        errors: [
          `Tier 2 (xmllint-wasm): ${msg}. If this is a minified worker error, hard-refresh; run \`npm run schemas:noaa-public\` so /public/schemas is populated; or use http://127.0.0.1:8888 (netlify dev) if workers mis-resolve on plain Vite.`,
        ],
      }
    }
  }, [])

  return { runStrictValidation }
}
