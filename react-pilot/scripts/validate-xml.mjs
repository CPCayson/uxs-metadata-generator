#!/usr/bin/env node
/**
 * Well-formedness check via xmllint; optional XSD/RelaxNG when --schema is set.
 *
 * Usage:
 *   npm run validate:xml -- path/to/file.xml
 *   npm run validate:xml -- path/to/file.xml --schema https://example.org/schema.xsd
 *
 * Env: XML_SCHEMA — used as default --schema when the flag is omitted (still need a file argument).
 */

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

/**
 * @returns {string | null}
 */
function findXmllint() {
  const r = spawnSync('xmllint', ['--version'], { encoding: 'utf8' })
  if (r.error && /** @type {NodeJS.ErrnoException} */ (r.error).code === 'ENOENT') return null
  return r.status === 0 ? 'xmllint' : null
}

const argv = process.argv.slice(2)
let schema = process.env.XML_SCHEMA?.trim() || ''
const si = argv.indexOf('--schema')
if (si !== -1 && argv[si + 1]) {
  schema = argv[si + 1]
  argv.splice(si, 2)
}

const file = argv[0]
if (!file) {
  console.error(
    'Usage: npm run validate:xml -- <file.xml> [--schema <path-or-url>]\n' +
      'Requires xmllint (macOS: usually preinstalled; Debian/Ubuntu: libxml2-utils).',
  )
  process.exit(2)
}

const abs = path.resolve(process.cwd(), file)
if (!fs.existsSync(abs)) {
  console.error(`File not found: ${abs}`)
  process.exit(2)
}

const xmllint = findXmllint()
if (!xmllint) {
  console.error('xmllint not found. Install libxml2 and ensure xmllint is on PATH.')
  process.exit(1)
}

/** @type {string[]} */
const args = ['--noout']
if (schema) {
  args.push('--schema', schema)
}
args.push(abs)

const r = spawnSync(xmllint, args, { encoding: 'utf8' })
if (r.status !== 0) {
  console.error(schema ? 'XML failed schema or is not well-formed.' : 'XML is not well-formed.')
  if (r.stderr) console.error(r.stderr.trimEnd())
  if (r.stdout) console.error(r.stdout.trimEnd())
  process.exit(1)
}

if (schema) {
  console.log(`OK (schema): ${abs}`)
} else {
  console.log(`OK (well-formed): ${abs}`)
}
