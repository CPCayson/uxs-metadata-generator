/**
 * Node-only: DOM shim + sample XML → import → merge → sanitize → ISO 19115-2 preview XML.
 * Shared by push / CoMET automation scripts (same path as the app).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', '..')

let _domReady = false
/** @type {Promise<{ importPilotPartialStateFromXml: Function, mergeLoadedPilotState: Function, defaultPilotState: Function, sanitizePilotState: Function, buildXmlPreview: Function }>} */
let _modsPromise

function ensureDomShim() {
  if (_domReady) return
  _domReady = true
  globalThis.DOMParser = DOMParser
  if (!globalThis.window) globalThis.window = {}
  const probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
  const elementProto = Object.getPrototypeOf(probeDoc.documentElement)
  if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
    Object.defineProperty(elementProto, 'children', {
      configurable: true,
      enumerable: true,
      get() {
        return Array.from(this.childNodes || []).filter((n) => n && n.nodeType === 1)
      },
    })
  }
}

async function loadMods() {
  if (!_modsPromise) {
    ensureDomShim()
    _modsPromise = (async () => {
      const { importPilotPartialStateFromXml } = await import(path.join(ROOT, 'src/lib/xmlPilotImport.js'))
      const { defaultPilotState, mergeLoadedPilotState, sanitizePilotState } = await import(
        path.join(ROOT, 'src/lib/pilotValidation.js'),
      )
      const { buildXmlPreview } = await import(path.join(ROOT, 'src/lib/xmlPreviewBuilder.js'))
      return {
        importPilotPartialStateFromXml,
        defaultPilotState,
        mergeLoadedPilotState,
        sanitizePilotState,
        buildXmlPreview,
      }
    })()
  }
  return _modsPromise
}

/**
 * @param {string} xmlPath  Absolute path or cwd-relative
 * @returns {Promise<{ isoXml: string, baseName: string, pilot: object }>}
 */
export async function runSampleThroughPreview(xmlPath) {
  const abs = path.resolve(process.cwd(), xmlPath)
  if (!fs.existsSync(abs)) {
    throw new Error(`File not found: ${abs}`)
  }
  const {
    importPilotPartialStateFromXml,
    defaultPilotState,
    mergeLoadedPilotState,
    sanitizePilotState,
    buildXmlPreview,
  } = await loadMods()

  const raw = fs.readFileSync(abs, 'utf8')
  const baseName = path.basename(abs)
  const parseResult = importPilotPartialStateFromXml(raw, { originalFilename: baseName })
  if (!parseResult?.partial) {
    throw new Error(`Import failed (ok=${parseResult?.ok}): no partial state`)
  }

  const merged = mergeLoadedPilotState(defaultPilotState(), parseResult.partial)
  if (!merged) {
    throw new Error('mergeLoadedPilotState returned empty')
  }

  const pilot = sanitizePilotState(merged)
  const isoXml = String(buildXmlPreview(pilot) || '')
  if (!isoXml.trim()) {
    throw new Error('buildXmlPreview returned empty')
  }

  return { isoXml, baseName, pilot }
}
