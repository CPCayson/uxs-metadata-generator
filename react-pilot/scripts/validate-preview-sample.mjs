#!/usr/bin/env node
/**
 * Local NOAA ISO 19139 schema check on `buildXmlPreview` output (NCRMP merge sample).
 *
 * xmllint often cannot fetch `https://data.noaa.gov/.../schema.xsd` (TLS / libxml); this script
 * mirrors the XSD dependency tree once into a cache dir, then validates.
 *
 * Env:
 *   NOAA_ISO19139_SCHEMA_DIR — cache directory (default: /tmp/noaa-iso19139)
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

import { defaultPilotState, mergeLoadedPilotState, sanitizePilotState } from '../src/lib/pilotValidation.js'
import { buildXmlPreview } from '../src/lib/xmlPreviewBuilder.js'
import { importPilotPartialStateFromXml } from '../src/lib/xmlPilotImport.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const SAMPLE = path.join(ROOT, '..', '..', 'MANTA End User Testing', 'samples', 'NCRMP-Benthic-FG.xml')
const CACHE = process.env.NOAA_ISO19139_SCHEMA_DIR?.trim() || '/tmp/noaa-iso19139'
const SCHEMA = path.join(CACHE, 'schema.xsd')
const PREVIEW_OUT = path.join(CACHE, 'ncrmp-preview-validate.xml')

function xmllintOk() {
  const r = spawnSync('xmllint', ['--version'], { encoding: 'utf8' })
  return !r.error && r.status === 0
}

async function ensureSchemaMirror() {
  if (fs.existsSync(SCHEMA)) return
  fs.mkdirSync(CACHE, { recursive: true })
  const base = 'https://data.noaa.gov/resources/iso19139/'
  const seen = new Set()
  const queue = ['schema.xsd']
  async function fetchText(rel) {
    const url = new URL(rel, base).href
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return await res.text()
  }
  while (queue.length) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    seen.add(rel)
    const text = await fetchText(rel)
    const absOut = path.join(CACHE, rel)
    fs.mkdirSync(path.dirname(absOut), { recursive: true })
    fs.writeFileSync(absOut, text)
    const dir = path.posix.dirname(rel) === '.' ? '' : path.posix.dirname(rel) + '/'
    for (const m of text.matchAll(/schemaLocation\s*=\s*"([^"]+)"/g)) {
      let next = m[1].trim()
      if (next.startsWith('http')) continue
      const resolved = path.posix.normalize(dir + next)
      if (!seen.has(resolved)) queue.push(resolved)
    }
  }
  console.error(`Mirrored ${seen.size} XSD files to ${CACHE}`)
}

function main() {
  if (!xmllintOk()) {
    console.error('xmllint not found (install libxml2 / libxml2-utils).')
    process.exit(1)
  }
  if (!fs.existsSync(SAMPLE)) {
    console.error(`Sample not found: ${SAMPLE}`)
    process.exit(2)
  }

  globalThis.DOMParser = DOMParser
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

  const xmlIn = fs.readFileSync(SAMPLE, 'utf8')
  const parsed = importPilotPartialStateFromXml(xmlIn)
  if (!parsed.ok) {
    console.error('Import failed:', parsed.error || 'unknown')
    process.exit(1)
  }
  const merged = sanitizePilotState(mergeLoadedPilotState(defaultPilotState(), parsed.partial))
  const preview = buildXmlPreview(merged)
  fs.mkdirSync(CACHE, { recursive: true })
  fs.writeFileSync(PREVIEW_OUT, preview)

  ensureSchemaMirror()
    .then(() => {
      const r = spawnSync('xmllint', ['--noout', '--schema', SCHEMA, PREVIEW_OUT], { encoding: 'utf8' })
      if (r.status !== 0) {
        console.error('Schema validation failed.')
        if (r.stderr) console.error(r.stderr.trimEnd())
        if (r.stdout) console.error(r.stdout.trimEnd())
        process.exit(1)
      }
      console.log(`OK (NOAA schema): ${PREVIEW_OUT}`)
    })
    .catch((e) => {
      console.error(String(e?.message || e))
      console.error(
        'Could not mirror schema (network). Set NOAA_ISO19139_SCHEMA_DIR to an offline tree or retry on a connected machine.',
      )
      process.exit(1)
    })
}

main()
