#!/usr/bin/env node
/**
 * BEDI template link checker — parity with `bedi_renderer/link_resolver.py`.
 *
 * Extracts http(s) URLs from a template XML, applies `[*Placeholder*]` substitutions,
 * then HEAD (fallback GET). TLS verification failures can be skipped like Python.
 *
 * Usage:
 *   node scripts/bedi/link-resolve-template.mjs /path/to/template.xml
 *   node scripts/bedi/link-resolve-template.mjs template.xml --subs my.json
 *   node scripts/bedi/link-resolve-template.mjs template.xml --write-report reports/link-check.md
 *   node scripts/bedi/link-resolve-template.mjs template.xml --insecure-ssl
 *   node scripts/bedi/link-resolve-template.mjs template.xml --fail-on-ssl
 */

import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Mirrors `DEFAULT_PLACEHOLDER_SUBS` in bedi_renderer/link_resolver.py */
export const DEFAULT_PLACEHOLDER_SUBS = {
  '[*AccessionNumber*]': '0039615',
  '[*FileIdentifier*]':
    'gov.noaa.ncei.oer:BIOLUM2009_VID_20090721_SIT_DIVE_JSL2-3681_TAPE1OF2_SEG1OF1',
  '[*OerPortalFileKey*]': 'BIOLUM2009_VID_20090721_SIT_DIVE_JSL2-3681_TAPE1OF2_SEG1OF1',
  '[*ExtentId*]': 'BIOLUM2009_VID_20090721_SIT_DIVE_JSL2-3681_TAPE1OF2_SEG1OF1.MP4_Extents',
  '[*CruiseCollectionKey*]': 'BIOLUM2009_COLLECTION',
  '[*DiveVideoFileNameHiRes*]': 'Biolum2009_VID_20090721_DIVE_JSL2-3681_SIT_TAPE1_SEG1.mp4',
  '[*cruiseid*]': 'Biolum2009',
  '[*CruiseID*]': 'Biolum2009',
  '[*HighlightFileIdentifier*]': 'ETTA2004_VID_20040820_DIVE_HIGHLIGHTS_3CHIP_TAPE1_SEG1',
}

const URL_PATTERN = /https?:\/\/[^\s"'<>]+/g
const PLACEHOLDER_TOKEN = /\[\*[^*]+\*\]/
const USER_AGENT = 'Manta-bedi-template-link-check/1.0 (+https://www.noaa.gov/)'

function extractRawUrls(text) {
  const found = []
  let m
  const re = new RegExp(URL_PATTERN.source, 'g')
  while ((m = re.exec(text)) !== null) {
    let u = m[0].replace(/[.,;)}'"']+$/, '')
    while (u.endsWith('>') || u.endsWith('/')) u = u.slice(0, -1)
    found.push(u)
  }
  const seen = new Set()
  return found.filter((u) => (seen.has(u) ? false : (seen.add(u), true)))
}

function normalizeSubsKeys(raw) {
  const out = {}
  for (const [k, v] of Object.entries(raw)) {
    const ks = String(k).trim()
    const vs = v == null ? '' : String(v)
    if (ks.startsWith('[*') && ks.endsWith('*]')) out[ks] = vs
    else out[`[*${ks}*]`] = vs
  }
  return out
}

function loadSubsFile(p) {
  const data = JSON.parse(fs.readFileSync(p, 'utf8'))
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error(`Subs file must be a JSON object: ${p}`)
  }
  return normalizeSubsKeys(data)
}

function effectiveSubs(overlayPath) {
  const merged = { ...DEFAULT_PLACEHOLDER_SUBS }
  if (overlayPath && fs.existsSync(overlayPath)) {
    Object.assign(merged, loadSubsFile(overlayPath))
  }
  return merged
}

function applyPlaceholderSubs(url, subs) {
  let s = url
  for (const [k, v] of Object.entries(subs)) {
    s = s.split(k).join(v)
  }
  return s
}

function looksLikeTlsVerifyFailure(reason) {
  const s = String(reason).toLowerCase()
  return (
    s.includes('certificate_verify_failed') ||
    s.includes('certificate verify failed') ||
    s.includes('ssl: wrong_version') ||
    (s.startsWith('ssl:') && s.includes('verify'))
  )
}

