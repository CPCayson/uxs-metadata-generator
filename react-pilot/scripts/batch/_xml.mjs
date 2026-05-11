/**
 * Shared batch XML engine.
 * Provides: XML loading from file/folder/zip/WAF, namespace-safe parsing,
 * URL extraction, UUID extraction, and JSON report helpers.
 *
 * @module scripts/batch/_xml
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import http from 'node:http'
import { createHash } from 'node:crypto'
import { DOMParser } from '@xmldom/xmldom'

// ── xmldom polyfill ─────────────────────────────────────────────────────────

let _polyfillDone = false
export function ensureXmldomPolyfill() {
  if (_polyfillDone) return
  _polyfillDone = true
  const probe = new DOMParser().parseFromString('<a><b/></a>', 'application/xml').documentElement
  const proto = Object.getPrototypeOf(probe)
  if (!Object.getOwnPropertyDescriptor(proto, 'children')) {
    Object.defineProperty(proto, 'children', {
      get() {
        const out = []
        const nodes = this.childNodes || []
        for (let i = 0; i < nodes.length; i += 1) {
          if (nodes[i] && nodes[i].nodeType === 1) out.push(nodes[i])
        }
        return out
      },
    })
  }
  globalThis.DOMParser = DOMParser
}

ensureXmldomPolyfill()

// ── XML parse ───────────────────────────────────────────────────────────────

export function parseXml(text) {
  const parser = new DOMParser()
  return parser.parseFromString(text, 'application/xml')
}

// ── Node text helpers ────────────────────────────────────────────────────────

function nodeText(node) {
  if (!node) return ''
  return (node.textContent || node.text || '').trim()
}

function elementsByLocalName(doc, localName) {
  const result = []
  const all = doc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i += 1) {
    const n = all[i]
    const ln = n.localName || n.nodeName.split(':').pop()
    if (ln === localName) result.push(n)
  }
  return result
}

// ── URL extraction ───────────────────────────────────────────────────────────

const URL_ATTR_NS = ['xlink:href', 'href']
const URL_ELEMENTS = [
  'URL', 'linkage', 'url', 'graphicOverview', 'fileName',
  'onlineResource', 'CI_OnlineResource',
]

export function extractUrls(doc) {
  const urls = new Set()

  // attribute-based: xlink:href
  const all = doc.getElementsByTagName('*')
  for (let i = 0; i < all.length; i += 1) {
    const n = all[i]
    for (const attr of URL_ATTR_NS) {
      const v = n.getAttribute(attr) || n.getAttributeNS('http://www.w3.org/1999/xlink', 'href')
      if (v && v.startsWith('http')) urls.add(v.trim())
    }
  }

  // element text content
  for (const localName of URL_ELEMENTS) {
    const nodes = elementsByLocalName(doc, localName)
    for (const n of nodes) {
      const t = nodeText(n)
      if (t.startsWith('http')) urls.add(t)
    }
  }

  return [...urls]
}

// ── UUID extraction ──────────────────────────────────────────────────────────

/** RFC 4122 UUID string (incl. version nibble 1–5). */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Same bytes as Python `uuid.NAMESPACE_URL`. */
const NAMESPACE_URL_BYTES = Buffer.from('6ba7b8119dad11d180b400c04fd430c8', 'hex')

/**
 * UUID v5 — matches Python `uuid.uuid5(uuid.NAMESPACE_URL, name)`.
 * @param {string} name UTF-8 name string (e.g. `gov.noaa.ncei.oer:STEM`)
 */
