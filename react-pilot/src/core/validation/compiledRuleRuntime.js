import missionCompiled from '../../../compiled_rules/mission.json'
import collectionCompiled from '../../../compiled_rules/collection.json'
import granuleCompiled from '../../../compiled_rules/granule.json'

const BUNDLES = {
  mission: missionCompiled,
  collection: collectionCompiled,
  granule: granuleCompiled,
}

const PROFILE_TO_RECORD_TYPE = {
  mission: 'mission',
  collection: 'collection',
  bediCollection: 'collection',
  bediGranule: 'granule',
}

function getPath(obj, key) {
  if (!obj || !key) return undefined
  const parts = String(key).split('.')
  let cur = obj
  for (const part of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

function isBlank(v) {
  if (Array.isArray(v)) return v.length === 0
  return v == null || (typeof v === 'string' && v.trim() === '')
}

function toNumber(v) {
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function valueOf(expr, ctx) {
  if (typeof expr === 'string' && expr.includes('.')) return getPath(ctx, expr)
  return expr
}

function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') return true
  const entries = Object.entries(condition)
  if (entries.length !== 1) return false
  const [[op, raw]] = entries
  const args = Array.isArray(raw) ? raw : [raw]
  switch (op) {
    case 'and':
      return args.every((c) => evaluateCondition(c, context))
    case 'or':
      return args.some((c) => evaluateCondition(c, context))
    case 'not':
      return !evaluateCondition(args[0], context)
    case 'eq': {
      const [a, b] = args.map((x) => valueOf(x, context))
      return a === b
    }
    case 'neq': {
      const [a, b] = args.map((x) => valueOf(x, context))
      return a !== b
    }
    case 'exists': {
      const v = valueOf(args[0], context)
      return !isBlank(v)
    }
    case 'missing': {
      const v = valueOf(args[0], context)
      return isBlank(v)
    }
    case 'matches': {
      const [valueExpr, reExpr] = args
      const v = String(valueOf(valueExpr, context) ?? '')
      return new RegExp(String(reExpr || '')).test(v)
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const [a, b] = args.map((x) => toNumber(valueOf(x, context)))
      if (Number.isNaN(a) || Number.isNaN(b)) return false
      if (op === 'gt') return a > b
      if (op === 'gte') return a >= b
      if (op === 'lt') return a < b
      return a <= b
    }
    default:
      return false
  }
}

function parseConditionExpr(text) {
  const raw = String(text || '').trim()
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function shouldFailRule(rule, state) {
  const requirement = String(rule.requirement || '')
  const fieldKey = String(rule.field_key || '')
  const value = getPath(state, fieldKey)
  if (requirement === 'required' && isBlank(value)) return true
  if (requirement === 'forbidden' && !isBlank(value)) return true
  if (requirement === 'conditional') {
    const cond = parseConditionExpr(rule.condition_expr)
    if (!cond) return false
    const conditionMatched = evaluateCondition(cond, state)
    if (!conditionMatched) return false
    if (isBlank(value)) return true
  }

  const pattern = String(rule.pattern_regex || '').trim()
  if (pattern && !isBlank(value)) {
    const text = Array.isArray(value) ? value.join(',') : String(value)
    try {
      if (!new RegExp(pattern).test(text)) return true
    } catch {
      return false
    }
  }
  return false
}

export function getCompiledRuleIssues(profileId, state) {
  const recordType = PROFILE_TO_RECORD_TYPE[profileId]
  if (!recordType) return []
  const bundle = BUNDLES[recordType]
  if (!bundle?.fields || typeof bundle.fields !== 'object') return []
  const out = []
  for (const [fieldKey, compiled] of Object.entries(bundle.fields)) {
    const winner = compiled?.winner
    if (!winner || typeof winner !== 'object') continue
    if (!shouldFailRule(winner, state)) continue
    const sev = String(winner.severity || '').toLowerCase()
    out.push({
      id: `compiled.${profileId}.${String(winner.rule_id || fieldKey)}`,
      field: fieldKey,
      path: fieldKey,
      severity: sev === 'block' ? 'e' : 'w',
      source: 'compiled',
      message: String(winner.message || `Compiled rule failed: ${fieldKey}`),
      detail: `rule_set=${String(winner.rule_set || '')}; requirement=${String(winner.requirement || '')}`,
      xpath: winner.xpath ? String(winner.xpath) : undefined,
    })
  }
  return out
}