/**
 * @returns {Promise<{ status: number | null, note: string, skippedTls: boolean }>}
 */
async function requestUrl(url, timeoutMs, insecureSsl) {
  const u = new URL(url)
  const isHttps = u.protocol === 'https:'
  const lib = isHttps ? https : http
  const baseOpts = {
    hostname: u.hostname,
    port: u.port || (isHttps ? 443 : 80),
    path: u.pathname + u.search,
    headers: { 'User-Agent': USER_AGENT, Accept: '*/*' },
    timeout: timeoutMs,
  }
  if (isHttps && insecureSsl) {
    baseOpts.rejectUnauthorized = false
  }

  const tryReq = (method) =>
    new Promise((resl) => {
      const req = lib.request({ ...baseOpts, method }, (res) => {
        res.resume()
        resl({ status: res.statusCode ?? null, note: '' })
      })
      req.on('error', (err) => resl({ status: null, note: err.message }))
      req.on('timeout', () => {
        req.destroy()
        resl({ status: null, note: 'timeout' })
      })
      req.end()
    })

  const head = await tryReq('HEAD')

  if (head.status === null && !insecureSsl && looksLikeTlsVerifyFailure(head.note)) {
    return {
      status: null,
      note: `SKIPPED (TLS/CAC — ${head.note}); use --insecure-ssl to test or fix trust store`,
      skippedTls: true,
    }
  }

  if (head.status != null && head.status < 400) {
    return { status: head.status, note: head.note || 'OK', skippedTls: false }
  }

  if (head.status === 405 || head.status === 501) {
    const get = await tryReq('GET')
    if (get.status != null && get.status < 400) {
      return { status: get.status, note: 'via GET (HEAD not allowed)', skippedTls: false }
    }
    if (get.status === null && !insecureSsl && looksLikeTlsVerifyFailure(get.note)) {
      return {
        status: null,
        note: `SKIPPED (TLS/CAC — ${get.note}); use --insecure-ssl to test or fix trust store`,
        skippedTls: true,
      }
    }
    return { status: get.status, note: get.note || 'GET failed', skippedTls: false }
  }

  if (head.status != null && head.status >= 400) {
    const get = await tryReq('GET')
    if (get.status != null && get.status < 400) {
      return { status: get.status, note: 'via GET (HEAD returned error)', skippedTls: false }
    }
    if (get.status === null && !insecureSsl && looksLikeTlsVerifyFailure(get.note)) {
      return {
        status: null,
        note: `SKIPPED (TLS/CAC — ${get.note}); use --insecure-ssl to test or fix trust store`,
        skippedTls: true,
      }
    }
    return { status: head.status, note: head.note || `HTTP ${head.status}`, skippedTls: false }
  }

  return { status: head.status, note: head.note || 'HEAD failed', skippedTls: false }
}

async function checkUrls(urls, subs, { insecureSsl, timeoutMs }) {
  const rows = []
  const seenResolved = new Set()

  for (const raw of urls) {
    let resolved = applyPlaceholderSubs(raw, subs)
    const base = resolved.split('#')[0]
    const reqUrl = base || resolved

    if (PLACEHOLDER_TOKEN.test(reqUrl)) {
      rows.push({
        raw,
        status: null,
        detail: 'skipped: unresolved [*Placeholder*] in URL after subs (extend --subs or defaults)',
        resolved: reqUrl,
        skippedTls: false,
      })
      continue
    }
    if (seenResolved.has(reqUrl)) continue
    seenResolved.add(reqUrl)

    const { status, note, skippedTls } = await requestUrl(reqUrl, timeoutMs, insecureSsl)
    let detail = note
    if (skippedTls) detail = note
    else if (status === null) detail = note || 'request failed'
    else if (status >= 400) detail = `HTTP ${status}${note ? ` (${note})` : ''}`
    else detail = note || 'OK'

    rows.push({ raw, status, detail, resolved: reqUrl, skippedTls })
  }
  return rows
}

