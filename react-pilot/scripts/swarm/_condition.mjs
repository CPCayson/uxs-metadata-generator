function getPath(obj, key) {
  if (!key) return undefined
  const parts = String(key).split('.')
  let cur = obj
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = cur[p]
  }
  return cur
}

function toNumber(v) {
  if (typeof v === 'number') return v
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function isMissing(v) {
  return v == null || (typeof v === 'string' && v.trim() === '')
}

function valueOf(expr, ctx) {
  if (typeof expr === 'string' && expr.includes('.')) return getPath(ctx, expr)
  return expr
}

export function evaluateCondition(condition, context) {
  if (!condition || typeof condition !== 'object') return { matched: true, reason: 'empty condition' }
  const [[op, raw]] = Object.entries(condition)
  const args = Array.isArray(raw) ? raw : [raw]
  switch (op) {
    case 'and': {
      for (const c of args) {
        const res = evaluateCondition(c, context)
        if (!res.matched) return { matched: false, reason: `and failed: ${res.reason}` }
      }
      return { matched: true, reason: 'and passed' }
    }
    case 'or': {
      const results = args.map((c) => evaluateCondition(c, context))
      const ok = results.find((r) => r.matched)
      return ok || { matched: false, reason: `or failed: ${results.map((r) => r.reason).join('; ')}` }
    }
    case 'not': {
      const r = evaluateCondition(args[0], context)
      return { matched: !r.matched, reason: `not ${r.reason}` }
    }
    case 'eq': {
      const [a, b] = args.map((x) => valueOf(x, context))
      return { matched: a === b, reason: `eq(${String(a)}, ${String(b)})` }
    }
    case 'neq': {
      const [a, b] = args.map((x) => valueOf(x, context))
      return { matched: a !== b, reason: `neq(${String(a)}, ${String(b)})` }
    }
    case 'in': {
      const [needle, haystack] = args
      const n = valueOf(needle, context)
      const h = valueOf(haystack, context)
      const matched = Array.isArray(h) ? h.includes(n) : false
      return { matched, reason: `in(${String(n)})` }
    }
    case 'exists': {
      const v = valueOf(args[0], context)
      return { matched: !isMissing(v), reason: `exists(${String(args[0])})` }
    }
    case 'missing': {
      const v = valueOf(args[0], context)
      return { matched: isMissing(v), reason: `missing(${String(args[0])})` }
    }
    case 'matches': {
      const [vExpr, reExpr] = args
      const v = String(valueOf(vExpr, context) ?? '')
      const re = new RegExp(String(reExpr))
      return { matched: re.test(v), reason: `matches(${re})` }
    }
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte': {
      const [a, b] = args.map((x) => toNumber(valueOf(x, context)))
      if (Number.isNaN(a) || Number.isNaN(b)) return { matched: false, reason: `${op} numeric cast failed` }
      if (op === 'gt') return { matched: a > b, reason: `gt(${a},${b})` }
      if (op === 'gte') return { matched: a >= b, reason: `gte(${a},${b})` }
      if (op === 'lt') return { matched: a < b, reason: `lt(${a},${b})` }
      return { matched: a <= b, reason: `lte(${a},${b})` }
    }
    default:
      return { matched: false, reason: `unsupported operator: ${op}` }
  }
}

