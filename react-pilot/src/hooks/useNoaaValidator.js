import { useCallback } from 'react'
import { validateXML } from 'xmllint-wasm'

/** @type {{ name: string, path: string }[] | null} */
let schemaCache = null

const manifestUrl = () => {
  const base = import.meta.env.BASE_URL || '/'
  const prefix = base.endsWith('/') ? base : `${base}/`
  return `${prefix}schemas/manifest.json`
}

const loadSchemas = async () => {
  if (schemaCache) return schemaCache

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
      return { name: entry.name, content }
    }),
  )

  schemaCache = loaded
  return loaded
}

export function useNoaaValidator() {
  const runStrictValidation = useCallback(async (xmlString) => {
    if (!xmlString?.trim()) {
      return { valid: false, errors: ['No XML provided'] }
    }

    try {
      const loadedSchemas = await loadSchemas()
      const root = loadedSchemas.find((s) => s.name === 'schema.xsd')
      if (!root) throw new Error('Root schema.xsd not found in manifest.')

      const preload = loadedSchemas
        .filter((s) => s.name !== 'schema.xsd')
        .map((s) => ({ fileName: s.name, contents: s.content }))

      const result = await validateXML({
        xml: { fileName: 'pilot-preview.xml', contents: xmlString },
        schema: { fileName: 'schema.xsd', contents: root.content },
        preload,
        maxMemoryPages: 2048,
      })

      return {
        valid: result.valid,
        errors: (result.errors || []).map((e) => {
          const line = e.loc?.lineNumber
          const msg = e.message || e.rawMessage || ''
          return line != null ? `Line ${line}: ${msg}` : msg
        }),
      }
    } catch (error) {
      console.error('WASM Validator Error:', error)
      const msg =
        error instanceof Error
          ? error.message
          : typeof error === 'string'
            ? error
            : (() => {
                try {
                  return JSON.stringify(error)
                } catch {
                  return String(error)
                }
              })()
      return {
        valid: false,
        errors: [
          `Tier 2 (xmllint-wasm): ${msg}. If this is a minified worker error, hard-refresh; run \`npm run schemas:noaa-public\` so /public/schemas is populated; or use http://localhost:8888 (netlify dev) if workers mis-resolve on plain Vite.`,
        ],
      }
    }
  }, [])

  return { runStrictValidation }
}
