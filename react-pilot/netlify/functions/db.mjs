/**
 * Netlify serverless function — unified database API (Neon / PostgreSQL).
 *
 * Unified Postgres-backed API for the React pilot (Neon serverless driver).
 * Netlify automatically provides DATABASE_URL when the Neon integration is connected.
 *
 * Routes (POST body: { fn, args }):
 *   getPlatforms          → SELECT all platforms
 *   savePlatform          → UPSERT one platform
 *   getSensors            → SELECT all sensors
 *   saveSensor            → UPSERT one sensor
 *   saveSensorsBatch      → UPSERT array of sensors
 *   getTemplates          → SELECT all templates
 *   getTemplate           → SELECT one template by name
 *   saveTemplate          → UPSERT one template
 *   deleteTemplate        → DELETE template by name
 *   logValidation         → INSERT into validation_log
 *
 * Stateless (no DATABASE_URL required):
 *   generateGeoJSON       → args [formData] — legacy collectFormData shape
 *   generateDCAT          → args [formData] — DCAT JSON-LD string
 *   validateOnServer      → args [formData, level] — `basic`|`strict` (from pilot) → React engine
 *   lensScan              → args [{ title?, abstract?, xmlSnippet?, profileId?, uxsContext? }] — heuristic ScannerSuggestionEnvelope (no DB)
 */

import { neon } from '@neondatabase/serverless'
import { generateDCATString, generateGeoJSONString } from './lib/legacyGeoDcat.mjs'
import { legacyFormDataToPilotState } from '../../src/core/mappers/legacyFormDataMapper.js'
import { ValidationEngine } from '../../src/core/validation/ValidationEngine.js'
import { missionValidationRuleSets } from '../../src/profiles/mission/missionValidationRules.js'
import { runLensScanHeuristic } from '../../src/lib/lensScanHeuristic.js'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })

function getDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is not set. Connect the Neon integration in Netlify → ' +
      'Integrations → Neon, or set DATABASE_URL manually in Site settings → Environment variables.'
    )
  }
  return neon(process.env.DATABASE_URL)
}

