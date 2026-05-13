#!/usr/bin/env node
/**
 * Every `*.xml` under MANTA End User Testing/samples (or SAMPLE_DIR):
 * import → merge → sanitize → buildXmlPreview → CoMET `isoValidate` (same pipeline as
 * `validate-manta-sample-comet.mjs` / UI Tier 3).
 *
 * One CoMET login per run; reuses JSESSIONID for all files.
 *
 * Env (required):
 *   COMET_USERNAME, COMET_PASSWORD
 * Env (optional):
 *   COMET_PROXY_URL — default http://127.0.0.1:8888/api/comet-proxy
 *   SAMPLE_DIR — override samples folder
 *
 * Usage (from react-pilot/):
 *   COMET_USERNAME='…' COMET_PASSWORD='…' node scripts/validate-all-manta-samples-comet.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DEFAULT_COMET_PROXY_BASE, isoValidate, loginFreshSession, sessionPrefix } from './lib/cometProxyManta.mjs'
import { runSampleThroughPreview } from './lib/runSampleThroughPreview.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_SAMPLES = path.resolve(ROOT, '..', 'MANTA End User Testing', 'samples')

const SAMPLE_DIR = process.env.SAMPLE_DIR || DEFAULT_SAMPLES
const proxyBase = String(process.env.COMET_PROXY_URL || DEFAULT_COMET_PROXY_BASE).trim()

function listXmlFiles(dir) {
  const abs = path.resolve(dir)
  if (!fs.existsSync(abs)) {
    throw new Error(`SAMPLE_DIR not found: ${abs}`)
  }
  return fs
    .readdirSync(abs, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith('.xml'))
    .map((d) => path.join(abs, d.name))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
}

function summarize(parsed, bodyText, httpOk) {
  if (!httpOk) {
    const t = (bodyText || '').trim().slice(0, 120)
    return { ok: false, detail: t || 'HTTP error' }
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.ok === false) {
      return { ok: false, detail: String(parsed.error || parsed.message || 'ok:false') }
    }
  }
  return { ok: true, detail: 'ok' }
}

const username = String(process.env.COMET_USERNAME || '').trim()
const password = String(process.env.COMET_PASSWORD || '').trim()
if (!username || !password) {
  console.error('Set COMET_USERNAME and COMET_PASSWORD (do not commit real credentials).')
  process.exit(1)
}

const files = listXmlFiles(SAMPLE_DIR)
if (!files.length) {
  console.error(`No XML files under ${SAMPLE_DIR}`)
  process.exit(1)
}

console.log(`Samples: ${files.length} under ${SAMPLE_DIR}`)
console.log(`Proxy:   ${proxyBase}`)

let failed = 0
try {
  const jsessionid = await loginFreshSession(proxyBase, username, password)
  console.log(`CoMET session: ok (${sessionPrefix(jsessionid)})\n`)

  for (const xmlPath of files) {
    const base = path.basename(xmlPath)
    process.stdout.write(`${base} … `)
    try {
      const { isoXml } = await runSampleThroughPreview(xmlPath)
      const { res, parsed, bodyText } = await isoValidate(proxyBase, jsessionid, isoXml)
      const s = summarize(parsed, bodyText, res.ok)
      if (s.ok) {
        console.log(`✓ HTTP ${res.status}`)
      } else {
        console.log(`✗ HTTP ${res.status} — ${s.detail}`)
        failed += 1
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.log(`✗ ${msg}`)
      failed += 1
    }
  }
} catch (e) {
  const msg = e instanceof Error ? e.message : String(e)
  console.error(msg)
  process.exit(1)
}

console.log('')
if (failed) {
  console.error(`Done: ${failed}/${files.length} failed`)
  process.exit(1)
}
console.log(`Done: ${files.length}/${files.length} passed`)