function parseArgs(argv) {
  const out = {
    positional: [],
    subs: null,
    extraUrls: null,
    writeReport: null,
    insecureSsl: false,
    failOnSsl: false,
    timeoutMs: 45000,
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--subs') out.subs = argv[++i]
    else if (a === '--extra-urls') out.extraUrls = argv[++i]
    else if (a === '--write-report') out.writeReport = argv[++i]
    else if (a === '--insecure-ssl') out.insecureSsl = true
    else if (a === '--fail-on-ssl') out.failOnSsl = true
    else if (a === '--timeout') out.timeoutMs = Number(argv[++i]) || 45000
    else if (!a.startsWith('-')) out.positional.push(a)
  }
  return out
}

function loadExtraUrls(p) {
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  return lines.map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const templatePath = opts.positional[0]
  if (!templatePath) {
    console.error(
      'Usage: node scripts/bedi/link-resolve-template.mjs <template.xml> [--subs file.json] [--extra-urls urls.txt] [--write-report out.md] [--insecure-ssl] [--fail-on-ssl]',
    )
    process.exit(2)
  }

  const abs = path.resolve(process.cwd(), templatePath)
  const text = fs.readFileSync(abs, 'utf8')
  let urls = extractRawUrls(text)
  if (opts.extraUrls) {
    const extra = loadExtraUrls(path.resolve(process.cwd(), opts.extraUrls))
    const seen = new Set(urls)
    for (const u of extra) {
      if (!seen.has(u)) {
        seen.add(u)
        urls.push(u)
      }
    }
  }

  const subsPath = opts.subs ? path.resolve(process.cwd(), opts.subs) : null
  const subs = effectiveSubs(subsPath)

  const rows = await checkUrls(urls, subs, {
    insecureSsl: opts.insecureSsl,
    timeoutMs: opts.timeoutMs,
  })

  const skippedTls = rows.filter((r) => r.skippedTls)
  const ok = rows.filter((r) => r.status != null && r.status < 400)
  const failures = rows.filter((r) => {
    if (r.status === null && r.skippedTls) return opts.failOnSsl
    if (r.status === null && !r.skippedTls) return true
    if (r.detail.startsWith('skipped:')) return false
    return r.status != null && r.status >= 400
  })

  const linesOut = []
  linesOut.push(`Template: ${abs}`)
  if (subsPath) linesOut.push(`Subs overlay: ${subsPath}`)
  linesOut.push(`URLs checked (unique after placeholder fill): ${rows.length}`)
  linesOut.push(`OK: ${ok.length}  Skipped (TLS/CAC): ${skippedTls.length}  Failed: ${failures.length}`)
  linesOut.push('')

  for (const r of rows) {
    const st = r.skippedTls ? 'skip' : r.status === null ? '?' : String(r.status)
    linesOut.push(`  [${st}] ${r.resolved} — ${r.detail}`)
    if (r.raw !== r.resolved && r.raw.includes('[*')) {
      const rawShort = r.raw.length > 160 ? `${r.raw.slice(0, 160)}...` : r.raw
      linesOut.push(`       raw: ${rawShort}`)
    }
  }
  console.log(linesOut.join('\n'))

  if (opts.writeReport) {
    const md = [
      '# Granule template link check (Manta)',
      '',
      `**Template:** \`${abs}\``,
      '',
      ...(subsPath ? [`**Subs overlay:** \`${subsPath}\``, ''] : []),
      `- **Rows:** ${rows.length}`,
      `- **OK (2xx/3xx):** ${ok.length}`,
      `- **Skipped (TLS/CAC):** ${skippedTls.length}`,
      `- **Failed or error:** ${failures.length}`,
      '',
      '## Results',
      '',
    ]
    for (const r of rows) {
      const st = r.skippedTls ? 'SKIP_TLS' : r.status != null && r.status < 400 ? 'OK' : 'FAIL'
      md.push(`- **${st}** \`${r.resolved}\` — ${r.detail}`)
    }
    const reportPath = path.resolve(process.cwd(), opts.writeReport)
    fs.mkdirSync(path.dirname(reportPath), { recursive: true })
    fs.writeFileSync(reportPath, md.join('\n') + '\n', 'utf8')
    console.error(`\nWrote ${reportPath}`)
  }

  process.exit(failures.length ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
