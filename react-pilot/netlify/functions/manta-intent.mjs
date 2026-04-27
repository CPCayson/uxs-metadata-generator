/**
 * Netlify function: natural-language intent parsing for Manta voice commands.
 *
 * Uses Gemini with a strict JSON response and returns:
 *   { ok: true, commands: MantaCommand[] }
 *
 * Required environment variable:
 *   GEMINI_API_KEY
 *
 * Optional:
 *   GEMINI_MODEL (default: gemini-2.5-flash)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models'

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * @param {unknown[]} list
 */
function sanitizeCommands(list) {
  if (!Array.isArray(list)) return []
  const out = []
  const seen = new Set()
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const type = typeof raw.type === 'string' ? raw.type : ''
    let cmd = null
    if (type === 'simple' && typeof raw.on === 'boolean') {
      cmd = { type: 'simple', on: raw.on }
    } else if (type === 'lens' && typeof raw.open === 'boolean') {
      cmd = { type: 'lens', open: raw.open }
    } else if (type === 'step' && typeof raw.id === 'string') {
      cmd = { type: 'step', id: raw.id.trim() }
    } else if (type === 'stepRelative' && (raw.delta === 1 || raw.delta === -1)) {
      cmd = { type: 'stepRelative', delta: raw.delta }
    } else if (type === 'map' && (raw.action === 'zoomIn' || raw.action === 'zoomOut' || raw.action === 'fit')) {
      cmd = { type: 'map', action: raw.action }
    } else if (type === 'widget' && (raw.action === 'open' || raw.action === 'close' || raw.action === 'toggle')) {
      cmd = { type: 'widget', action: raw.action }
    } else if (type === 'lensTarget' && (raw.target === 'xml' || raw.target === 'form' || raw.target === 'split')) {
      cmd = { type: 'lensTarget', target: raw.target }
    } else if (type === 'validationMode' && (raw.mode === 'lenient' || raw.mode === 'strict' || raw.mode === 'catalog')) {
      cmd = { type: 'validationMode', mode: raw.mode }
    } else if (type === 'assistantTab' && (raw.tab === 'validate' || raw.tab === 'ask' || raw.tab === 'search' || raw.tab === 'live' || raw.tab === 'comet')) {
      cmd = { type: 'assistantTab', tab: raw.tab }
    } else if (type === 'validateNow') {
      cmd = { type: 'validateNow' }
    } else if (type === 'autofix') {
      cmd = { type: 'autofix' }
    }
    if (!cmd) continue
    const key = JSON.stringify(cmd)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(cmd)
  }
  return out
}

function extractJson(text) {
  if (typeof text !== 'string') return null
  try {
    return JSON.parse(text)
  } catch {
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1))
      } catch {
        return null
      }
    }
    return null
  }
}

function buildPrompt(text, profileId, validStepIds) {
  const steps = Array.isArray(validStepIds) ? validStepIds.filter((s) => typeof s === 'string') : []
  return [
    'You map user speech to app commands.',
    'Return JSON only, no prose.',
    'Schema:',
    '{ "commands": [',
    '  {"type":"simple","on":true|false}',
    '  {"type":"lens","open":true|false}',
    '  {"type":"step","id":"<one valid step id>"}',
    '  {"type":"stepRelative","delta":1|-1}',
    '  {"type":"map","action":"zoomIn"|"zoomOut"|"fit"}',
    '  {"type":"widget","action":"open"|"close"|"toggle"}',
    '  {"type":"lensTarget","target":"xml"|"form"|"split"}',
    '  {"type":"validationMode","mode":"lenient"|"strict"|"catalog"}',
    '  {"type":"assistantTab","tab":"validate"|"ask"|"search"|"live"|"comet"}',
    '  {"type":"validateNow"}',
    '  {"type":"autofix"}',
    '] }',
    '',
    'Rules:',
    '- Output only commands the app can execute.',
    '- Prefer no command over guessing.',
    '- Use step.id only from validStepIds.',
    '- If the phrase means "check forms", include lens open and validateNow.',
    '- If phrase says "wrap around forms", include lens open and lensTarget form.',
    '',
    `profileId: ${profileId || ''}`,
    `validStepIds: ${JSON.stringify(steps)}`,
    `utterance: ${JSON.stringify(String(text || ''))}`,
  ].join('\n')
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const apiKey = process.env.GEMINI_API_KEY
  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  if (!apiKey) return json({ ok: false, error: 'GEMINI_API_KEY is not configured on the server' }, 500)

  let body
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }
  const text = String(body?.text ?? '').trim()
  const profileId = String(body?.profileId ?? '').trim()
  const validStepIds = Array.isArray(body?.validStepIds) ? body.validStepIds : []
  if (!text) return json({ ok: true, commands: [] })

  const prompt = buildPrompt(text, profileId, validStepIds)
  const url = `${GEMINI_URL}/${encodeURIComponent(model)}:generateContent`

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          responseMimeType: 'application/json',
        },
      }),
    })
    const raw = await upstream.text()
    if (!upstream.ok) {
      return json({ ok: false, error: `Gemini request failed (${upstream.status})`, detail: raw.slice(0, 400) }, 502)
    }
    let payload = null
    try {
      payload = JSON.parse(raw)
    } catch {
      return json({ ok: false, error: 'Invalid upstream response' }, 502)
    }
    const textOut = payload?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const parsed = extractJson(textOut)
    const commands = sanitizeCommands(parsed?.commands)
    return json({ ok: true, commands })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return json({ ok: false, error: msg }, 502)
  }
}

