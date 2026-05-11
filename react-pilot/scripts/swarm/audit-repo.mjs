#!/usr/bin/env node
/**
 * Swarm repo audit — read-only checks that mirror CI-adjacent gates (no CoMET proxy required).
 *
 *   node scripts/swarm/audit-repo.mjs
 *   node scripts/swarm/audit-repo.mjs --skip-regress
 *
 * @module scripts/swarm/audit-repo
 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const SWARM = path.join(ROOT, 'scripts/swarm')

function parseArgs(argv) {
  const out = { skipRegress: false, skipImportAudit: false }
  for (const a of argv) {
    if (a === '--skip-regress') out.skipRegress = true
    if (a === '--skip-import-audit') out.skipImportAudit = true
  }
  return out
}

function runStep(label, cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    shell: false,
    ...opts,
  })
  const ok = r.status === 0
  const stderr = (r.stderr || '').trim()
  const stdout = (r.stdout || '').trim()
  return {
    label,
    ok,
    code: r.status,
    stderr: stderr ? stderr.slice(0, 2000) : '',
    stdout: stdout ? stdout.slice(0, 2000) : '',
  }
}

const args = parseArgs(process.argv.slice(2))

/** @type {ReturnType<typeof runStep>[]} */
const steps = []

steps.push(runStep('swarm:validate (rule CSV)', process.execPath, [path.join(SWARM, 'validate-rules-csv.mjs')]))
steps.push(runStep('swarm:compile', process.execPath, [path.join(SWARM, 'compile-rules.mjs')]))
steps.push(runStep('swarm:qa (rule quality)', process.execPath, [path.join(SWARM, 'check-rules-quality.mjs')]))

if (!args.skipRegress) {
  steps.push(
    runStep('regress-mission-validity (local XML)', process.execPath, [
      path.join(SWARM, 'regress-mission-validity.mjs'),
    ]),
  )
}

const cleanFixture = path.join(ROOT, 'fixtures/mission/navy-uxs-swarm-clean.xml')
const legacyNavy = path.join(ROOT, '..', 'NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml')
let importXml = ''
if (!args.skipImportAudit) {
  if (fs.existsSync(cleanFixture)) importXml = cleanFixture
  else if (fs.existsSync(legacyNavy)) importXml = legacyNavy
  if (importXml) {
    const reportOut = path.join(ROOT, 'fixtures/mission/_import-audit-report.json')
    steps.push(
      runStep('audit-mission-import (sample XML)', process.execPath, [
        path.join(SWARM, 'audit-mission-import.mjs'),
        '--xml',
        importXml,
        '--report-out',
        reportOut,
      ]),
    )
  } else {
    steps.push({
      label: 'audit-mission-import (skipped — no default fixture)',
      ok: true,
      code: 0,
      stderr: '',
      stdout: 'Pass --xml or add fixtures/mission/navy-uxs-swarm-clean.xml',
    })
  }
}

const failed = steps.filter((s) => !s.ok)
const report = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  overallOk: failed.length === 0,
  steps: steps.map((s) => ({
    label: s.label,
    ok: s.ok,
    exitCode: s.code,
    ...(s.stderr ? { stderr: s.stderr } : {}),
    ...(s.stdout ? { stdout: s.stdout } : {}),
  })),
}

const reportPath = path.join(ROOT, 'fixtures/mission/_repo-audit-report.json')
fs.mkdirSync(path.dirname(reportPath), { recursive: true })
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8')

for (const s of steps) {
  const mark = s.ok ? '✓' : '✗'
  console.log(`${mark} ${s.label}`)
  if (!s.ok && s.stderr) console.log(s.stderr)
}

console.log('')
console.log(`Wrote ${reportPath}`)
console.log(failed.length === 0 ? 'Swarm repo audit: all steps passed.' : `Swarm repo audit: ${failed.length} step(s) failed.`)

process.exit(failed.length === 0 ? 0 : 1)
