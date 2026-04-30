import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readCsv } from './_csv.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')
const DOWNLOADS = path.resolve(ROOT, '../..')

const MISSION_MATRIX_PATH = path.join(DOWNLOADS, 'mission_validation_full_field_matrix.csv')
const TMF_RULE_CANDIDATES_PATH = path.join(ROOT, 'rules/tmf_rule_candidates.csv')
const RULE_OUT = path.join(ROOT, 'rules/rule.csv')
const MAP_OUT = path.join(ROOT, 'rules/field_map.csv')

const RULE_HEADERS = [
  'rule_id',
  'rule_set',
  'version',
  'record_type',
  'field_key',
  'xpath',
  'requirement',
  'cardinality_min',
  'cardinality_max',
  'datatype',
  'enum_values_json',
  'pattern_regex',
  'condition_expr',
  'severity',
  'auto_fixable',
  'auto_fix_strategy',
  'message',
  'source_file',
  'source_tab',
  'source_row',
  'source_ref',
  'notes',
  'active',
]

const MAP_HEADERS = [
  'map_id',
  'source_system',
  'source_file',
  'source_tab',
  'source_field',
  'source_xpath',
  'record_type',
  'normalized_field_key',
  'transform',
  'default_value',
  'datatype_hint',
  'confidence',
  'notes',
  'active',
]

function esc(v) {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => esc(row[h] ?? '')).join(','))
  }
  fs.writeFileSync(filePath, `${lines.join('\n')}\n`, 'utf8')
}

function slug(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/`/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function inferRecordType(field) {
  const f = String(field || '')
  if (f.startsWith('distribution.') || f.startsWith('mission.') || f.startsWith('platform.') || f.startsWith('spatial.') || f === 'keywords' || f === 'sensors') {
    return 'mission'
  }
  return 'any'
}

function inferRequirement(message, severity) {
  const m = String(message || '').toLowerCase()
  if (m.includes('forbidden') || m.includes('must not')) return 'forbidden'
  if (m.includes('is required') || m.includes('must be')) return 'required'
  if (severity === 'block') return 'required'
  return 'recommended'
}

function inferDatatype(field, message) {
  const f = String(field || '')
  const m = String(message || '').toLowerCase()
  if (m.includes('http') || f.toLowerCase().includes('url')) return 'url'
  if (m.includes('yyyy-mm-dd') || f.toLowerCase().includes('date')) return 'date'
  if (m.includes('numeric') || f.toLowerCase().includes('depth') || f.toLowerCase().includes('bbox')) return 'decimal'
  if (f.toLowerCase().includes('doi')) return 'string'
  return 'string'
}

const missionRows = fs.existsSync(MISSION_MATRIX_PATH) ? readCsv(MISSION_MATRIX_PATH) : []
if (!missionRows.length) {
  console.error(`No mission matrix rows found at ${MISSION_MATRIX_PATH}`)
  process.exit(1)
}
const tmfCandidateRows = fs.existsSync(TMF_RULE_CANDIDATES_PATH) ? readCsv(TMF_RULE_CANDIDATES_PATH) : []

/** @type {Record<string,string>} */
const sourceFieldByNorm = {}
/** @type {Array<Record<string,string|number|boolean>>} */
const outRules = []
const bediFieldRecordType = {}

function pushRule({
  rule_id,
  rule_set,
  record_type,
  field_key,
  severity,
  message,
  xpath = '',
  requirement = '',
  pattern_regex = '',
  source_file = '',
  source_ref = '',
  notes = '',
}) {
  const sev = severity === 'block' || severity === 'warn'
    ? severity
    : String(severity || '').toLowerCase() === 'e'
      ? 'block'
      : 'warn'
  const req = requirement || inferRequirement(message, sev)
  outRules.push({
    rule_id,
    rule_set,
    version: 1,
    record_type,
    field_key,
    xpath,
    requirement: req,
    cardinality_min: req === 'required' ? 1 : 0,
    cardinality_max: '',
    datatype: inferDatatype(field_key, message),
    enum_values_json: '',
    pattern_regex,
    condition_expr: '',
    severity: sev,
    auto_fixable: false,
    auto_fix_strategy: '',
    message,
    source_file,
    source_tab: '',
    source_row: '',
    source_ref,
    notes,
    active: true,
  })
}

for (const [i, row] of missionRows.entries()) {
  const rawField = String(row['pilotState field'] || '').trim()
  const field = rawField.replace(/`/g, '')
  if (!field) continue
  sourceFieldByNorm[field] = rawField
  const rawRuleSet = String(row['Rule set'] || 'mission-import').trim()
  const severityCode = String(row['Severity'] || 'w').trim().toLowerCase()
  const severity = severityCode === 'e' ? 'block' : 'warn'
  const message = String(row['Message'] || '').trim() || `Rule for ${field}`
  const requirement = inferRequirement(message, severity)
  const xpath = String(row['XPath preview'] || '').trim()
  const notes = String(row.Notes || '').trim()

  outRules.push({
    rule_id: `${slug(rawRuleSet)}_${slug(field)}_${slug(message).slice(0, 36)}_${i + 1}`,
    rule_set: rawRuleSet,
    version: 1,
    record_type: inferRecordType(field),
    field_key: field,
    xpath,
    requirement,
    cardinality_min: requirement === 'required' ? 1 : 0,
    cardinality_max: '',
    datatype: inferDatatype(field, message),
    enum_values_json: '',
    pattern_regex: '',
    condition_expr: '',
    severity,
    auto_fixable: false,
    auto_fix_strategy: '',
    message,
    source_file: 'mission_validation_full_field_matrix.csv',
    source_tab: '',
    source_row: i + 2,
    source_ref: rawRuleSet,
    notes,
    active: true,
  })
}

