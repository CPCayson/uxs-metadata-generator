/**
 * MI_Instrument / coverage `gmd:description` lines aligned with `SchemaValidator.gs` `addAcquisitionInfo`.
 */

/** @typedef {{ variable: string, firmware: string, operationMode: string, uncertainty: string, frequency: string, beamCount: string, depthRating: string, confidenceInterval: string }} ParsedInstrumentDescription */

/**
 * Ordered matchers: first match wins (use most specific prefixes first).
 * @type {Array<{ keys: string[], pattern: RegExp }>}
 */
const DESCRIPTION_LINE_RULES = [
  { keys: ['firmware'], pattern: /^firmware version:\s*/i },
  { keys: ['firmware'], pattern: /^firmware:\s*/i },
  { keys: ['operationMode'], pattern: /^operation mode:\s*/i },
  { keys: ['uncertainty'], pattern: /^uncertainty estimate:\s*/i },
  { keys: ['frequency'], pattern: /^frequency:\s*/i },
  { keys: ['beamCount'], pattern: /^beam count:\s*/i },
  { keys: ['depthRating'], pattern: /^depth rating:\s*/i },
  { keys: ['confidenceInterval'], pattern: /^confidence interval:\s*/i },
]

/**
 * @returns {ParsedInstrumentDescription}
 */
function emptyParsedInstrumentDescription() {
  return {
    variable: '',
    firmware: '',
    operationMode: '',
    uncertainty: '',
    frequency: '',
    beamCount: '',
    depthRating: '',
    confidenceInterval: '',
  }
}

/**
 * @param {string} text
 * @returns {ParsedInstrumentDescription}
 */
export function parseInstrumentDescriptionBlock(text) {
  const out = emptyParsedInstrumentDescription()
  const raw = String(text || '').trim()
  if (!raw) return out

  const prose = []
  const lines = raw.split('\n').map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    let matched = false
    for (const rule of DESCRIPTION_LINE_RULES) {
      if (!rule.pattern.test(line)) continue
      const value = line.replace(rule.pattern, '').trim()
      for (const key of rule.keys) {
        if (value) out[/** @type {keyof ParsedInstrumentDescription} */ (key)] = value
      }
      matched = true
      break
    }
    if (!matched) prose.push(line)
  }
  out.variable = prose.join('\n').trim()
  return out
}

/**
 * @param {Record<string, unknown> | null | undefined} sensor
 * @param {{ includeVariableLine?: boolean }} [opts]
 * @returns {string}
 */
export function buildAcquisitionInstrumentDescription(sensor, opts) {
  const includeVariableLine = opts?.includeVariableLine !== false
  /** @type {string[]} */
  const lines = []
  if (includeVariableLine) {
    const v = String(sensor?.variable || '').trim()
    if (v) lines.push(v)
  }
  const pairs = /** @type {const} */ ([
    ['firmware', 'Firmware Version:'],
    ['operationMode', 'Operation Mode:'],
    ['uncertainty', 'Uncertainty Estimate:'],
    ['frequency', 'Frequency:'],
    ['beamCount', 'Beam Count:'],
    ['depthRating', 'Depth Rating:'],
    ['confidenceInterval', 'Confidence Interval:'],
  ])
  for (const [key, label] of pairs) {
    const val = String(sensor?.[key] || '').trim()
    if (val) lines.push(`${label} ${val}`)
  }
  return lines.join('\n')
}

/**
 * Default optional keys merged on sensors (XML + form).
 * @type {Readonly<Record<string, string>>}
 */
export const SENSOR_XML_OPTIONAL_DEFAULTS = Object.freeze({
  operationMode: '',
  uncertainty: '',
  frequency: '',
  beamCount: '',
  depthRating: '',
  confidenceInterval: '',
})

/** Labels for optional sensor fields (form + XML import). */
export const SENSOR_XML_EXTRA_FIELD_LABELS = Object.freeze({
  operationMode: 'Operation mode',
  uncertainty: 'Uncertainty estimate',
  frequency: 'Frequency',
  beamCount: 'Beam count',
  depthRating: 'Depth rating',
  confidenceInterval: 'Confidence interval',
})

/**
 * @param {Record<string, unknown>} row
 * @returns {string}
 */
export function sensorInstrumentDedupeKey(row) {
  const keys = [
    'sensorId',
    'type',
    'variable',
    'firmware',
    'operationMode',
    'uncertainty',
    'frequency',
    'beamCount',
    'depthRating',
    'confidenceInterval',
  ]
  return keys.map((k) => String(row[k] ?? '').trim()).join('\t')
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function acquisitionInstrumentHasContent(row) {
  return sensorInstrumentDedupeKey(row)
    .split('\t')
    .some((cell) => cell.length > 0)
}
