import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCsv } from './_csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

function isActive(v) {
  return ['true', '1', 'yes'].includes(String(v).toLowerCase())
}

const rules = readCsv(path.join(ROOT, 'rules/rule.csv')).filter((r) => isActive(r.active))
const fieldMaps = readCsv(path.join(ROOT, 'rules/field_map.csv')).filter((r) => isActive(r.active))
const compiledDir = path.join(ROOT, 'compiled_rules')

const mapKeys = new Set(fieldMaps.map((m) => `${m.record_type}:${m.normalized_field_key}`))
const warnings = []
const errors = []

for (const r of rules) {
  if ((r.severity === 'block' || r.requirement === 'required') && r.record_type !== 'any') {
    const hasExact = mapKeys.has(`${r.record_type}:${r.field_key}`)
    const hasAny = mapKeys.has(`any:${r.field_key}`)
    if (!hasExact && !hasAny) {
      errors.push(`Missing field_map for critical rule ${r.rule_id} (${r.record_type}:${r.field_key})`)
    }
  }
  if (r.requirement === 'conditional' && !r.condition_expr) {
    errors.push(`Conditional rule ${r.rule_id} missing condition_expr`)
  }
}

if (fs.existsSync(compiledDir)) {
  for (const file of ['mission.json', 'collection.json', 'granule.json']) {
    const p = path.join(compiledDir, file)
    if (!fs.existsSync(p)) {
      warnings.push(`Compiled artifact missing: ${file}`)
      continue
    }
    const data = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (Array.isArray(data.unresolvedTies) && data.unresolvedTies.length > 0) {
      warnings.push(`${file} has ${data.unresolvedTies.length} unresolved tie(s)`)
    }
  }
} else {
  warnings.push('compiled_rules directory is missing (run compile first)')
}

if (warnings.length) {
  console.warn(`Quality warnings (${warnings.length}):`)
  warnings.forEach((w) => console.warn(`- ${w}`))
}

if (errors.length) {
  console.error(`Quality checks failed (${errors.length}):`)
  errors.forEach((e) => console.error(`- ${e}`))
  process.exit(1)
}

console.log('Rule quality checks passed.')