// BEDI rules imported from profile rule sets to strengthen compiled collection/granule lanes.
const BEDI_GRANULE_RULES = [
  ['parentCollectionId', 'e', 'Parent collection identifier is required — granules MUST link to a collection via gmd:parentIdentifier'],
  ['parentCollectionId', 'e', 'Parent collection ID must follow OER namespace pattern: gov.noaa.ncei.oer:<ID>'],
  ['fileId', 'e', 'File identifier is required'],
  ['fileId', 'e', 'File identifier must follow OER namespace pattern: gov.noaa.ncei.oer:<ID>'],
  ['granuleId', 'e', 'Granule identifier (short ID) is required'],
  ['hierarchyLevel', 'e', 'BEDI granules must have hierarchyLevel = dataset'],
  ['title', 'e', 'Title is required'],
  ['presentationForm', 'e', 'Presentation form is required for BEDI granules (expected: videoDigital)'],
  ['creationDate', 'e', 'Creation date is required'],
  ['abstract', 'e', 'Abstract is required'],
  ['status', 'e', 'Status is required'],
  ['diveId', 'e', 'Dive identifier is required (e.g. JSL2-3699, parsed from file ID)'],
  ['west', 'e', 'Bounding box W/E/S/N is required'],
  ['startDate', 'e', 'Observation start date/time is required'],
  ['endDate', 'e', 'Observation end date/time is required'],
  ['maxDepth', 'e', 'Maximum dive depth (meters) is required for BEDI granules'],
]

const BEDI_COLLECTION_RULES = [
  ['fileId', 'e', 'File identifier is required (e.g. gov.noaa.ncei.oer:COLLECTION_ID)'],
  ['fileId', 'e', 'File identifier must follow OER namespace pattern: gov.noaa.ncei.oer:<ID>'],
  ['hierarchyLevel', 'e', 'BEDI collections must have hierarchyLevel = fieldSession'],
  ['collectionId', 'e', 'Short collection identifier is required (e.g. Biolum2009)'],
  ['nceiAccessionId', 'e', 'NCEI Accession ID is required (numeric, from NCEI AMS authority identifier)'],
  ['nceiAccessionId', 'e', 'NCEI Accession ID must be numeric'],
  ['title', 'e', 'Title is required'],
  ['creationDate', 'e', 'Creation date is required'],
  ['abstract', 'e', 'Abstract is required'],
  ['status', 'e', 'Status is required (e.g. completed, historicalArchive)'],
  ['scienceKeywords', 'e', 'At least one GCMD Science Keyword is required'],
  ['datacenters', 'e', 'At least one data center keyword is required'],
  ['west', 'e', 'Bounding box W/E/S/N is required'],
  ['startDate', 'e', 'Start date is required'],
  ['endDate', 'e', 'End date is required'],
  ['platforms', 'e', 'At least one platform reference is required (ship or submersible)'],
]

for (const [idx, [field, sev, message]] of BEDI_GRANULE_RULES.entries()) {
  bediFieldRecordType[field] = 'granule'
  pushRule({
    rule_id: `bedi_granule_${slug(field)}_${idx + 1}`,
    rule_set: 'bedi-granule-core',
    record_type: 'granule',
    field_key: field,
    severity: sev,
    message,
    source_file: 'src/profiles/bedi/bediGranuleRules.js',
    source_ref: 'bedi-granule-core',
  })
}

