import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCsv } from './_csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

const RECORD_TYPES = ['mission', 'collection', 'granule']
const RANK_SEVERITY = { block: 3, warn: 2, info: 1 }
const RANK_REQUIREMENT = { forbidden: 4, required: 3, conditional: 2, recommended: 1 }

function isActive(v) {
  return ['true', '1', 'yes'].includes(String(v).toLowerCase())
}

function specificity(ruleRecordType, target) {
  return ruleRecordType === target ? 2 : 1
}

function score(rule, target, priorities) {
  return [
    Number(priorities[rule.rule_set] ?? 0),
    specificity(rule.record_type, target),
    Number(RANK_SEVERITY[rule.severity] ?? 0),
    Number(RANK_REQUIREMENT[rule.requirement] ?? 0),
    Number(rule.version || 0),
  ]
}

function compareTuple(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return b[i] - a[i]
  }
  return 0
}

function strictestPick(rules) {
  return [...rules].sort((a, b) => (RANK_REQUIREMENT[b.requirement] ?? 0) - (RANK_REQUIREMENT[a.requirement] ?? 0))[0]
}

const rules = readCsv(path.join(ROOT, 'rules/rule.csv')).filter((r) => isActive(r.active))
const priorityRows = readCsv(path.join(ROOT, 'rules/rule_set_priority.csv')).filter((r) => isActive(r.active))
const conflictRows = readCsv(path.join(ROOT, 'rules/rule_conflict_resolution.csv')).filter((r) => isActive(r.active) && r.conflict_id)

const priorities = Object.fromEntries(priorityRows.map((r) => [r.rule_set, Number(r.priority)]))
const conflicts = new Map(conflictRows.map((r) => [`${r.record_type}:${r.field_key}`, r]))

fs.mkdirSync(path.join(ROOT, 'compiled_rules'), { recursive: true })

for (const target of RECORD_TYPES) {
  const applicable = rules.filter((r) => r.record_type === target || r.record_type === 'any')
  const byField = new Map()
  for (const r of applicable) {
    const key = r.field_key
    const arr = byField.get(key) ?? []
    arr.push(r)
    byField.set(key, arr)
  }

  const compiled = {}
  const unresolvedTies = []
  for (const [fieldKey, candidates] of byField.entries()) {
    const ranked = [...candidates].sort((a, b) => compareTuple(score(a, target, priorities), score(b, target, priorities)))
    let winner = ranked[0]
    const tie = ranked.filter((r) => compareTuple(score(r, target, priorities), score(winner, target, priorities)) === 0)
    const override = conflicts.get(`${target}:${fieldKey}`) || conflicts.get(`any:${fieldKey}`)
    if (override) {
      winner = ranked.find((r) => r.rule_set === override.winner_rule_set) ?? winner
      if (override.strategy === 'strictest') winner = strictestPick(ranked)
    } else if (tie.length > 1) {
      unresolvedTies.push({ fieldKey, candidates: tie.map((t) => t.rule_id) })
    }

    compiled[fieldKey] = {
      winner,
      losers: ranked.filter((r) => r.rule_id !== winner.rule_id).map((r) => r.rule_id),
      trace: ranked.map((r) => ({ rule_id: r.rule_id, score: score(r, target, priorities) })),
    }
  }

  const out = {
    recordType: target,
    generatedAt: new Date().toISOString(),
    unresolvedTies,
    fields: compiled,
  }
  fs.writeFileSync(path.join(ROOT, `compiled_rules/${target}.json`), JSON.stringify(out, null, 2) + '\n', 'utf8')
  console.log(`Compiled ${target}: ${Object.keys(compiled).length} field(s), ${unresolvedTies.length} unresolved tie(s).`)
}

