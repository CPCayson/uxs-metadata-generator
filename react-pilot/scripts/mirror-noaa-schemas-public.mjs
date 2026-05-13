#!/usr/bin/env node
/**
 * Mirror full NOAA ISO 19139 XSD closure into public/schemas for in-browser xmllint-wasm.
 * Writes public/schemas/manifest.json listing { name, path } for the validator hook.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(ROOT, '..', 'public', 'schemas')
const BASE = 'https://data.noaa.gov/resources/iso19139/'

async function mirror() {
  fs.rmSync(OUT, { recursive: true, force: true })
  fs.mkdirSync(OUT, { recursive: true })
  const seen = new Set()
  const queue = ['schema.xsd']
  async function fetchText(rel) {
    const url = new URL(rel, BASE).href
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status} ${url}`)
    return await res.text()
  }
  while (queue.length) {
    const rel = queue.shift()
    if (seen.has(rel)) continue
    seen.add(rel)
    const text = await fetchText(rel)
    const absOut = path.join(OUT, rel)
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
  const names = [...seen].sort()
  const manifest = names.map((name) => ({
    name,
    path: `/schemas/${name.replace(/^\/+/, '')}`,
  }))
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  console.error(`Mirrored ${names.length} XSD files to ${OUT}`)
  console.error(`Wrote manifest with ${manifest.length} entries`)
}

mirror().catch((e) => {
  console.error(e)
  process.exit(1)
})