for (const [idx, [field, sev, message]] of BEDI_COLLECTION_RULES.entries()) {
  bediFieldRecordType[field] = 'collection'
  pushRule({
    rule_id: `bedi_collection_${slug(field)}_${idx + 1}`,
    rule_set: 'bedi-collection-core',
    record_type: 'collection',
    field_key: field,
    severity: sev,
    message,
    source_file: 'src/profiles/bedi/bediCollectionRules.js',
    source_ref: 'bedi-collection-core',
  })
}

// Keep critical OneStop parity starters.
outRules.push(
  {
    rule_id: 'onestop_title_required_v1',
    rule_set: 'onestop',
    version: 1,
    record_type: 'collection',
    field_key: 'citation.title',
    xpath: '//gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title',
    requirement: 'required',
    cardinality_min: 1,
    cardinality_max: 1,
    datatype: 'string',
    enum_values_json: '',
    pattern_regex: '',
    condition_expr: '',
    severity: 'block',
    auto_fixable: false,
    auto_fix_strategy: '',
    message: 'Title is required and must appear exactly once',
    source_file: 'OneStop Regeneration - Bulk Metadata Records - EX (1).xlsx',
    source_tab: 'Rules',
    source_row: 12,
    source_ref: 'TitleCheck',
    notes: '',
    active: true,
  },
  {
    rule_id: 'onestop_fileidentifier_single_v1',
    rule_set: 'onestop',
    version: 1,
    record_type: 'any',
    field_key: 'ident.fileIdentifier',
    xpath: '//gmd:fileIdentifier',
    requirement: 'required',
    cardinality_min: 1,
    cardinality_max: 1,
    datatype: 'string',
    enum_values_json: '',
    pattern_regex: '',
    condition_expr: '',
    severity: 'block',
    auto_fixable: false,
    auto_fix_strategy: '',
    message: 'fileIdentifier must appear exactly once',
    source_file: 'WAF metadata.xlsx',
    source_tab: 'Checks',
    source_row: 7,
    source_ref: 'FileIdentifierCheck',
    notes: '',
    active: true,
  },
)

// OneStop ingest UUID starters (non-blocking): capture Vidya/Jason guidance on UUID-style IDs.
// These are warnings until we finalize exact archive-class UUID conventions.
const UUID_V4_REGEX = '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
pushRule({
  rule_id: 'onestop_collection_uuid_format_v1',
  rule_set: 'onestop',
  record_type: 'collection',
  field_key: 'ident.collectionUuid',
  severity: 'warn',
  requirement: 'recommended',
  pattern_regex: UUID_V4_REGEX,
  message: 'Collection UUID should be a random UUID v4 when ingesting from OneStop segment exports',
  source_file: 'OneStop ingest notes',
  source_ref: 'UUID collection guidance',
  notes: 'Starter rule; promote to block once convention is confirmed',
})
pushRule({
  rule_id: 'onestop_granule_archive_uuid_format_v1',
  rule_set: 'onestop',
  record_type: 'granule',
  field_key: 'ident.archiveObjectUuid',
  severity: 'warn',
  requirement: 'recommended',
  pattern_regex: UUID_V4_REGEX,
  message: 'Granule archive-class UUID should be UUID v4 for OneStop segment ingest',
  source_file: 'OneStop ingest notes',
  source_ref: 'UUID granule guidance',
  notes: 'Starter rule; archive-class mapping details pending confirmation',
})
pushRule({
  rule_id: 'onestop_granule_parent_collection_uuid_format_v1',
  rule_set: 'onestop',
  record_type: 'granule',
  field_key: 'ident.parentCollectionUuid',
  severity: 'warn',
  requirement: 'recommended',
  pattern_regex: UUID_V4_REGEX,
  message: 'Granule parent collection UUID should be UUID v4 and match collection linkage when provided',
  source_file: 'OneStop ingest notes',
  source_ref: 'UUID parent linkage guidance',
  notes: 'Starter rule; cross-record match check to be added in ingest join step',
})

