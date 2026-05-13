#!/usr/bin/env node
/**
 * Sample XML → import → merge → sanitize → (optional validate) → buildXmlPreview → POST to CoMET via netlify comet-proxy (same shape as the app / pushCometRecord).
 *
 * Auth: COMET_SESSION_ID (JSESSIONID), or COMET_USERNAME + COMET_PASSWORD (proxy action=login, same as validate-manta-sample-comet.mjs).
 * COMET_PROXY_URL defaults to http://127.0.0.1:8888/api/comet-proxy
 */
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { assertCometProxyReachable } from './lib/cometProxyManta.mjs'
import { runSampleThroughPreview } from './lib/runSampleThroughPreview.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_PROXY_BASE = 'http://127.0.0.1:8888/api/comet-proxy'

function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {}
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      out.help = true
      continue
    }
    if (a === '--validate') {
      out.validate = true
      continue
    }
    const eq = a.indexOf('=')
    if (eq > 0 && a.startsWith('--')) {
      const k = a.slice(2, eq)
      out[k.replace(/-/g, '')] = a.slice(eq + 1)
      continue
    }
    if (a.startsWith('--') && argv[i + 1] != null && !argv[i + 1].startsWith('-')) {
      const k = a.slice(2).replace(/-/g, '')
      out[k] = argv[++i]
    }
  }
  return out
}

function printHelp() {
  console.log(`Usage:
  node scripts/push-manta-sample-to-comet.mjs --file <path.xml> --record-group <rg> [options]
  node scripts/push-manta-sample-to-comet.mjs --file <path.xml> --uuid <uuid> [options]

Options:
  --file            Path to sample XML (cwd-relative or absolute)
  --record-group    Required for new import (no --uuid)
  --uuid            Existing CoMET record → proxy action=update
  --description     Record title; default: mission.title or basename(--file)
  --validate        Run lenient validatePilotState after sanitize (log only)
  --help

Env:
  COMET_SESSION_ID   Sent as X-Comet-JSessionId (optional if username/password set)
  COMET_USERNAME     With COMET_PASSWORD → POST action=login via proxy for JSESSIONID
  COMET_PASSWORD     CoMET password (never commit)
  COMET_PROXY_URL    Default ${DEFAULT_PROXY_BASE}
`)
}

/**
 * @param {string} id
 */
function sessionPrefix(id) {
  const s = String(id || '').trim()
  if (!s) return '(none)'
  return `${s.slice(0, 8)}…`
}

/**
 * @param {string} proxyBase
 * @param {string} username
 * @param {string} password
 * @returns {Promise<string>}
 */
async function loginFreshSession(proxyBase, username, password) {
  const loginUrl = `${proxyBase.replace(/\/$/, '')}?action=login`
  const body = new URLSearchParams({ username, password }).toString()
  let res
  try {
    res = await fetch(loginUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
      body,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Login request failed: ${msg}`)
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Login: expected JSON, got HTTP ${res.status}: ${text.trim().slice(0, 200)}`)
  }

  if (!data?.ok) {
    const err = data?.error ? String(data.error) : 'not ok'
    throw new Error(`Login failed (${res.status}): ${err}`)
  }

  const jsessionid = String(data.jsessionid || '').trim()
  if (!jsessionid) {
    throw new Error('Login response ok but missing jsessionid')
  }

  return jsessionid
}

const args = parseArgs(process.argv)
if (args.help) {
  printHelp()
  process.exit(0)
}

const fileArg = String(args.file || '').trim()
if (!fileArg) {
  console.error('Missing --file')
  printHelp()
  process.exit(1)
}

const uuidArg = String(args.uuid || '').trim()
const recordGroup = String(args.recordgroup || '').trim()
if (!uuidArg && !recordGroup) {
  console.error('New import requires --record-group (or pass --uuid for update).')
  process.exit(1)
}

const xmlPath = path.resolve(process.cwd(), fileArg)
const proxyBase = String(process.env.COMET_PROXY_URL || DEFAULT_PROXY_BASE).trim()

try {
  await assertCometProxyReachable(proxyBase)
} catch (e) {
  console.error(e instanceof Error ? e.message : String(e))
  process.exit(1)
}

let sessionId = String(process.env.COMET_SESSION_ID || '').trim()
if (!sessionId) {
  const username = String(process.env.COMET_USERNAME || '').trim()
  const password = String(process.env.COMET_PASSWORD || '').trim()
  if (!username || !password) {
    console.error('Set COMET_SESSION_ID, or both COMET_USERNAME and COMET_PASSWORD (proxy login).')
    process.exit(1)
  }
  try {
    sessionId = await loginFreshSession(proxyBase, username, password)
    console.log(`CoMET session: ok (${sessionPrefix(sessionId)})`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(msg)
    process.exit(1)
  }
}

const { validatePilotState } = await import(path.join(ROOT, 'src/lib/pilotValidation.js'))

let pilot
let isoXml
let baseName
try {
  ;({ isoXml, baseName, pilot } = await runSampleThroughPreview(xmlPath))
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
}

if (args.validate) {
  const vr = validatePilotState('lenient', pilot)
  const errs = (vr.issues || []).filter((i) => i.severity === 'e').length
  const warns = (vr.issues || []).filter((i) => i.severity === 'w').length
  console.log(`validate (lenient): ${errs} errors, ${warns} warnings`)
}

let description = String(args.description || '').trim()
if (!description) {
  const title = String(pilot?.mission?.title || '').trim()
  description = title || baseName.replace(/\.xml$/i, '') || baseName
}

let endpoint
if (uuidArg) {
  const params = new URLSearchParams({ action: 'update', uuid: uuidArg })
  if (description) params.set('description', description)
  endpoint = `${proxyBase}?${params}`
} else {
  const params = new URLSearchParams({
    action: 'import',
    recordGroup,
    description,
  })
  endpoint = `${proxyBase}?${params}`
}

let res
try {
  res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/xml',
      'X-Comet-JSessionId': sessionId,
    },
    body: isoXml,
  })
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(`Request failed: ${msg}`)
  process.exit(1)
}

const bodyText = await res.text()
const snippet = bodyText.trim().slice(0, 800)
console.log(`HTTP ${res.status}`)
console.log(snippet ? `${snippet}${bodyText.length > 800 ? '…' : ''}` : '(empty body)')

if (!res.ok) process.exit(1)
