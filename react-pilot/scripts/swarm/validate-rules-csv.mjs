import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCsv } from './_csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

const RULE_PATH = path.join(ROOT, 'rules/rule.csv')
const FIELD_MAP_PATH = path.join(ROOT, 'rules/field_map.csv')
const PRIORITY_PATH = path.join(ROOT, 'rules/rule_set_priority.csv')
const CONFLICT_PATH = path.join(ROOT, 'rules/rule_conflict_resolution.csv')

const RECORD_TYPES = new Set(['mission', 'collection', 'granule', 'segment', 'any'])
const REQUIREMENTS = new Set(['required', 'recommended', 'forbidden', 'conditional'])
const SEVERITIES = new Set(['block', 'warn', 'info'])
const STRATEGIES = new Set(['priority', 'strictest', 'custom'])

function asBool(v) {
  return ['true', '1', 'yes'].includes(String(v).toLowerCase())
}

function assertFieldKey(k) {
  return /^[a-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)*$/.test(String(k || ''))
}

function assertRows(name, rows, checks) {
  const errs = []
  rows.forEach((row, idx) => {
    const rowNum = idx + 2
    for (const check of checks) {
      const msg = check(row)
      if (msg) errs.push(`${name}: row ${rowNum}: ${msg}`)
    }
  })
  return errs
}

const rules = readCsv(RULE_PATH)
const maps = readCsv(FIELD_MAP_PATH)
const priorities = readCsv(PRIORITY_PATH)
const conflicts = readCsv(CONFLICT_PATH)

const errors = [
  ...assertRows('rule.csv', rules, [
    (r) => (!r.rule_id ? 'rule_id is required' : ''),
    (r) => (!r.rule_set ? 'rule_set is required' : ''),
    (r) => (!RECORD_TYPES.has(r.record_type) ? `invalid record_type: ${r.record_type}` : ''),
    (r) => (!assertFieldKey(r.field_key) ? `invalid field_key: ${r.field_key}` : ''),
    (r) => (!REQUIREMENTS.has(r.requirement) ? `invalid requirement: ${r.requirement}` : ''),
    (r) => (!SEVERITIES.has(r.severity) ? `invalid severity: ${r.severity}` : ''),
    (r) => (r.requirement === 'conditional' && !r.condition_expr ? 'conditional rule missing condition_expr' : ''),
    (r) => (r.active && !asBool(r.active) && r.active !== 'false' ? `invalid active value: ${r.active}` : ''),
  ]),
  ...assertRows('field_map.csv', maps, [
    (r) => (!r.map_id ? 'map_id is required' : ''),
    (r) => (!assertFieldKey(r.normalized_field_key) ? `invalid normalized_field_key: ${r.normalized_field_key}` : ''),
    (r) => (!RECORD_TYPES.has(r.record_type) ? `invalid record_type: ${r.record_type}` : ''),
  ]),
  ...assertRows('rule_set_priority.csv', priorities, [
    (r) => (!r.rule_set ? 'rule_set is required' : ''),
    (r) => (Number.isNaN(Number(r.priority)) ? `priority must be numeric: ${r.priority}` : ''),
  ]),
  ...assertRows('rule_conflict_resolution.csv', conflicts, [
    (r) => (!r.conflict_id && Object.values(r).some((v) => String(v).trim()) ? 'conflict_id is required' : ''),
    (r) => (r.conflict_id && !RECORD_TYPES.has(r.record_type) ? `invalid record_type: ${r.record_type}` : ''),
    (r) => (r.conflict_id && !assertFieldKey(r.field_key) ? `invalid field_key: ${r.field_key}` : ''),
    (r) => (r.conflict_id && !STRATEGIES.has(r.strategy) ? `invalid strategy: ${r.strategy}` : ''),
  ]),
]

if (errors.length > 0) {
  console.error(`Validation failed with ${errors.length} error(s):`)
  errors.forEach((e) => console.error(`- ${e}`))
  process.exit(1)
}

console.log('Rule CSV validation passed.')