/** Ensure the assets and deployments tables exist. */
async function ensureAssetsSchema(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS assets (
        id            TEXT PRIMARY KEY,
        platform_id   TEXT,
        serial_number TEXT,
        name          TEXT,
        owner_org     TEXT,
        status        TEXT DEFAULT 'active',
        notes         TEXT,
        created_at    TIMESTAMPTZ DEFAULT now()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS asset_sensor_configs (
        id               SERIAL PRIMARY KEY,
        asset_id         TEXT REFERENCES assets(id),
        sensor_id        TEXT,
        installed_at     DATE,
        removed_at       DATE,
        calibration_date DATE,
        serial_number    TEXT,
        firmware         TEXT,
        notes            TEXT
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS asset_deployments (
        id          TEXT PRIMARY KEY,
        asset_id    TEXT REFERENCES assets(id),
        cruise_id   TEXT,
        dive_id     TEXT,
        start_time  TIMESTAMPTZ,
        end_time    TIMESTAMPTZ,
        area        TEXT,
        notes       TEXT
      )
    `
  } catch (err) {
    console.error('[db] ensureAssetsSchema error:', err.message)
  }
}

/** Ensure the sensors table has all expected columns (safe to call on every request). */
async function ensureSensorsSchema(sql) {
  try {
    await sql`ALTER TABLE sensors ADD COLUMN IF NOT EXISTS platform_id TEXT DEFAULT ''`
    await sql`ALTER TABLE sensors ADD COLUMN IF NOT EXISTS observed_variable TEXT DEFAULT ''`
  } catch {
    // Table may not exist yet — silently ignore; getSensors will fail descriptively if so.
  }
}

/**
 * React pilot sensor cards use `sensorId` / `modelId`; the DB layer expects `id` / `model`.
 * @param {unknown} raw
 * @returns {Record<string, unknown>}
 */
function normalizeSensorPayload(raw) {
  const s =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw)
          } catch {
            throw new Error('Sensor payload must be valid JSON or a plain object')
          }
        })()
      : raw && typeof raw === 'object' && !Array.isArray(raw)
        ? { ...raw }
        : {}
  const id = String(s.id ?? s.sensorId ?? '').trim()
  const model = String(s.model ?? s.modelId ?? '').trim()
  const platform_id = String(s.platform_id ?? s.platformId ?? '').trim()
  const observed_variable = String(s.observed_variable ?? s.observedVariable ?? s.variable ?? '').trim()
  return { ...s, id, model, platform_id, observed_variable }
}

function intOrZero(v) {
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

// ── Platforms ──────────────────────────────────────────────────────────────

async function getPlatforms(sql) {
  const rows = await sql`
    SELECT id, name, type, manufacturer, model,
           weight, length, width, height,
           power_source AS "powerSource",
           navigation_system AS "navigationSystem",
           comments, serial_number AS "serialNumber",
           deployment_date AS "deploymentDate"
    FROM platforms
    ORDER BY name
  `
  return rows
}

async function savePlatform(sql, [platform]) {
  const raw = typeof platform === 'string' ? JSON.parse(platform) : platform
  const id = String(raw?.id ?? raw?.platformId ?? '').trim()
  if (!id) throw new Error('Platform id is required')
  /** Pilot `platform` step uses platformName / platformType / platformDesc. */
  const p = {
    ...raw,
    id,
    name: String(raw.name ?? raw.platformName ?? '').trim() || id,
    type: String(raw.type ?? raw.platformType ?? raw.customPlatformType ?? '').trim(),
    comments: String(raw.comments ?? raw.platformDesc ?? '').trim(),
  }
  await sql`
    INSERT INTO platforms (
      id, name, type, manufacturer, model,
      weight, length, width, height,
      power_source, navigation_system,
      comments, serial_number, deployment_date, updated_at
    ) VALUES (
      ${p.id}, ${p.name ?? ''}, ${p.type ?? ''}, ${p.manufacturer ?? ''},
      ${p.model ?? ''}, ${p.weight ?? 0}, ${p.length ?? 0}, ${p.width ?? 0},
      ${p.height ?? 0}, ${p.powerSource ?? ''}, ${p.navigationSystem ?? ''},
      ${p.comments ?? ''}, ${p.serialNumber ?? ''}, ${p.deploymentDate ?? ''},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      name              = EXCLUDED.name,
      type              = EXCLUDED.type,
      manufacturer      = EXCLUDED.manufacturer,
      model             = EXCLUDED.model,
      weight            = EXCLUDED.weight,
      length            = EXCLUDED.length,
      width             = EXCLUDED.width,
      height            = EXCLUDED.height,
      power_source      = EXCLUDED.power_source,
      navigation_system = EXCLUDED.navigation_system,
      comments          = EXCLUDED.comments,
      serial_number     = EXCLUDED.serial_number,
      deployment_date   = EXCLUDED.deployment_date,
      updated_at        = NOW()
  `
  return getPlatforms(sql)
}

// ── Sensors ────────────────────────────────────────────────────────────────

async function getSensors(sql, args = []) {
  await ensureSensorsSchema(sql)
  const platformId = args[0] != null ? String(args[0]).trim() : ''
  if (platformId) {
    const rows = await sql`
      SELECT
        id, type, firmware,
        install_date           AS "installDate",
        uncertainty,
        operation_mode         AS "operationMode",
        frequency,
        beam_count             AS "beamCount",
        depth_rating           AS "depthRating",
        confidence_interval    AS "confidenceInterval",
        sensor_language        AS "sensorLanguage",
        sensor_character_set   AS "sensorCharacterSet",
        event,
        pressure_range         AS "pressureRange",
        conductivity_range     AS "conductivityRange",
        temperature_range      AS "temperatureRange",
        manufacturer, model,
        serial_number          AS "serialNumber",
        calibration_date       AS "calibrationDate",
        accuracy, resolution,
        power_requirement      AS "powerRequirement",
        data_format            AS "dataFormat",
        communication_protocol AS "communicationProtocol",
        operating_temperature  AS "operatingTemperature",
        operating_pressure     AS "operatingPressure",
        dimensions, weight, warranty, notes,
        platform_id            AS "platformId",
        observed_variable      AS "observedVariable"
      FROM sensors
      WHERE platform_id = ${platformId}
      ORDER BY id
    `
    return rows
  }
  const rows = await sql`
    SELECT
      id, type, firmware,
      install_date           AS "installDate",
      uncertainty,
      operation_mode         AS "operationMode",
      frequency,
      beam_count             AS "beamCount",
      depth_rating           AS "depthRating",
      confidence_interval    AS "confidenceInterval",
      sensor_language        AS "sensorLanguage",
      sensor_character_set   AS "sensorCharacterSet",
      event,
      pressure_range         AS "pressureRange",
      conductivity_range     AS "conductivityRange",
      temperature_range      AS "temperatureRange",
      manufacturer, model,
      serial_number          AS "serialNumber",
      calibration_date       AS "calibrationDate",
      accuracy, resolution,
      power_requirement      AS "powerRequirement",
      data_format            AS "dataFormat",
      communication_protocol AS "communicationProtocol",
      operating_temperature  AS "operatingTemperature",
      operating_pressure     AS "operatingPressure",
      dimensions, weight, warranty, notes,
      platform_id            AS "platformId",
      observed_variable      AS "observedVariable"
    FROM sensors
    ORDER BY id
  `
  return rows
}

async function saveSensor(sql, [sensor]) {
  const s = normalizeSensorPayload(sensor)
  if (!s?.id) throw new Error('Sensor id is required')
  await upsertSensor(sql, s)
  return getSensors(sql, [])
}

async function saveSensorsBatch(sql, [sensors]) {
  const arr = typeof sensors === 'string' ? JSON.parse(sensors) : sensors
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('No sensors provided')
  for (const raw of arr) {
    await upsertSensor(sql, normalizeSensorPayload(raw))
  }
  return getSensors(sql, [])
}

async function upsertSensor(sql, raw) {
  const s = normalizeSensorPayload(raw)
  if (!s?.id) throw new Error('Sensor id is required')
  const pid = String(s.platform_id ?? '').trim()
  const ov = String(s.observed_variable ?? '').trim()
  await sql`
    INSERT INTO sensors (
      id, type, firmware, install_date, uncertainty, operation_mode,
      frequency, beam_count, depth_rating, confidence_interval,
      sensor_language, sensor_character_set, event,
      pressure_range, conductivity_range, temperature_range,
      manufacturer, model, serial_number, calibration_date,
      accuracy, resolution, power_requirement, data_format,
      communication_protocol, operating_temperature, operating_pressure,
      dimensions, weight, warranty, notes, platform_id, observed_variable, updated_at
    ) VALUES (
      ${s.id}, ${s.type ?? ''}, ${s.firmware ?? ''}, ${s.installDate ?? ''},
      ${s.uncertainty ?? ''}, ${s.operationMode ?? ''}, ${s.frequency ?? ''},
      ${intOrZero(s.beamCount)}, ${s.depthRating ?? ''}, ${s.confidenceInterval ?? ''},
      ${s.sensorLanguage ?? ''}, ${s.sensorCharacterSet ?? ''}, ${s.event ?? ''},
      ${s.pressureRange ?? ''}, ${s.conductivityRange ?? ''}, ${s.temperatureRange ?? ''},
      ${s.manufacturer ?? ''}, ${s.model ?? ''}, ${s.serialNumber ?? ''},
      ${s.calibrationDate ?? ''}, ${s.accuracy ?? ''}, ${s.resolution ?? ''},
      ${s.powerRequirement ?? ''}, ${s.dataFormat ?? ''}, ${s.communicationProtocol ?? ''},
      ${s.operatingTemperature ?? ''}, ${s.operatingPressure ?? ''},
      ${s.dimensions ?? ''}, ${s.weight ?? ''}, ${s.warranty ?? ''}, ${s.notes ?? ''},
      ${pid}, ${ov},
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      type = EXCLUDED.type, firmware = EXCLUDED.firmware,
      install_date = EXCLUDED.install_date, uncertainty = EXCLUDED.uncertainty,
      operation_mode = EXCLUDED.operation_mode, frequency = EXCLUDED.frequency,
      beam_count = EXCLUDED.beam_count, depth_rating = EXCLUDED.depth_rating,
      confidence_interval = EXCLUDED.confidence_interval,
      sensor_language = EXCLUDED.sensor_language,
      sensor_character_set = EXCLUDED.sensor_character_set,
      event = EXCLUDED.event, pressure_range = EXCLUDED.pressure_range,
      conductivity_range = EXCLUDED.conductivity_range,
      temperature_range = EXCLUDED.temperature_range,
      manufacturer = EXCLUDED.manufacturer, model = EXCLUDED.model,
      serial_number = EXCLUDED.serial_number,
      calibration_date = EXCLUDED.calibration_date,
      accuracy = EXCLUDED.accuracy, resolution = EXCLUDED.resolution,
      power_requirement = EXCLUDED.power_requirement,
      data_format = EXCLUDED.data_format,
      communication_protocol = EXCLUDED.communication_protocol,
      operating_temperature = EXCLUDED.operating_temperature,
      operating_pressure = EXCLUDED.operating_pressure,
      dimensions = EXCLUDED.dimensions, weight = EXCLUDED.weight,
      warranty = EXCLUDED.warranty, notes = EXCLUDED.notes,
      platform_id = EXCLUDED.platform_id,
      observed_variable = EXCLUDED.observed_variable,
      updated_at = NOW()
  `
}

// ── Assets ─────────────────────────────────────────────────────────────────

async function getAssets(sql) {
  await ensureAssetsSchema(sql)
  return await sql`
    SELECT a.*, p.name AS "platformName", p.type AS "platformType"
    FROM assets a
    LEFT JOIN platforms p ON a.platform_id = p.id
    ORDER BY a.name
  `
}

async function getAsset(sql, [id]) {
  await ensureAssetsSchema(sql)
  const rows = await sql`
    SELECT a.*, 
      (SELECT json_agg(aconf.*) FROM asset_sensor_configs aconf 
       WHERE aconf.asset_id = a.id 
       AND (aconf.removed_at IS NULL OR aconf.removed_at > NOW())) as sensor_configs
    FROM assets a
    WHERE a.id = ${id}
  `
  return rows[0] ?? null
}

async function saveAsset(sql, [asset]) {
  await ensureAssetsSchema(sql)
  const a = typeof asset === 'string' ? JSON.parse(asset) : asset
  if (!a.id) throw new Error('Asset id is required')
  
  await sql`
    INSERT INTO assets (id, platform_id, serial_number, name, owner_org, status, notes)
    VALUES (${a.id}, ${a.platform_id || a.platformId}, ${a.serial_number || a.serialNumber}, ${a.name}, ${a.owner_org || a.ownerOrg}, ${a.status || 'active'}, ${a.notes || ''})
    ON CONFLICT (id) DO UPDATE SET
      platform_id   = EXCLUDED.platform_id,
      serial_number = EXCLUDED.serial_number,
      name          = EXCLUDED.name,
      owner_org     = EXCLUDED.owner_org,
      status        = EXCLUDED.status,
      notes         = EXCLUDED.notes
  `
  return getAssets(sql)
}

async function seedAssets(sql) {
  await ensureAssetsSchema(sql)
  
  // 1. Asset
  await sql`
    INSERT INTO assets (id, platform_id, serial_number, name, owner_org, status)
    VALUES ('remus-620-401', 'remus-620', '401', 'REMUS 620 Unit 401', 'EN2501', 'active')
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      serial_number = EXCLUDED.serial_number
  `

  // 2. Sensors
  const configs = [
    { sensor_id: 'PDVL 300', sn: 'SN-PDVL-401' },
    { sensor_id: 'PHINS INS', sn: 'SN-PHINS-401' },
    { sensor_id: 'Kraken SAS', sn: 'SN-SAS-401' }
  ]

  for (const c of configs) {
    await sql`
      INSERT INTO asset_sensor_configs (asset_id, sensor_id, installed_at, serial_number)
      VALUES ('remus-620-401', ${c.sensor_id}, '2025-01-01', ${c.sn})
      ON CONFLICT DO NOTHING
    `
  }
  
  return { ok: true, message: 'Seeded remus-620-401' }
}

async function getAssetSensors(sql, [assetId, date]) {
  await ensureAssetsSchema(sql)
  const d = date || new Date().toISOString().split('T')[0]
  return await sql`
    SELECT aconf.*, s.*
    FROM asset_sensor_configs aconf
    JOIN sensors s ON s.id = aconf.sensor_id  
    WHERE aconf.asset_id = ${assetId}
      AND aconf.installed_at <= ${d}
      AND (aconf.removed_at IS NULL OR aconf.removed_at > ${d})
  `
}

// ── Templates ──────────────────────────────────────────────────────────────

async function getTemplates(sql) {
  const rows = await sql`SELECT name, category, data FROM templates ORDER BY name`
  return rows
}

async function getTemplate(sql, [name]) {
  const rows = await sql`SELECT name, category, data FROM templates WHERE name = ${name}`
  return rows[0] ?? null
}

async function saveTemplate(sql, [template]) {
  const t = typeof template === 'string' ? JSON.parse(template) : template
  if (!t?.name?.trim()) throw new Error('Template name is required')
  await sql`
    INSERT INTO templates (name, category, data, updated_at)
    VALUES (${t.name}, ${t.category ?? ''}, ${JSON.stringify(t.data ?? {})}, NOW())
    ON CONFLICT (name) DO UPDATE SET
      category   = EXCLUDED.category,
      data       = EXCLUDED.data,
      updated_at = NOW()
  `
  return getTemplates(sql)
}

async function deleteTemplate(sql, [name]) {
  await sql`DELETE FROM templates WHERE name = ${name}`
  return getTemplates(sql)
}

// ── Validation log ─────────────────────────────────────────────────────────

async function logValidation(sql, [missionId, result]) {
  await sql`
    INSERT INTO validation_log (mission_id, result) VALUES (${missionId ?? ''}, ${JSON.stringify(result ?? {})})
  `
  return { ok: true }
}

function parseJsonMaybe(value) {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

/** GAS `validateFormDataWithRules` uses basic/strict; React engine uses lenient/strict/catalog. */
function gasValidationLevelToMode(level) {
  const l = String(level ?? 'basic').toLowerCase()
  if (l === 'basic' || l === 'lenient') return 'lenient'
  if (l === 'catalog') return 'catalog'
  return 'strict'
}

async function generateGeoJSON(_sql, args) {
  const [raw] = args
  return generateGeoJSONString(parseJsonMaybe(raw))
}

async function generateDCAT(_sql, args) {
  const [raw] = args
  return generateDCATString(parseJsonMaybe(raw))
}

async function validateOnServer(_sql, args) {
  const [raw, level = 'basic'] = args
  const formData = parseJsonMaybe(raw)
  const pilotState = legacyFormDataToPilotState(formData)
  const mode       = gasValidationLevelToMode(level)
  const engine     = new ValidationEngine()
  const result     = engine.run({
    profile: { id: 'mission', validationRuleSets: missionValidationRuleSets },
    state: pilotState,
    mode,
  })
  const issues = (result.issues ?? []).map((i) => ({
    id:       i.id,
    severity: i.severity,
    field:    i.field,
    path:     i.path || i.field,
    source:   'server',
    message:  i.message,
    detail:   i.detail,
    xpath:    i.xpath,
    readinessBundleIds: i.readinessBundleIds,
  }))
  const summary = `Score ${result.score}/100 — ${result.errCount} error(s), ${result.warnCount} warning(s).`
  return { issues, summary }
}

async function lensScan(_sql, args) {
  const [raw] = args
  const p = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {}
  return runLensScanHeuristic({
    title:      typeof p.title === 'string' ? p.title : '',
    abstract:   typeof p.abstract === 'string' ? p.abstract : '',
    xmlSnippet: typeof p.xmlSnippet === 'string' ? p.xmlSnippet : '',
    profileId:  typeof p.profileId === 'string' ? p.profileId : '',
    uxsContext: p.uxsContext,
    fileId:     typeof p.fileId === 'string' ? p.fileId : '',
  })
}

// ── Router ─────────────────────────────────────────────────────────────────

const NO_DATABASE_FNS = new Set(['generateGeoJSON', 'generateDCAT', 'validateOnServer', 'lensScan'])

const ROUTES = {
  getPlatforms:     (sql, args) => getPlatforms(sql),
  savePlatform:     (sql, args) => savePlatform(sql, args),
  getSensors:       (sql, args) => getSensors(sql, args),
  saveSensor:       (sql, args) => saveSensor(sql, args),
  saveSensorsBatch: (sql, args) => saveSensorsBatch(sql, args),
  getAssets:        (sql, args) => getAssets(sql),
  getAsset:         (sql, args) => getAsset(sql, args),
  saveAsset:        (sql, args) => saveAsset(sql, args),
  getAssetSensors:  (sql, args) => getAssetSensors(sql, args),
  seedAssets:       (sql, args) => seedAssets(sql),
  getTemplates:     (sql, args) => getTemplates(sql),
  getTemplate:      (sql, args) => getTemplate(sql, args),
  saveTemplate:     (sql, args) => saveTemplate(sql, args),
  deleteTemplate:   (sql, args) => deleteTemplate(sql, args),
  logValidation:    (sql, args) => logValidation(sql, args),
  generateGeoJSON,
  generateDCAT,
  validateOnServer,
  lensScan,
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  let fn, args
  try {
    ;({ fn, args = [] } = await req.json())
  } catch {
    return json({ ok: false, error: 'Invalid JSON body' }, 400)
  }

  const handler = ROUTES[fn]
  if (!handler) {
    console.warn('[db] unknown fn:', String(fn))
    return json({ ok: false, error: `Unknown function: ${fn}` }, 404)
  }

  const started = Date.now()
  try {
    let result
    if (NO_DATABASE_FNS.has(fn)) {
      result = await handler(null, args)
    } else {
      const sql = getDb()
      result = await handler(sql, args)
    }
    const ms = Date.now() - started
    // Netlify UI → Site → Functions → `db` → real-time / historical logs
    const tag = NO_DATABASE_FNS.has(fn) ? 'ok stateless' : 'ok'
    console.log(`[db] ${fn} ${tag} ${ms}ms`)
    return json({ ok: true, result })
  } catch (err) {
    const ms = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[db] ${fn} error ${ms}ms:`, msg)
    if (err instanceof Error && err.stack) {
      console.error(err.stack)
    }
    return json({ ok: false, error: msg }, 500)
  }
}

