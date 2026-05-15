#!/usr/bin/env node
/**
 * UxS / Navy XML import parser tests
 * ------------------------------------
 * Runs each of the 5 UxS/Navy sample XMLs through importPilotPartialStateFromXml
 * and asserts expected field values for every wizard step:
 *   Platform → Mission → Coverage → Sensors → Contacts → Keywords
 *
 * Run: node scripts/test-uxs-navy-xml-parsers.mjs
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DOMParser } from '@xmldom/xmldom'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const SAMPLES = path.resolve(ROOT, '../MANTA End User Testing/samples')

// ── DOM polyfills required by xmlPilotImport (mirrors test-fixtures.mjs) ──────
globalThis.DOMParser = DOMParser
if (!globalThis.window) globalThis.window = {}

const probeDoc = new DOMParser().parseFromString('<root><child/></root>', 'application/xml')
const elementProto = Object.getPrototypeOf(probeDoc.documentElement)
if (!Object.getOwnPropertyDescriptor(elementProto, 'children')) {
  Object.defineProperty(elementProto, 'children', {
    configurable: true,
    enumerable: true,
    get() {
      return Array.from(this.childNodes || []).filter((n) => n && n.nodeType === 1)
    },
  })
}

const { importPilotPartialStateFromXml } = await import(
  path.join(ROOT, 'src/lib/xmlPilotImport.js')
)

// ── Helpers ───────────────────────────────────────────────────────────────────

let pass = 0
let fail = 0
const failures = []

function check(label, actual, expected, exact = true) {
  try {
    if (exact) {
      assert.equal(actual, expected, `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
    } else {
      // substring / includes check
      assert.ok(
        String(actual ?? '').includes(expected),
        `Expected "${actual}" to contain "${expected}"`
      )
    }
    pass++
  } catch (e) {
    fail++
    failures.push(`  FAIL  ${label}\n        ${e.message}`)
  }
}

function checkDefined(label, actual) {
  try {
    assert.ok(actual !== undefined && actual !== null && actual !== '', `Expected a value for ${label}, got ${JSON.stringify(actual)}`)
    pass++
  } catch (e) {
    fail++
    failures.push(`  FAIL  ${label}\n        ${e.message}`)
  }
}

function checkNum(label, actual, expected, tol = 0.0001) {
  try {
    const a = Number(actual)
    assert.ok(!isNaN(a), `Expected numeric, got ${JSON.stringify(actual)}`)
    assert.ok(
      Math.abs(a - expected) < tol,
      `Expected ~${expected}, got ${a} (diff ${Math.abs(a - expected)})`
    )
    pass++
  } catch (e) {
    fail++
    failures.push(`  FAIL  ${label}\n        ${e.message}`)
  }
}

function checkSensorField(label, sensors, idx, field, expected, exact = true) {
  const s = sensors?.[idx]
  const actual = s?.[field]
  check(label, actual, expected, exact)
}

function section(name) {
  console.log(`\n  ── ${name} ──`)
}

function xmlFile(filename) {
  return fs.readFileSync(path.join(SAMPLES, filename), 'utf8')
}

function parse(filename) {
  const xml = xmlFile(filename)
  const result = importPilotPartialStateFromXml(xml)
  if (!result.ok) {
    throw new Error(`Parser returned ok=false for ${filename}: ${result.error}`)
  }
  return result.partial
}

// ─────────────────────────────────────────────────────────────────────────────
// XML 1: NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml
//   ISO 19115-3 · full prefix namespace · MDBC Eagle Ray AUV Dive 03
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════')
console.log('XML 1: PS2418 AUV03 (ISO 19115-3, full prefix namespace)')
console.log('══════════════════════════════════════════════════════════════')

{
  let partial
  try {
    partial = parse('NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml')
  } catch (e) {
    fail++
    failures.push(`  FAIL  AUV03 parse\n        ${e.message}`)
    partial = null
  }

  if (partial) {
    const { mission, platform, sensors } = partial

    section('Step 1 · Platform')
    // mac:MI_Platform/mac:identifier → "PS Eagle Ray"; no mac:name → falls back to platformId
    check('AUV03 · platform.platformId', platform?.platformId, 'PS Eagle Ray')
    check('AUV03 · platform.platformDesc', platform?.platformDesc, 'Eagle Ray Deep Water Mapping AUV')
    // platformName falls back to platformId when mac:name absent
    check('AUV03 · platform.platformName', platform?.platformName, 'PS Eagle Ray')
    // mac:sponsor/cit:CI_Responsibility/cit:party/cit:CI_Organisation/cit:name
    check('AUV03 · platform.manufacturer', platform?.manufacturer, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')

    section('Step 2 · Mission')
    // mri:citation/cit:CI_Citation/cit:title
    check('AUV03 · mission.title', mission?.title, 'Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data AUV Dive 03')
    // cit:alternateTitle
    check('AUV03 · mission.alternateTitle', mission?.alternateTitle, 'PS2418L0_ER_AUV03_Norbit_MB_20240508T0117Z')
    // mri:abstract
    checkDefined('AUV03 · mission.abstract', mission?.abstract)
    // Parser auto-expands acronyms → "MDBC (NOAA Mesophotic...)" so check for the bare acronym
    check('AUV03 · mission.abstract (contains MDBC)', mission?.abstract, 'MDBC', false)
    // mdb:metadataIdentifier → fileId (no gov.noaa.ncei.uxs: prefix → raw value)
    check('AUV03 · mission.fileId', mission?.fileId, 'PS2418L0_ER_AUV03_Norbit_MB_20240508T0117Z_MD')
    // mac:MI_Operation/mac:significantEvent[sequence=start]/mac:time
    check('AUV03 · mission.startDate', mission?.startDate, '2024-05-07T00:03:27')
    // mac:MI_Operation/mac:status = completed
    check('AUV03 · mission.status', mission?.status, 'completed')
    // mdb:dateInfo[type=creation]
    checkDefined('AUV03 · mission.metadataRecordDate', mission?.metadataRecordDate)
    check('AUV03 · mission.metadataRecordDate (contains)', mission?.metadataRecordDate, '2024-05-09', false)

    section('Step 3 · Coverage')
    // mdb:identificationInfo has no EX_GeographicBoundingBox with coordinates — gap in this template
    check('AUV03 · mission.west (absent — no bbox in identificationInfo)', mission?.west ?? '', '')
    // mdb:referenceSystemInfo/mrs:MD_ReferenceSystem/mrs:referenceSystemIdentifier/mcc:MD_Identifier/mcc:code
    check('AUV03 · spatial.referenceSystem', partial?.spatial?.referenceSystem, 'WGS84E_2D')

    section('Step 4 · Sensors')
    // mac:MI_Platform/mac:instrument × N (AUV03 has Pressure Sensor, CTD, GNSS at minimum)
    assert.ok(Array.isArray(sensors) && sensors.length >= 2,
      `Expected ≥2 sensors, got ${sensors?.length ?? 'none'}`)
    pass++
    // First sensor: Paroscientific Pressure Sensor
    checkSensorField('AUV03 · sensors[0].sensorId', sensors, 0, 'sensorId', 'Paroscientific Pressure Sensor')
    checkSensorField('AUV03 · sensors[0].type (contains)', sensors, 0, 'type', 'Paroscientific', false)
    // Second sensor: SBE CTD
    checkSensorField('AUV03 · sensors[1].sensorId', sensors, 1, 'sensorId', 'SBE CTD Sensor')
    checkSensorField('AUV03 · sensors[1].type (contains)', sensors, 1, 'type', 'CTD', false)

    section('Step 5 · Contacts')
    // mri:pointOfContact CI_Organisation name
    check('AUV03 · mission.org', mission?.org, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')
    check('AUV03 · mission.email', mission?.email, 'errol.ronje@noaa.gov')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML 2: NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml
//   ISO 19115-3 · full prefix namespace · MDBC Eagle Ray AUV Dive 01
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════')
console.log('XML 2: PS2418 AUV01 (ISO 19115-3, full prefix namespace)')
console.log('══════════════════════════════════════════════════════════════')

{
  let partial
  try {
    partial = parse('NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml')
  } catch (e) {
    fail++
    failures.push(`  FAIL  AUV01 parse\n        ${e.message}`)
    partial = null
  }

  if (partial) {
    const { mission, platform, sensors } = partial

    section('Step 1 · Platform')
    check('AUV01 · platform.platformId', platform?.platformId, 'PS Eagle Ray')
    check('AUV01 · platform.platformName', platform?.platformName, 'PS Eagle Ray')
    check('AUV01 · platform.platformDesc', platform?.platformDesc, 'Eagle Ray Deep Water Mapping AUV')
    check('AUV01 · platform.manufacturer', platform?.manufacturer, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')

    section('Step 2 · Mission')
    // Dive 01 — title differs from AUV03
    check('AUV01 · mission.title', mission?.title, 'Point Sur 2024 Leg 18 Eagle Ray MultiBeam Sonar Data AUV Dive 01')
    check('AUV01 · mission.alternateTitle', mission?.alternateTitle, 'PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z')
    check('AUV01 · mission.fileId', mission?.fileId, 'PS2418L0_ER_AUV01_Norbit_MB_20240505T1510Z_MD')
    check('AUV01 · mission.abstract (contains MDBC)', mission?.abstract, 'MDBC', false)
    check('AUV01 · mission.status', mission?.status, 'completed')
    check('AUV01 · mission.org', mission?.org, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')
    check('AUV01 · mission.email', mission?.email, 'errol.ronje@noaa.gov')

    section('Step 3 · Coverage')
    check('AUV01 · mission.west (absent — no bbox in identificationInfo)', mission?.west ?? '', '')
    check('AUV01 · spatial.referenceSystem', partial?.spatial?.referenceSystem, 'WGS84E_2D')

    section('Step 4 · Sensors')
    assert.ok(Array.isArray(sensors) && sensors.length >= 2,
      `Expected ≥2 sensors, got ${sensors?.length ?? 'none'}`)
    pass++
    checkSensorField('AUV01 · sensors[0].sensorId', sensors, 0, 'sensorId', 'Paroscientific Pressure Sensor')
    checkSensorField('AUV01 · sensors[1].sensorId', sensors, 1, 'sensorId', 'SBE CTD Sensor')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML 3: ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml
//   ISO 19115-3 · default-namespace (no prefix) · REMUS 620 Dive 01
//   NOTE: bounding box uses <CharacterString> not <Decimal> — parser may miss it
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════')
console.log('XML 3: EN2501 REMUS620 0723 (ISO 19115-3, default-namespace)')
console.log('══════════════════════════════════════════════════════════════')

{
  let partial
  try {
    partial = parse('ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml')
  } catch (e) {
    fail++
    failures.push(`  FAIL  EN2501-0723 parse\n        ${e.message}`)
    partial = null
  }

  if (partial) {
    const { mission, platform, sensors } = partial

    section('Step 1 · Platform')
    // MI_Platform identifier code = "REMUS620_401"
    check('EN2501-0723 · platform.platformId', platform?.platformId, 'REMUS620_401')
    // description: "Platform: REMUS 620 by HII Model: REMUS 620"
    // Parser regex: /platform:\s*(.+?)\s+by\b/i → captures "REMUS 620"
    check('EN2501-0723 · platform.platformName', platform?.platformName, 'REMUS 620')
    check('EN2501-0723 · platform.platformDesc (contains)', platform?.platformDesc, 'REMUS 620', false)
    // No mac:sponsor in this file — manufacturer should be absent or empty
    check('EN2501-0723 · platform.manufacturer (absent)', platform?.manufacturer ?? '', '')

    section('Step 2 · Mission')
    check('EN2501-0723 · mission.title', mission?.title, 'RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 01')
    check('EN2501-0723 · mission.alternateTitle', mission?.alternateTitle, 'EN2501_REMUS620_401_KRAKEN_SAS_202507023T0116Z')
    // fileId from mdb:metadataIdentifier/mcc:MD_Identifier/mcc:code
    check('EN2501-0723 · mission.fileId', mission?.fileId, 'EN2501_REMUS620_401_KRAKEN_SAS_202507023T0116Z')
    check('EN2501-0723 · mission.abstract (contains)', mission?.abstract, 'REMUS 620', false)
    // ISO codelist normalizes "ongoing" → "onGoing"
    check('EN2501-0723 · mission.status', mission?.status, 'onGoing')
    // citation dates: creation → startDate, completion → endDate
    check('EN2501-0723 · mission.startDate', mission?.startDate, '2025-07-23T05:32:00.000Z')
    check('EN2501-0723 · mission.endDate', mission?.endDate, '2025-07-23T18:16:00.000Z')
    check('EN2501-0723 · mission.org', mission?.org, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')
    check('EN2501-0723 · mission.email', mission?.email, 'errol.ronje@noaa.gov')
    // PARSING GAP: EN2501 CI_DateTypeCode uses text content, not codeListValue attribute →
    //   parser's getAttribute('codeListValue') check returns empty → metadataRecordDate not extracted
    check('EN2501-0723 · mission.metadataRecordDate (gap: text-only dateType)', mission?.metadataRecordDate ?? 'UNPARSED', 'UNPARSED')

    section('Step 3 · Coverage')
    // referenceSystem from mrs:MD_ReferenceSystem
    check('EN2501-0723 · spatial.referenceSystem', partial?.spatial?.referenceSystem, 'EPSG:4326')
    // NOTE: bounding box uses <CharacterString> not <gco:Decimal>.
    // Parser DOES extract the values but west/east labels in this XML are geographically inverted
    // (XML says westBound=-87.12, eastBound=-87.24, but -87.24 is further west).
    // Parser stores mission.west from westBoundLongitude element and mission.east from eastBoundLongitude.
    // We assert the parsed values (as labeled in the XML, even though the XML's own labels are swapped).
    checkNum('EN2501-0723 · mission.west (CharacterString, as labeled in XML)', mission?.west, -87.24584907117764)
    checkNum('EN2501-0723 · mission.east (CharacterString, as labeled in XML)', mission?.east, -87.12298583812589)
    checkNum('EN2501-0723 · mission.south', mission?.south, 29.892576066532285)
    checkNum('EN2501-0723 · mission.north', mission?.north, 29.952103569624114)

    section('Step 4 · Sensors')
    // 5 instruments as direct mac:instrument children (PHINS INS, AML CTD, RDI ADCP, PDVL 300, Kraken SAS)
    assert.ok(Array.isArray(sensors) && sensors.length === 5,
      `Expected 5 sensors, got ${sensors?.length ?? 'none'}: ${JSON.stringify(sensors?.map(s => s.sensorId))}`)
    pass++
    checkSensorField('EN2501-0723 · sensors[0].sensorId', sensors, 0, 'sensorId', 'PHINS INS')
    checkSensorField('EN2501-0723 · sensors[0].variable (type)', sensors, 0, 'variable', 'Inertial Navigation System')
    checkSensorField('EN2501-0723 · sensors[1].sensorId', sensors, 1, 'sensorId', 'AML CTD')
    checkSensorField('EN2501-0723 · sensors[1].variable (type)', sensors, 1, 'variable', 'Conductivity, Temperature, Depth Sensor')
    checkSensorField('EN2501-0723 · sensors[2].sensorId', sensors, 2, 'sensorId', 'RDI ADCP')
    checkSensorField('EN2501-0723 · sensors[2].variable (type)', sensors, 2, 'variable', 'Acoustic Doppler Current Profiler')
    checkSensorField('EN2501-0723 · sensors[3].sensorId', sensors, 3, 'sensorId', 'PDVL 300')
    checkSensorField('EN2501-0723 · sensors[3].variable (type)', sensors, 3, 'variable', 'Doppler Velocity Logger')
    checkSensorField('EN2501-0723 · sensors[4].sensorId', sensors, 4, 'sensorId', 'Kraken SAS')
    checkSensorField('EN2501-0723 · sensors[4].variable (type)', sensors, 4, 'variable', 'Synthetic Aperture Sonar')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML 4: ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml
//   ISO 19115-3 · default-namespace · REMUS 620 Dive 05
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════')
console.log('XML 4: EN2501 REMUS620 0727 (ISO 19115-3, default-namespace)')
console.log('══════════════════════════════════════════════════════════════')

{
  let partial
  try {
    partial = parse('ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml')
  } catch (e) {
    fail++
    failures.push(`  FAIL  EN2501-0727 parse\n        ${e.message}`)
    partial = null
  }

  if (partial) {
    const { mission, platform, sensors } = partial

    section('Step 1 · Platform')
    check('EN2501-0727 · platform.platformId', platform?.platformId, 'REMUS620_401')
    check('EN2501-0727 · platform.platformName', platform?.platformName, 'REMUS 620')

    section('Step 2 · Mission')
    // Dive 05 — title differs from 0723 dive
    check('EN2501-0727 · mission.title', mission?.title, 'RV Expedition 2025 LEG 01 REMUS620 KRAKEN SAS MGM Dive 05')
    check('EN2501-0727 · mission.alternateTitle', mission?.alternateTitle, 'EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z')
    check('EN2501-0727 · mission.fileId', mission?.fileId, 'EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z')
    check('EN2501-0727 · mission.status', mission?.status, 'onGoing')
    check('EN2501-0727 · mission.startDate', mission?.startDate, '2025-07-27T00:48:00.000Z')
    check('EN2501-0727 · mission.endDate', mission?.endDate, '2025-07-27T07:47:00.000Z')
    check('EN2501-0727 · mission.org', mission?.org, 'NOAA MESOPHOTIC DEEP BENTHIC COMMUNITIES RESTORATION PROJECT')
    check('EN2501-0727 · mission.email', mission?.email, 'errol.ronje@noaa.gov')

    section('Step 3 · Coverage')
    check('EN2501-0727 · spatial.referenceSystem', partial?.spatial?.referenceSystem, 'EPSG:4326')

    section('Step 4 · Sensors')
    // Same 5 sensor payload as 0723 dive
    assert.ok(Array.isArray(sensors) && sensors.length === 5,
      `Expected 5 sensors, got ${sensors?.length ?? 'none'}`)
    pass++
    // 0727 XML has different sensor order: PHINS INS (0), Kraken SAS (1), PDVL 300 (2), RDI ADCP (3), AML CTD (4)
    checkSensorField('EN2501-0727 · sensors[0].sensorId', sensors, 0, 'sensorId', 'PHINS INS')
    checkSensorField('EN2501-0727 · sensors[1].sensorId', sensors, 1, 'sensorId', 'Kraken SAS')
    checkSensorField('EN2501-0727 · sensors[4].sensorId', sensors, 4, 'sensorId', 'AML CTD')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// XML 5: uxs_test.xml
//   ISO 19115-2 · gmi:MI_Metadata · Saildrone PMEL TPOS 2018
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════════════')
console.log('XML 5: uxs_test.xml (ISO 19115-2, gmi:MI_Metadata, Saildrone)')
console.log('══════════════════════════════════════════════════════════════')

{
  let partial
  try {
    partial = parse('uxs_test.xml')
  } catch (e) {
    fail++
    failures.push(`  FAIL  uxs_test parse\n        ${e.message}`)
    partial = null
  }

  if (partial) {
    const { mission, platform, sensors } = partial

    section('Step 2 · Mission')
    // gmd:fileIdentifier = "gov.noaa.nodc:0297635" → no NCEI UxS prefix → fileId = raw value
    check('uxs_test · mission.fileId', mission?.fileId, 'gov.noaa.nodc:0297635')
    // gmd:identifier with xlink:title="NCEI Accession ID" → accession
    check('uxs_test · mission.accession', mission?.accession, '0297635')
    // gmd:title
    check('uxs_test · mission.title', mission?.title, 'Saildrone PMEL TPOS 2018 Mission, drone 1005 (NCEI Accession 0297635)')
    checkDefined('uxs_test · mission.abstract', mission?.abstract)
    // publication date from CI_Date
    checkDefined('uxs_test · mission.publicationDate', mission?.publicationDate)

    section('Step 3 · Coverage')
    // gmd:EX_GeographicBoundingBox uses gco:Decimal — should parse correctly
    checkNum('uxs_test · mission.west', mission?.west, -157.9788288)
    checkNum('uxs_test · mission.east', mission?.east, -141.730752)
    checkNum('uxs_test · mission.south', mission?.south, -1.1468039)
    checkNum('uxs_test · mission.north', mission?.north, 21.411176)
    // gml:beginPosition / gml:endPosition
    check('uxs_test · mission.startDate', mission?.startDate, '2018-10-03')
    check('uxs_test · mission.endDate', mission?.endDate, '2019-01-27')

    section('Step 4 · Sensors')
    // gmi:MI_AcquisitionInformation → gmi:MI_Instrument (anemometer + more)
    assert.ok(Array.isArray(sensors) && sensors.length >= 1,
      `Expected ≥1 sensor, got ${sensors?.length ?? 'none'}`)
    pass++
    checkSensorField('uxs_test · sensors[0].sensorId', sensors, 0, 'sensorId', 'anemometer')
    checkSensorField('uxs_test · sensors[0].variable (type)', sensors, 0, 'variable', 'anemometer')

    section('Step 5 · Contacts')
    // Root contact: NOAA National Centers for Environmental Information (custodian)
    // pointOfContact in identificationInfo (varies per file)
    checkDefined('uxs_test · mission.org', mission?.org)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Summary
// ─────────────────────────────────────────────────────────────────────────────
const total = pass + fail
console.log('\n══════════════════════════════════════════════════════════════')
console.log(`Results: ${pass}/${total} passed, ${fail} failed`)
console.log('══════════════════════════════════════════════════════════════')

if (failures.length) {
  console.log('\nFailed assertions:')
  for (const f of failures) console.log(f)
  console.log()
  process.exit(1)
} else {
  console.log('\nAll checks passed.')
}
