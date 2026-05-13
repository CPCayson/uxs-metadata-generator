#!/usr/bin/env node
/**
 * MANTA EUT sample → import → merge → sanitize → buildXmlPreview → CoMET ISO validate
 * via netlify `comet-proxy` (same path as the app / `validateIsoXml` in `cometClient.js`).
 *
 * Obtains a fresh JSESSIONID each run (no long-lived `COMET_SESSION_ID` in env).
 *
 * Env:
 *   COMET_USERNAME, COMET_PASSWORD — forwarded as form login to proxy `action=login`
 *   COMET_PROXY_URL — optional; default `http://127.0.0.1:8888/api/comet-proxy` (base URL;
 *     login uses `?action=login`, validate uses `?action=isoValidate&filename=…`)
 *
 * Do not commit credentials. Session id is never logged in full (prefix only).
 */
import path from 'node:path'
import process from 'node:process'
import {
  DEFAULT_COMET_PROXY_BASE,
  DEFAULT_VALIDATE_FILENAME,
  isoValidate,
  loginFreshSession,
  sessionPrefix,
} from './lib/cometProxyManta.mjs'
import { runSampleThroughPreview } from './lib/runSampleThroughPreview.mjs'

function parseArgs(argv) {
  /** @type {Record<string, string|boolean>} */
  const out = {}
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--help' || a === '-h') {
      out.help = true
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
  node scripts/validate-manta-sample-comet.mjs --file <path.xml>

Options:
  --file     Sample XML (cwd-relative or absolute)
  --help

Env:
  COMET_USERNAME     CoMET login (required)
  COMET_PASSWORD     CoMET login (required)
  COMET_PROXY_URL    Optional; default ${DEFAULT_COMET_PROXY_BASE}
`)
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

const username = String(process.env.COMET_USERNAME || '').trim()
const password = String(process.env.COMET_PASSWORD || '').trim()
if (!username || !password) {
  console.error('COMET_USERNAME and COMET_PASSWORD must both be set (use placeholders in docs, never commit real values).')
  process.exit(1)
}

const proxyBase = String(process.env.COMET_PROXY_URL || DEFAULT_COMET_PROXY_BASE).trim()

try {
  const jsessionid = await loginFreshSession(proxyBase, username, password)
  console.log(`CoMET session: ok (${sessionPrefix(jsessionid)})`)

  const xmlPath = path.resolve(process.cwd(), fileArg)
  const { isoXml, baseName } = await runSampleThroughPreview(xmlPath)
  console.log(`Preview built from ${baseName} (${isoXml.length} chars)`)

  const { res, parsed, bodyText } = await isoValidate(proxyBase, jsessionid, isoXml, DEFAULT_VALIDATE_FILENAME)
  const snippet = bodyText.trim().slice(0, 2000)
  console.log(`HTTP ${res.status}`)
  console.log(typeof parsed === 'object' && parsed !== null && !parsed.raw ? JSON.stringify(parsed, null, 2) : snippet)

  if (!res.ok) process.exit(1)
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err)
  console.error(msg)
  process.exit(1)
}