// TMF automation rule candidates (csv draft -> live rule.csv rows)
for (const row of tmfCandidateRows) {
  const ruleId = String(row.candidate_id || '').trim()
  const fieldKey = String(row.field_key || '').trim()
  if (!ruleId || !fieldKey) continue

  const severityRaw = String(row.severity || '').trim().toLowerCase()
  const severity = severityRaw === 'block' ? 'block' : 'warn'
  const requirement = String(row.suggested_requirement || '').trim().toLowerCase()
  const ruleType = String(row.rule_type || '').trim().toLowerCase()
  const patternOrCondition = String(row.pattern_or_condition || '').trim()
  const sourcePath = String(row.source_path || '').trim()
  const sourceBundle = String(row.source_bundle || '').trim()
  const recordType = String(row.record_type || '').trim() || inferRecordType(fieldKey)
  const message = String(row.message || '').trim() || `TMF candidate rule for ${fieldKey}`
  const notes = String(row.notes || '').trim()

  outRules.push({
    rule_id: ruleId,
    rule_set: 'tmf-candidates',
    version: 1,
    record_type: recordType,
    field_key: fieldKey,
    xpath: '',
    requirement: requirement || inferRequirement(message, severity),
    cardinality_min: requirement === 'required' ? 1 : 0,
    cardinality_max: '',
    datatype: inferDatatype(fieldKey, message),
    enum_values_json: '',
    pattern_regex: ruleType === 'pattern' ? patternOrCondition : '',
    condition_expr: ruleType === 'condition' ? patternOrCondition : '',
    severity,
    auto_fixable: false,
    auto_fix_strategy: '',
    message,
    source_file: sourcePath || 'rules/tmf_rule_candidates.csv',
    source_tab: '',
    source_row: '',
    source_ref: sourceBundle || 'tmf-scripts',
    notes,
    active: true,
  })
}

const mapRows = [
  {
    map_id: 'map_bedi_filename_to_fileidentifier',
    source_system: 'db_export',
    source_file: 'bedi_videos_export.csv',
    source_tab: '',
    source_field: 'FILENAME',
    source_xpath: '',
    record_type: 'granule',
    normalized_field_key: 'ident.fileIdentifier',
    transform: 'prefix_gov_noaa_ncei_oer',
    default_value: '',
    datatype_hint: 'string',
    confidence: 1,
    notes: '',
    active: true,
  },
  {
    map_id: 'map_onestop_collection_title',
    source_system: 'excel',
    source_file: 'OneStop Regeneration - Bulk Metadata Records - EX (1).xlsx',
    source_tab: 'Rules',
    source_field: 'title',
    source_xpath: '//gmd:MD_DataIdentification/gmd:citation/gmd:CI_Citation/gmd:title',
    record_type: 'collection',
    normalized_field_key: 'citation.title',
    transform: 'trim',
    default_value: '',
    datatype_hint: 'string',
    confidence: 1,
    notes: '',
    active: true,
  },
]

const uniqueFieldPairs = [
  ...new Set(
    outRules
      .map((r) => `${String(r.record_type || '')}::${String(r.field_key || '')}`)
      .filter((v) => !v.endsWith('::')),
  ),
]
for (const pair of uniqueFieldPairs) {
  const [recordType, field] = pair.split('::')
  const bediRecordType = bediFieldRecordType[field]
  const finalRecordType = recordType || bediRecordType || inferRecordType(field)
  mapRows.push({
    map_id: `map_${slug(finalRecordType)}_${slug(field)}`,
    source_system: bediRecordType ? 'profile_rules' : 'matrix',
    source_file: bediRecordType
      ? bediRecordType === 'granule'
        ? 'src/profiles/bedi/bediGranuleRules.js'
        : 'src/profiles/bedi/bediCollectionRules.js'
      : 'mission_validation_full_field_matrix.csv',
    source_tab: '',
    source_field: sourceFieldByNorm[field] || field,
    source_xpath: '',
    record_type: finalRecordType,
    normalized_field_key: field,
    transform: 'identity',
    default_value: '',
    datatype_hint: inferDatatype(field, ''),
    confidence: 0.9,
    notes: 'auto-generated from mission matrix field list',
    active: true,
  })
}

for (const row of tmfCandidateRows) {
  const fieldKey = String(row.field_key || '').trim()
  if (!fieldKey) continue
  mapRows.push({
    map_id: `map_tmf_${slug(String(row.candidate_id || fieldKey))}`,
    source_system: 'tmf_scripts',
    source_file: String(row.source_path || 'rules/tmf_rule_candidates.csv'),
    source_tab: '',
    source_field: fieldKey,
    source_xpath: '',
    record_type: String(row.record_type || '').trim() || inferRecordType(fieldKey),
    normalized_field_key: fieldKey,
    transform: 'identity',
    default_value: '',
    datatype_hint: inferDatatype(fieldKey, String(row.message || '')),
    confidence: 0.8,
    notes: String(row.notes || '').trim() || 'Imported from TMF rule candidates',
    active: true,
  })
}

writeCsv(RULE_OUT, RULE_HEADERS, outRules)
writeCsv(MAP_OUT, MAP_HEADERS, mapRows)
console.log(`Wrote ${outRules.length} rules -> ${RULE_OUT}`)
console.log(`Wrote ${mapRows.length} field maps -> ${MAP_OUT}`)