export function uuidV5NamespaceUrl(name) {
  const hash = createHash('sha1')
    .update(NAMESPACE_URL_BYTES)
    .update(name, 'utf8')
    .digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = (bytes[6] & 0x0f) | 0x50 // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80 // variant RFC 4122
  const h = bytes.toString('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

function extractFileIdentifierText(doc) {
  const fi = elementsByLocalName(doc, 'fileIdentifier')
  if (fi.length === 0) return ''
  const cs = elementsByLocalName(fi[0], 'CharacterString')
  if (cs.length === 0) return ''
  return nodeText(cs[0])
}

/**
 * Canonical record UUID for batch audits:
 * 1. Root `gmi:MI_Metadata` / `gmd:MD_Metadata` `uuid` when it is a valid UUID.
 * 2. BEDI granules: Python generator uses UUID v5 from `gov.noaa.ncei.oer:{stem}` — replicate when
 *    root uuid is absent but fileIdentifier matches that pattern (not `*_COLLECTION`).
 * 3. Bare UUID in fileIdentifier only.
 */
export function extractUuid(doc) {
  const roots = ['MI_Metadata', 'MD_Metadata']
  for (const rn of roots) {
    const nodes = elementsByLocalName(doc, rn)
    if (nodes.length > 0) {
      const v = (nodes[0].getAttribute('uuid') || nodes[0].getAttribute('id') || '').trim()
      if (v && UUID_RE.test(v)) return v
    }
  }

  const fi = extractFileIdentifierText(doc)
  if (fi.startsWith('gov.noaa.ncei.oer:')) {
    const tail = fi.slice('gov.noaa.ncei.oer:'.length).trim()
    // Cruise collection ids use registry UUID on the root — do not invent a v5 from the stem.
    if (tail.endsWith('_COLLECTION')) return null
    return uuidV5NamespaceUrl(fi.trim())
  }

  if (fi && UUID_RE.test(fi)) return fi.trim()
  return null
}

// ── Image URL extraction ─────────────────────────────────────────────────────

export function extractImageUrls(doc) {
  const images = []
  const overviews = elementsByLocalName(doc, 'MD_BrowseGraphic')
  for (const ov of overviews) {
    const fn = elementsByLocalName(ov, 'fileName')
    const desc = elementsByLocalName(ov, 'fileDescription')
    const url = fn.length > 0 ? nodeText(fn[0]) : ''
    const label = desc.length > 0 ? nodeText(desc[0]) : ''
    if (url) images.push({ url, label })
  }
  // also plain graphicOverview text
  const plain = elementsByLocalName(doc, 'graphicOverview')
  for (const p of plain) {
    const t = nodeText(p)
    if (t.startsWith('http') && !images.find((i) => i.url === t)) {
      images.push({ url: t, label: '' })
    }
  }
  return images
}

// ── DocuComp detection ────────────────────────────────────────────────────────

export function isDocucompUrl(url) {
  return url.includes('docucomp') || url.includes('DocuComp')
}

// ── NODD / cloud detection ────────────────────────────────────────────────────

const NODD_PATTERNS = [
  'noaa-nodd', 'noaa_nodd', 'nodd.noaa', 'registry.opendata.aws',
  'ncei.noaa.gov/products', 'ncei.noaa.gov/archive',
]
export function isNoddUrl(url) {
  const lower = url.toLowerCase()
  return NODD_PATTERNS.some((p) => lower.includes(p))
}

const OSDD_PATTERNS = [
  'opensearch', 'osdd', 'catalog.data.gov', 'data.noaa.gov',
]
export function isOsddUrl(url) {
  const lower = url.toLowerCase()
  return OSDD_PATTERNS.some((p) => lower.includes(p))
}

// ── File loading ─────────────────────────────────────────────────────────────

export function loadXmlFile(filePath) {
  const text = fs.readFileSync(filePath, 'utf8')
  const doc = parseXml(text)
  return { filePath, text, doc }
}

export function loadXmlDir(dirPath) {
  const results = []
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  for (const e of entries) {
    const full = path.join(dirPath, e.name)
    if (e.isDirectory()) {
      results.push(...loadXmlDir(full))
    } else if (e.isFile() && e.name.endsWith('.xml')) {
      try {
        results.push(loadXmlFile(full))
      } catch {
        // skip unreadable
      }
    }
  }
  return results
}

// ── HTTP fetch helpers ────────────────────────────────────────────────────────

export function fetchText(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http
    const req = client.get(url, { headers: { 'User-Agent': 'manta-batch-auditor/1.0' } }, (res) => {
      const chunks = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error('timeout')) })
  })
}

export async function checkUrl(url, timeoutMs = 10000) {
  try {
    const client = url.startsWith('https') ? https : http
    const result = await new Promise((resolve, reject) => {
      const req = client.get(url, { headers: { 'User-Agent': 'manta-batch-auditor/1.0' } }, (res) => {
        res.resume()
        resolve({ ok: res.statusCode < 400, status: res.statusCode })
      })
      req.on('error', (e) => resolve({ ok: false, status: 0, error: e.message }))
      req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, status: 0, error: 'timeout' }) })
    })
    return result
  } catch (e) {
    return { ok: false, status: 0, error: String(e.message) }
  }
}

// ── WAF manifest fetch ────────────────────────────────────────────────────────

export async function fetchWafManifest(wafUrl) {
  const { status, body } = await fetchText(wafUrl)
  if (status >= 400) throw new Error(`WAF returned HTTP ${status}`)
  const doc = parseXml(body)
  const xmlLinks = []

  // Try OpenSearch/OSDD or plain directory listing / WAF index patterns
  // Look for <a href="...xml"> or gmd:onlineResource patterns
  const anchors = doc.getElementsByTagName('a')
  for (let i = 0; i < anchors.length; i += 1) {
    const href = anchors[i].getAttribute('href') || ''
    if (href.endsWith('.xml') || href.endsWith('.XML')) {
      const abs = href.startsWith('http') ? href : new URL(href, wafUrl).toString()
      xmlLinks.push(abs)
    }
  }

  // Fallback: any xlink:href or URL element ending in .xml
  const urls = extractUrls(doc).filter((u) => u.endsWith('.xml') || u.endsWith('.XML'))
  for (const u of urls) {
    if (!xmlLinks.includes(u)) xmlLinks.push(u)
  }

  return { wafUrl, xmlLinks, rawBody: body }
}

// ── Report helpers ────────────────────────────────────────────────────────────

export function writeCsv(filePath, rows, headers) {
  const escape = (v) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(','))
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')
}

export function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8')
}
