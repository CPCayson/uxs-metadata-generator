#!/usr/bin/env node
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { DOMParser } from '@xmldom/xmldom'

import { mapPlatformRowToPilotPatch, mapPilotPlatformToSavePlatform } from '../src/lib/platformSheetMapping.js'
import { pilotModeToValidationEngineLevel, pilotStateToLegacyFormData } from '../src/lib/pilotToLegacyFormData.js'
import {
  collectGcmdKeywordUuidWarnings,
  defaultPilotState,
  mergeLoadedPilotState,
  sanitizePilotState,
  validatePilotState,
} from '../src/lib/pilotValidation.js'
import { applyPilotAutoFixes } from '../src/lib/pilotAutoFix.js'
import { computeReadinessBundles, computeReadinessSnapshot } from '../src/lib/readinessSummary.js'
import { searchGcmdSchemeClient } from '../src/lib/gcmdClient.js'
import { runLensScanHeuristic } from '../src/lib/lensScanHeuristic.js'
import { parseMantaCommands } from '../src/lib/mantaCommandParse.js'
import { NCEI_UXS_FILE_ID_PREFIX } from '../src/lib/nceiUxsFileId.js'
import { buildXmlPreview } from '../src/lib/xmlPreviewBuilder.js'
import { importPilotPartialStateFromXml } from '../src/lib/xmlPilotImport.js'
import { ValidationEngine } from '../src/core/validation/ValidationEngine.js'
import { missionValidationRuleSets } from '../src/profiles/mission/missionValidationRules.js'
import { missionProfile } from '../src/profiles/mission/missionProfile.js'
import { getMissionFieldLabel } from '../src/profiles/mission/missionFieldLabels.js'
import { pilotStateToCanonical, canonicalToPilotState } from '../src/core/mappers/pilotStateMapper.js'
import {
  canonicalToLegacyFormData,
  legacyFormDataToCanonical,
  legacyFormDataToPilotState,
} from '../src/core/mappers/legacyFormDataMapper.js'
import {
  generateDCATString,
  generateGeoJSONString,
} from '../netlify/functions/lib/legacyGeoDcat.mjs'
import {
  mergeKeywordFacetArrays,
  mergeScannerPartialIntoPilotState,
  parseScannerSuggestionsToMissionPartial,
} from '../src/adapters/sources/ScannerSuggestionAdapter.js'
import {
  mergeBediScannerPartialIntoPilotState,
  parseScannerSuggestionsToBediPartial,
} from '../src/adapters/sources/bediScannerMerge.js'
import { buildBediCollectionXmlPreview } from '../src/lib/bediCollectionXmlPreview.js'
import { buildBediGranuleXmlPreview } from '../src/lib/bediGranuleXmlPreview.js'
import { parseBediCollectionXml } from '../src/profiles/bedi/bediCollectionImportParser.js'
import { parseBediGranuleXml } from '../src/profiles/bedi/bediGranuleImportParser.js'
import { bediCollectionProfile } from '../src/profiles/bedi/bediCollectionProfile.js'
import { bediGranuleProfile } from '../src/profiles/bedi/bediGranuleProfile.js'

globalThis.DOMParser = DOMParser
if (!globalThis.window) {
  globalThis.window = {}
}
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

function step(name, fn) {
  process.stdout.write(`- ${name}... `)
  fn()
  process.stdout.write('ok\n')
}

async function asyncStep(name, fn) {
  process.stdout.write(`- ${name}... `)
  await fn()
  process.stdout.write('ok\n')
}

function checkSeededRoundtrip() {
  const base = defaultPilotState()
  const seeded = {
    ...base,
    mission: {
      ...base.mission,
      fileId: 'verify-seeded-file-id',
      title: 'Verify seeded title',
      abstract: 'Seeded abstract',
      dataLicensePreset: 'custom',
      licenseUrl: 'https://example.org/license',
      startDate: '2024-01-01',
      endDate: '2024-01-02',
      topicCategories: ['oceans', 'elevation'],
      citationPublisherOrganisationName: 'Verify Publisher Org',
      citationAuthorIndividualName: 'Verify Author',
      graphicOverviewHref: 'https://example.org/graphic.png',
      graphicOverviewTitle: 'Verify graphic',
    },
    platform: {
      ...base.platform,
      platformId: 'UUV-VER-1',
      platformDesc: 'Verification platform',
      model: 'Model-X',
      manufacturer: 'NOAA',
      weight: '15.2',
      speed: '2.5',
      operationalArea: 'Monterey Bay',
    },
    sensors: [
      {
        ...base.sensors[0],
        sensorId: 'SEN-1',
        modelId: 'SEN-1',
        type: 'Earth Remote Sensing Instruments',
        variable: 'bathymetry',
        firmware: '1.2.3',
        operationMode: 'survey',
        frequency: '300kHz',
      },
    ],
    distribution: {
      ...base.distribution,
      metadataStandard: 'ISO 19115-2 Geographic Information - Metadata - Part 2: Extensions for Imagery and Gridded Data',
      metadataVersion: 'ISO 19115-2:2009(E)',
      distributionFormatName: 'NetCDF',
      distributionFeesText: 'Electronic download: no fee.',
      distributionOrderingInstructions: 'Contact archive for custom orders.',
      metadataMaintenanceFrequency: 'asNeeded',
    },
    keywords: {
      ...base.keywords,
      sciencekeywords: [
        { label: 'Oceans', uuid: '11111111-1111-1111-1111-111111111111' },
      ],
    },
  }

  const xml = buildXmlPreview(seeded)
  assert.ok(
    String(xml).includes(`${NCEI_UXS_FILE_ID_PREFIX}${seeded.mission.fileId}`),
    'preview should prefix gmd:fileIdentifier when nceiFileIdPrefix is on (default)',
  )
  const parsed = importPilotPartialStateFromXml(xml)
  assert.equal(parsed.ok, true, 'seeded preview XML should import')
  const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)

  assert.equal(merged.mission.fileId, seeded.mission.fileId)
  assert.equal(merged.distribution.nceiFileIdPrefix, true, 'import of prefixed fileIdentifier should set nceiFileIdPrefix')
  assert.equal(merged.mission.title, seeded.mission.title)
  assert.equal(merged.mission.licenseUrl, seeded.mission.licenseUrl)
  assert.equal(merged.mission.dataLicensePreset, seeded.mission.dataLicensePreset)
  assert.equal(merged.platform.platformId, seeded.platform.platformId)
  assert.equal(merged.platform.weight, seeded.platform.weight)
  assert.equal(merged.platform.speed, seeded.platform.speed)
  assert.equal(merged.sensors[0].sensorId, seeded.sensors[0].sensorId)
  assert.equal(merged.sensors[0].firmware, seeded.sensors[0].firmware)
  assert.equal(merged.sensors[0].operationMode, seeded.sensors[0].operationMode)
  assert.equal(merged.distribution.metadataStandard, seeded.distribution.metadataStandard)
  assert.equal(merged.distribution.metadataVersion, seeded.distribution.metadataVersion)
  assert.deepEqual(merged.mission.topicCategories, seeded.mission.topicCategories)
  assert.equal(merged.mission.citationPublisherOrganisationName, seeded.mission.citationPublisherOrganisationName)
  assert.equal(merged.mission.citationAuthorIndividualName, seeded.mission.citationAuthorIndividualName)
  assert.equal(merged.keywords.sciencekeywords[0]?.uuid, seeded.keywords.sciencekeywords[0]?.uuid)
  assert.ok(String(xml).includes('gmx:Anchor'), 'GCMD keyword with uuid should emit gmx:Anchor in preview XML')
  assert.equal(merged.mission.graphicOverviewHref, seeded.mission.graphicOverviewHref)
  assert.equal(merged.mission.graphicOverviewTitle, seeded.mission.graphicOverviewTitle)
  assert.equal(merged.distribution.distributionFeesText, seeded.distribution.distributionFeesText)
  assert.equal(merged.distribution.distributionOrderingInstructions, seeded.distribution.distributionOrderingInstructions)
  assert.equal(merged.distribution.metadataMaintenanceFrequency, seeded.distribution.metadataMaintenanceFrequency)

  return xml
}

function checkNceiFileIdPrefixPreviewAndImport() {
  const base = defaultPilotState()
  const withPrefix = {
    ...base,
    mission: {
      ...base.mission,
      fileId: 'plain-id',
      title: 'Prefix test',
      abstract: 'Abstract for import smoke.',
    },
    distribution: {
      ...base.distribution,
      format: 'NetCDF',
      license: 'CC0',
      landingUrl: 'https://example.org/landing',
      downloadUrl: 'https://example.org/data.nc',
      metadataLandingUrl: 'https://example.org/metadata',
    },
  }
  let xml = buildXmlPreview(withPrefix)
  assert.ok(
    xml.includes(`${NCEI_UXS_FILE_ID_PREFIX}plain-id`),
    'default nceiFileIdPrefix should appear in fileIdentifier',
  )
  const parsed = importPilotPartialStateFromXml(xml)
  assert.equal(parsed.ok, true)
  const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
  assert.equal(merged.mission.fileId, 'plain-id')
  assert.equal(merged.distribution.nceiFileIdPrefix, true)

  const off = {
    ...withPrefix,
    distribution: { ...withPrefix.distribution, nceiFileIdPrefix: false },
  }
  xml = buildXmlPreview(off)
  assert.ok(!xml.includes(`${NCEI_UXS_FILE_ID_PREFIX}plain-id`), 'nceiFileIdPrefix false should omit prefix')
  assert.ok(xml.includes('plain-id'))
}

function checkPilotXmlImportLineageDistributionRoundtrip() {
  const base = defaultPilotState()
  const st = {
    ...base,
    spatial: {
      ...base.spatial,
      lineageStatement: 'Collected during cruise X.',
      lineageProcessSteps: 'First acquisition step.\n\nSecond processing step.',
    },
    distribution: {
      ...base.distribution,
      nceiDistributorContactHref: '',
      nceiDistributorContactTitle: '',
      metadataLandingUrl: 'https://example.org/meta',
      metadataLandingLinkName: 'Metadata page',
      metadataLandingDescription: 'Metadata landing description',
      landingUrl: 'https://example.org/landing',
      downloadUrl: 'https://example.org/data.nc',
      downloadProtocol: 'HTTPS',
      downloadLinkName: 'NetCDF download',
      downloadLinkDescription: 'Primary download',
      distributorIndividualName: 'Pat Example',
      distributorOrganisationName: 'NCEI',
      distributorEmail: 'pat@example.org',
      distributorContactUrl: 'https://example.org/org',
    },
  }
  const xml = buildXmlPreview(st)
  const parsed = importPilotPartialStateFromXml(xml)
  assert.equal(parsed.ok, true, 'lineage/distribution preview XML should import')
  const merged = mergeLoadedPilotState(defaultPilotState(), parsed.partial)
  assert.equal(merged.spatial.lineageStatement, st.spatial.lineageStatement)
  assert.ok(String(merged.spatial.lineageProcessSteps || '').includes('First acquisition'))
  assert.ok(String(merged.spatial.lineageProcessSteps || '').includes('Second processing'))
  assert.equal(merged.distribution.distributorOrganisationName, 'NCEI')
  assert.equal(merged.distribution.distributorEmail, 'pat@example.org')
  assert.equal(merged.distribution.metadataLandingLinkName, 'Metadata page')
  assert.equal(merged.distribution.downloadUrl, 'https://example.org/data.nc')
  assert.equal(merged.distribution.downloadLinkDescription, 'Primary download')
}

function checkOnlineResourceSlotReorderImport() {
  const xml = `<?xml version="1.0"?>
<gmi:MI_Metadata xmlns:gmi="http://www.isotc211.org/2005/gmi"
  xmlns:gmd="http://www.isotc211.org/2005/gmd"
  xmlns:gco="http://www.isotc211.org/2005/gco">
  <gmd:fileIdentifier><gco:CharacterString>slot-test</gco:CharacterString></gmd:fileIdentifier>
  <gmd:language><gco:CharacterString>eng</gco:CharacterString></gmd:language>
  <gmd:distributionInfo>
    <gmd:MD_Distribution>
      <gmd:transferOptions>
        <gmd:MD_DigitalTransferOptions>
          <gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>https://dl.example/get.nc</gmd:URL></gmd:linkage><gmd:name><gco:CharacterString>file download</gco:CharacterString></gmd:name></gmd:CI_OnlineResource></gmd:onLine>
          <gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>https://meta.example/record</gmd:URL></gmd:linkage><gmd:name><gco:CharacterString>metadata record</gco:CharacterString></gmd:name></gmd:CI_OnlineResource></gmd:onLine>
          <gmd:onLine><gmd:CI_OnlineResource><gmd:linkage><gmd:URL>https://proj.example/</gmd:URL></gmd:linkage></gmd:CI_OnlineResource></gmd:onLine>
        </gmd:MD_DigitalTransferOptions>
      </gmd:transferOptions>
    </gmd:MD_Distribution>
  </gmd:distributionInfo>
</gmi:MI_Metadata>`
  const parsed = importPilotPartialStateFromXml(xml)
  assert.equal(parsed.ok, true)
  const d = parsed.partial?.distribution || {}
  assert.equal(d.metadataLandingUrl, 'https://meta.example/record')
  assert.equal(d.downloadUrl, 'https://dl.example/get.nc')
  assert.equal(d.landingUrl, 'https://proj.example/')
}

function checkLegacySpreadsheetShapedMerge() {
  const base = defaultPilotState()
  const loaded = {
    mission: {
      ...base.mission,
      west: null,
      east: '-121',
      south: '36',
      north: '37',
      startDate: '2024-01-15T10:30:00.123Z',
      endDate: '2024-01-16',
    },
    spatial: {
      ...base.spatial,
      useGridRepresentation: 'true',
      hasTrajectory: 'false',
    },
  }
  const merged = mergeLoadedPilotState(base, loaded)
  const s = sanitizePilotState(merged)
  assert.ok(typeof s.mission.west === 'string')
  assert.ok(typeof s.mission.east === 'string')
  assert.ok(String(s.mission.startDate || '').includes('2024'))
  assert.equal(typeof s.spatial.useGridRepresentation, 'boolean')

  const fromOutput = mergeLoadedPilotState(base, {
    output: {
      nceiFileIdPrefix: false,
      doi: '10.5220/000000',
      metadataStandard: 'ISO 19115-2 from output',
      outputFormat: 'geojson',
      validationLevel: 'basic',
      distributionFormatName: 'NetCDF',
    },
  })
  assert.equal(fromOutput.distribution.nceiFileIdPrefix, false)
  assert.equal(fromOutput.mission.doi, '10.5220/000000')
  assert.equal(fromOutput.distribution.metadataStandard, 'ISO 19115-2 from output')
  assert.equal(fromOutput.distribution.format, 'geojson')
  assert.equal(fromOutput.distribution.distributionFormatName, 'NetCDF')
  assert.equal(fromOutput.mode, 'lenient', 'output.validationLevel basic maps to pilot lenient when top-level mode absent')

  const modeWins = mergeLoadedPilotState(base, {
    mode: 'catalog',
    output: { validationLevel: 'basic' },
  })
  assert.equal(modeWins.mode, 'catalog', 'explicit loaded.mode must not be overridden by output.validationLevel')
}

function checkPilotToLegacyFormDataFixture() {
  const state = defaultPilotState()
  state.mission.fileId = 'fid-1'
  state.mission.title = 'T'
  state.mission.org = 'Org'
  state.mission.email = 'a@b.co'
  state.mission.west = '-122'
  state.mission.east = '-121'
  state.mission.south = '36'
  state.mission.north = '37'
  state.keywords.sciencekeywords = [{ label: 'Oceans', uuid: 'u1' }]
  const fd = pilotStateToLegacyFormData(state)
  assert.equal(fd.mission.missionId, 'fid-1')
  assert.equal(fd.mission.contactEmail, 'a@b.co')
  assert.ok(fd.mission.gcmdKeywords?.length >= 1)
  assert.ok(fd.spatial.boundingBox?.upperLeft)
  assert.equal(pilotModeToValidationEngineLevel('lenient'), 'basic')
  assert.equal(pilotModeToValidationEngineLevel('strict'), 'strict')
}

function checkPlatformSheetMappingFixture() {
  const row = {
    id: 'UUV-ROW-1',
    name: 'Test UUV',
    type: 'UUV',
    manufacturer: 'Norbit',
    model: 'WBMS',
    comments: 'Multibeam payload',
    serialNumber: 'SN-9',
    deploymentDate: '2024-06-01',
    weight: 120,
    length: 1.5,
    width: 0.6,
    height: 0.4,
    powerSource: 'battery',
    navigationSystem: 'INS+GPS',
  }
  const patch = mapPlatformRowToPilotPatch(row)
  const base = defaultPilotState()
  const merged = { ...base.platform, ...patch }
  const save = mapPilotPlatformToSavePlatform(merged)
  assert.equal(save.id, 'UUV-ROW-1')
  assert.equal(save.name, 'Test UUV')
  assert.equal(save.type, 'UUV')
  assert.equal(save.manufacturer, 'Norbit')
  assert.equal(save.model, 'WBMS')
  assert.equal(save.comments, 'Multibeam payload')
  assert.equal(save.serialNumber, 'SN-9')
  assert.equal(save.deploymentDate, '2024-06-01')
  assert.equal(save.weight, 120)
  assert.equal(save.length, 1.5)
  assert.equal(save.width, 0.6)
  assert.equal(save.height, 0.4)
  assert.equal(save.powerSource, 'battery')
  assert.equal(save.navigationSystem, 'INS+GPS')
}

function checkNoaaFixtureImport() {
  const fixture = path.resolve(
    process.cwd(),
    '../NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml',
  )
  const raw = fs.readFileSync(fixture, 'utf8')
  const parsed = importPilotPartialStateFromXml(raw)
  assert.equal(parsed.ok, true, 'NOAA fixture should import')
  const partial = parsed.partial || {}
  assert.ok(partial.mission || partial.platform || partial.sensors || partial.distribution)
  const m = partial.mission || {}
  assert.ok(
    String(m.language || '').toLowerCase().includes('eng'),
    'UxS fixture: identification language should import from gco:CharacterString (e.g. eng; USA)',
  )
  assert.ok(
    String(m.individualName || m.org || '').includes('AT LEAST'),
    'UxS fixture: first real pointOfContact (after DocuComp xlink stub) should populate mission contact fields',
  )
  assert.ok(
    Array.isArray(m.topicCategories) && m.topicCategories.includes('oceans'),
    'UxS fixture: topic categories should import',
  )
  assert.ok(
    String(m.citationPublisherOrganisationName || '').includes('NOAA National Centers for Environmental Information'),
    'UxS fixture: citation publisher organisation should import',
  )
  const d = partial.distribution || {}
  assert.ok(
    String(d.distributionFeesText || '').toLowerCase().includes('electronic'),
    'UxS fixture: distribution fees text should import',
  )
  assert.ok(
    String(d.nceiDistributorContactHref || '').includes('docucomp'),
    'UxS fixture: distributor xlink href should import',
  )
  assert.equal(d.useNceiMetadataContactXlink, true, 'UxS fixture: root metadata contact xlink should set useNceiMetadataContactXlink')
  assert.ok(
    String(m.graphicOverviewHref || '').includes('docucomp'),
    'UxS fixture: graphicOverview xlink should import',
  )
  assert.equal(d.metadataMaintenanceFrequency, 'asNeeded', 'UxS fixture: maintenance frequency should import')
  for (const u of [d.landingUrl, d.metadataLandingUrl, d.downloadUrl]) {
    const s = String(u || '')
    if (!s) continue
    assert.ok(!s.includes('{{'), 'UxS fixture: distribution URLs must not contain template placeholders')
    assert.ok(/^https?:\/\//i.test(s), 'UxS fixture: imported distribution URLs must be http(s)')
  }
}

/**
 * Imports the NOAA/Navy UxS XML template, merges it into a mission state,
 * and reports all validation issues for each mode.
 *
 * Non-fatal: template contains {{placeholder}} values so errors are expected.
 * The purpose is to show exactly which fields still need real values.
 */
function reportNoaaFixtureValidation() {
  const FIXTURE_REL = '../NOAANavyUxSAcquisition_MetadataTempate_19115-2-GMI_2026-2 (1).xml'
  const fixture = path.resolve(process.cwd(), FIXTURE_REL)
  const raw = fs.readFileSync(fixture, 'utf8')

  const parsed = importPilotPartialStateFromXml(raw)
  assert.equal(parsed.ok, true, 'NOAA fixture XML must parse before validation')

  // Merge partial import onto a fresh default state so the validator sees a
  // complete shape (missing sections default to empty strings, not undefined).
  const merged = missionProfile.mergeLoaded(parsed.partial ?? {})
  const state = missionProfile.sanitize(merged)

  const engine = new ValidationEngine()
  const modes = ['lenient', 'strict', 'catalog']

  process.stdout.write('\n  NOAA/Navy UxS template validation report\n')
  process.stdout.write('  ─────────────────────────────────────────\n')

  // Engine uses single-char severities: 'e' = error, 'w' = warning.
  for (const mode of modes) {
    const result = engine.run({ profile: missionProfile, state, mode })
    const errs  = result.issues.filter(i => i.severity === 'e')
    const warns = result.issues.filter(i => i.severity === 'w')
    process.stdout.write(
      `  [${mode.padEnd(7)}]  score ${result.score}/${result.maxScore}` +
      `  errors: ${errs.length}  warnings: ${warns.length}\n`
    )
    for (const e of errs)  process.stdout.write(`    ✗ ${e.field.padEnd(40)} ${e.message}\n`)
    for (const w of warns) process.stdout.write(`    ⚠ ${w.field.padEnd(40)} ${w.message}\n`)
  }
  process.stdout.write('\n')

  // Hard assertion: lenient mode must surface <= errors than strict.
  const lenientErrs = engine.run({ profile: missionProfile, state, mode: 'lenient' }).errCount
  const strictErrs  = engine.run({ profile: missionProfile, state, mode: 'strict' }).errCount
  assert.ok(
    strictErrs >= lenientErrs,
    `strict mode should surface >= errors than lenient (got strict=${strictErrs} lenient=${lenientErrs})`,
  )
}

function maybeValidateXml(xml) {
  const check = spawnSync('xmllint', ['--version'], { encoding: 'utf8' })
  if (check.status !== 0) {
    process.stdout.write('- xmllint not found, skipped schema-free validation\n')
    return
  }
  const tmp = path.join(os.tmpdir(), `pilot-verify-${Date.now()}.xml`)
  fs.writeFileSync(tmp, xml, 'utf8')
  const result = spawnSync('xmllint', ['--noout', tmp], { encoding: 'utf8' })
  fs.rmSync(tmp, { force: true })
  assert.equal(result.status, 0, result.stderr || result.stdout || 'xmllint failed')
}

/** Sort issues for order-independent comparison. */
function sortIssues(issues) {
  return [...issues].sort((a, b) => {
    const k = (i) => `${i.severity}:${i.field}:${i.message}`
    return k(a).localeCompare(k(b))
  })
}

/**
 * Assert that missionValidationRuleSets produces identical issues to validatePilotState
 * for a given state and mode.
 */
function assertValidationParity(label, state, mode) {
  const engine = new ValidationEngine()
  const profileStub = { id: 'mission', validationRuleSets: missionValidationRuleSets }

  const ref = validatePilotState(mode, state)
  const cand = engine.run({ profile: profileStub, state, mode })

  const refSorted = sortIssues(ref.issues)
  const candSorted = sortIssues(cand.issues)

  if (refSorted.length !== candSorted.length) {
    const refFields = refSorted.map((i) => `${i.severity}:${i.field}: ${i.message}`)
    const candFields = candSorted.map((i) => `${i.severity}:${i.field}: ${i.message}`)
    const inRefOnly = refFields.filter((f) => !candFields.includes(f))
    const inCandOnly = candFields.filter((f) => !refFields.includes(f))
    throw new assert.AssertionError({
      message: `[${label} / ${mode}] issue count mismatch: validatePilotState=${refSorted.length} runProfileRules=${candSorted.length}\n  missing from rules: ${JSON.stringify(inRefOnly)}\n  extra in rules:     ${JSON.stringify(inCandOnly)}`,
    })
  }

  for (let i = 0; i < refSorted.length; i++) {
    const r = refSorted[i]
    const c = candSorted[i]
    if (r.severity !== c.severity || r.field !== c.field || r.message !== c.message) {
      throw new assert.AssertionError({
        message: `[${label} / ${mode}] issue[${i}] mismatch\n  ref:  ${JSON.stringify(r)}\n  cand: ${JSON.stringify(c)}`,
      })
    }
  }

  assert.equal(ref.score, cand.score, `[${label} / ${mode}] score mismatch`)
}

function checkValidationRulesParity() {
  // Fixture 1: empty state — exercises all required-field rules
  const empty = sanitizePilotState(defaultPilotState())

  // Fixture 2: seeded state — has some fields filled to exercise conditional rules
  const base = defaultPilotState()
  const seeded = sanitizePilotState({
    ...base,
    mission: {
      ...base.mission,
      fileId: 'parity-file-id',
      title: 'Parity title',
      abstract: 'Parity abstract',
      purpose: 'Research',
      status: 'completed',
      language: 'eng',
      org: 'NOAA',
      individualName: 'Jane Doe',
      email: 'jane@noaa.gov',
      startDate: '2024-01-01',
      endDate: '2024-01-02',
      dataLicensePreset: 'custom',
      licenseUrl: '',   // intentionally blank to trigger conditional warning/error
    },
    platform: {
      ...base.platform,
      platformType: 'UUV',
      platformId: 'UUV-1',
      platformDesc: 'Test UUV',
    },
    sensors: [
      {
        ...base.sensors[0],
        sensorId: 'SEN-1',
        modelId: 'SEN-1',
        type: 'Earth Remote Sensing Instruments',
        variable: 'bathymetry',
      },
    ],
    keywords: {
      ...base.keywords,
      sciencekeywords: [{ label: 'Oceans > Ocean Optics', uuid: 'u1' }],
      datacenters: [{ label: 'NOAA', uuid: 'u2' }],
      platforms: [{ label: 'UUV', uuid: 'u3' }],
      instruments: [{ label: 'Sonar', uuid: 'u4' }],
      locations: [{ label: 'Pacific Ocean', uuid: 'u5' }],
      projects: [{ label: 'UxS', uuid: 'u6' }],
      providers: [{ label: 'NOAA CoastWatch', uuid: 'u7' }],
    },
    distribution: {
      ...base.distribution,
      format: 'NetCDF',
      license: 'Public Domain',
    },
  })

  for (const mode of ['lenient', 'strict', 'catalog']) {
    assertValidationParity('empty', empty, mode)
    assertValidationParity('seeded', seeded, mode)
  }
}

// ── Mapper roundtrip tests ────────────────────────────────────────────────────

/**
 * pilotState → canonical → pilotState must equal sanitizePilotState(original)
 * for both the empty default and the seeded demo fixture.
 */
function checkPilotStateMapperRoundtrip() {
  const fixtures = [
    { label: 'empty defaultPilotState', state: defaultPilotState() },
    { label: 'seeded pilotState', state: (() => {
      // Build the seeded state by importing from missionProfile
      return missionProfile.initState ? missionProfile.initState() : missionProfile.defaultState()
    })() },
  ]

  for (const { label, state } of fixtures) {
    const canonical = pilotStateToCanonical(state)

    // canonical must have required top-level keys
    assert.ok(canonical && typeof canonical === 'object', `${label}: pilotStateToCanonical must return an object`)
    assert.ok('identification' in canonical, `${label}: canonical must have identification`)
    assert.ok('contact' in canonical, `${label}: canonical must have contact`)
    assert.ok('spatialExtent' in canonical, `${label}: canonical must have spatialExtent`)
    assert.ok('keywords' in canonical, `${label}: canonical must have keywords`)

    // Round-trip: canonical → pilotState → sanitize must equal sanitize(original)
    const roundTripped = canonicalToPilotState(canonical)
    const expected = sanitizePilotState(state)
    const actual = sanitizePilotState(roundTripped)

    // Compare key mission fields
    for (const field of ['fileId', 'title', 'abstract', 'org', 'email', 'startDate', 'endDate', 'accession', 'doi']) {
      assert.equal(
        actual.mission?.[field] ?? '',
        expected.mission?.[field] ?? '',
        `${label}: mission.${field} did not survive roundtrip`,
      )
    }
    // Spatial extent
    for (const field of ['west', 'east', 'south', 'north']) {
      assert.equal(
        actual.mission?.[field] ?? '',
        expected.mission?.[field] ?? '',
        `${label}: mission.${field} (bbox) did not survive roundtrip`,
      )
    }
    // Validation mode
    assert.equal(
      actual.mode ?? 'lenient',
      expected.mode ?? 'lenient',
      `${label}: mode did not survive roundtrip`,
    )
    assert.deepEqual(
      actual.mission?.topicCategories ?? [],
      expected.mission?.topicCategories ?? [],
      `${label}: mission.topicCategories did not survive roundtrip`,
    )
    assert.equal(
      actual.mission?.citationPublisherOrganisationName ?? '',
      expected.mission?.citationPublisherOrganisationName ?? '',
      `${label}: mission.citationPublisherOrganisationName did not survive roundtrip`,
    )
    assert.equal(
      actual.mission?.graphicOverviewHref ?? '',
      expected.mission?.graphicOverviewHref ?? '',
      `${label}: mission.graphicOverviewHref did not survive roundtrip`,
    )
  }
}

/**
 * canonicalToLegacyFormData must produce output identical to
 * pilotStateToLegacyFormData(original) for the same state.
 *
 * legacyFormDataToCanonical(legacyFormData) must restore the same
 * canonical identification fields as pilotStateToCanonical(original).
 */
function checkLegacyFormDataMapperRoundtrip() {
  const state = defaultPilotState()
  const canonical = pilotStateToCanonical(state)

  // Reverse: canonical → legacyFormData must match pilotStateToLegacyFormData(original)
  const viaMapper = canonicalToLegacyFormData(canonical)
  const direct = pilotStateToLegacyFormData(state)

  assert.ok(viaMapper && typeof viaMapper === 'object', 'canonicalToLegacyFormData must return an object')
  assert.ok(viaMapper.mission && viaMapper.platform, 'canonicalToLegacyFormData must return mission + platform keys')

  for (const field of ['missionId', 'missionTitle', 'organization', 'contactEmail']) {
    assert.equal(
      String(viaMapper.mission?.[field] ?? ''),
      String(direct.mission?.[field] ?? ''),
      `canonicalToLegacyFormData: mission.${field} mismatch vs direct`,
    )
  }

  // Forward: legacyFormData → canonical must restore identification fields
  const legacyDirect = pilotStateToLegacyFormData(state)
  const fromLegacy = legacyFormDataToCanonical(legacyDirect)

  assert.ok(fromLegacy?.identification, 'legacyFormDataToCanonical must return identification')
  assert.equal(
    fromLegacy.identification.fileId ?? '',
    canonical.identification.fileId ?? '',
    'legacyFormDataToCanonical: identification.fileId must match',
  )
  assert.equal(
    fromLegacy.identification.title ?? '',
    canonical.identification.title ?? '',
    'legacyFormDataToCanonical: identification.title must match',
  )
}

// ── BEDI fixture paths ────────────────────────────────────────────────────────
const BEDI_COLLECTION_XML = path.resolve(
  process.env.HOME ?? os.homedir(),
  'Downloads/BEDI_Biolum2009_submission_ready/Biolum2009_collection.xml',
)
const BEDI_GRANULE_XML = path.resolve(
  process.env.HOME ?? os.homedir(),
  'Downloads/BEDI_Biolum2009_submission_ready/BIOLUM2009_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1.xml',
)

function reportBediCollectionValidation() {
  if (!fs.existsSync(BEDI_COLLECTION_XML)) {
    process.stdout.write(`  (skipped — fixture not found: ${BEDI_COLLECTION_XML})\n`)
    return
  }
  const xml = fs.readFileSync(BEDI_COLLECTION_XML, 'utf8')
  const parsed = parseBediCollectionXml(xml)
  assert.ok(parsed.ok, `BEDI collection parse failed: ${parsed.error}`)

  const { partial, warnings } = parsed
  if (warnings.length) {
    process.stdout.write(`\n  parse warnings: ${warnings.join('; ')}`)
  }

  // Merge into profile default and validate
  const merged = bediCollectionProfile.mergeLoaded(partial)
  const engine = new ValidationEngine()

  process.stdout.write('\n')
  for (const mode of ['lenient', 'strict', 'catalog']) {
    const result = engine.run({ profile: bediCollectionProfile, state: merged, mode })
    const errs  = result.issues.filter((i) => i.severity === 'e')
    const warns = result.issues.filter((i) => i.severity === 'w')
    process.stdout.write(
      `  [bediCollection/${mode}] score ${result.score}/100  errors:${result.errCount}  warnings:${result.warnCount}\n`,
    )
    if (errs.length)  process.stdout.write(`    errors:   ${errs.map((i) => `${i.field} — ${i.message}`).join('\n              ')}\n`)
    if (warns.length) process.stdout.write(`    warnings: ${warns.map((i) => `${i.field} — ${i.message}`).join('\n              ')}\n`)
  }

  // Assertions: score should be > 70 (real data, most fields present)
  const lenient = engine.run({ profile: bediCollectionProfile, state: merged, mode: 'lenient' })
  assert.ok(lenient.score > 70, `BEDI collection lenient score ${lenient.score} is too low — parser is not extracting required fields`)
  // Strict should have same or more errors than lenient
  const strict = engine.run({ profile: bediCollectionProfile, state: merged, mode: 'strict' })
  assert.ok(strict.errCount >= lenient.errCount, `strict errCount (${strict.errCount}) < lenient (${lenient.errCount})`)
}

function reportBediGranuleValidation() {
  if (!fs.existsSync(BEDI_GRANULE_XML)) {
    process.stdout.write(`  (skipped — fixture not found: ${BEDI_GRANULE_XML})\n`)
    return
  }
  const xml = fs.readFileSync(BEDI_GRANULE_XML, 'utf8')
  const parsed = parseBediGranuleXml(xml)
  assert.ok(parsed.ok, `BEDI granule parse failed: ${parsed.error}`)

  const { partial, warnings } = parsed
  if (warnings.length) {
    process.stdout.write(`\n  parse warnings: ${warnings.join('; ')}`)
  }

  // Must have extracted parentCollectionId
  assert.ok(
    partial.parentCollectionId?.startsWith('gov.noaa.ncei.oer:'),
    `parentCollectionId not extracted correctly: "${partial.parentCollectionId}"`,
  )
  assert.equal(partial.diveId, 'JSL2-3699', `diveId mismatch: "${partial.diveId}"`)
  assert.equal(partial.tapeNumber, '1', `tapeNumber mismatch: "${partial.tapeNumber}"`)
  assert.equal(partial.segmentNumber, '1', `segmentNumber mismatch: "${partial.segmentNumber}"`)

  const merged = bediGranuleProfile.mergeLoaded(partial)
  const engine = new ValidationEngine()

  process.stdout.write('\n')
  for (const mode of ['lenient', 'strict', 'catalog']) {
    const result = engine.run({ profile: bediGranuleProfile, state: merged, mode })
    const errs  = result.issues.filter((i) => i.severity === 'e')
    const warns = result.issues.filter((i) => i.severity === 'w')
    process.stdout.write(
      `  [bediGranule/${mode}] score ${result.score}/100  errors:${result.errCount}  warnings:${result.warnCount}\n`,
    )
    if (errs.length)  process.stdout.write(`    errors:   ${errs.map((i) => `${i.field} — ${i.message}`).join('\n              ')}\n`)
    if (warns.length) process.stdout.write(`    warnings: ${warns.map((i) => `${i.field} — ${i.message}`).join('\n              ')}\n`)
  }

  const lenient = engine.run({ profile: bediGranuleProfile, state: merged, mode: 'lenient' })
  assert.ok(lenient.score > 60, `BEDI granule lenient score ${lenient.score} is too low — parser is not extracting required fields`)
  const strict = engine.run({ profile: bediGranuleProfile, state: merged, mode: 'strict' })
  assert.ok(strict.errCount >= lenient.errCount, `strict errCount (${strict.errCount}) < lenient (${lenient.errCount})`)
}

/** Build preview XML from profile state, re-parse, and assert critical fields round-trip. */
function checkBediXmlPreviewImportRoundtrip() {
  const coll = bediCollectionProfile.mergeLoaded({
    metadataUuid:     '11111111-2222-3333-4444-555555555555',
    fileId:             'gov.noaa.ncei.oer:VERIFY_BEDI_COLLECTION',
    collectionId:       'VerifyCruise',
    nceiAccessionId:    '0099999',
    nceiMetadataId:     'meta-verify-1',
    title:              'Verify BEDI collection preview roundtrip',
    abstract:           'Synthetic abstract for automated preview import test.',
    hierarchyLevel:     'fieldSession',
    hierarchyLevelName: 'Project Level Metadata',
    creationDate:       '2020-01-15',
    west:               '-64.5',
    east:               '-63.5',
    south:              '32.0',
    north:              '33.0',
    startDate:          '2020-01-01',
    endDate:            '2020-01-02',
    landingPageUrl:     'https://example.org/verify-collection',
    granulesSearchUrl:  'https://example.org/verify-search',
    platforms:          ['R/V Verify'],
    scienceKeywords:    ['Oceans'],
    scienceKeywordHrefs: ['https://gcmd.earthdata.nasa.gov/kms/concepts/concept/verify-oceans-test'],
    piName:             'Dr. Verify',
    piOrg:              'NOAA',
    contactNceiHref:    'https://example.org/verify-ncei-docucomp',
    contactOerHref:     'https://example.org/verify-oer-docucomp',
    resourceUseLimitation: 'VERIFY use limitation text for import round-trip.',
  })
  const xmlColl = buildBediCollectionXmlPreview(coll)
  assert.ok(
    xmlColl.includes('uuid="11111111-2222-3333-4444-555555555555"'),
    'collection preview must echo metadataUuid on root element',
  )
  assert.ok(xmlColl.includes('xmlns:gsr='), 'collection preview should declare gsr namespace (NCEI cruise template)')
  assert.ok(xmlColl.includes('<gmd:metadataMaintenance>'), 'collection preview should include metadataMaintenance')
  assert.ok(!xmlColl.includes('LI_Lineage'), 'collection preview omits dataQualityInfo lineage (NCEI cruise template)')
  assert.ok(
    xmlColl.includes('<gmd:code><gco:CharacterString>VerifyCruise</gco:CharacterString></gmd:code>'),
    'collection cruise identifier should be bare code in first MD_Identifier',
  )
  assert.ok(
    xmlColl.includes('xlink:href="https://example.org/verify-ncei-docucomp"'),
    'collection preview should emit NCEI docucomp xlink on root contact / POC / distributor',
  )
  assert.ok(xmlColl.includes('<gmd:MD_LegalConstraints>'), 'collection preview should include resourceConstraints')
  assert.ok(xmlColl.includes('VERIFY use limitation text'), 'collection preview should echo custom useLimitation')
  assert.ok(xmlColl.includes('gml:id="start"'), 'collection temporal should use TimeInstant id=start')
  assert.ok(xmlColl.includes('gml:id="end"'), 'collection temporal should use TimeInstant id=end')
  assert.ok(xmlColl.includes('GCMD Science Keywords'), 'collection preview should include GCMD science thesaurus title')
  assert.ok(xmlColl.includes('19.6.0'), 'collection GCMD thesaurus should include edition')
  assert.ok(xmlColl.includes('<gmx:Anchor '), 'collection science/datacenter keywords should use gmx:Anchor')
  assert.ok(
    xmlColl.includes('https://gcmd.earthdata.nasa.gov/kms/concepts/concept/verify-oceans-test'),
    'collection preview should honor explicit GCMD href on science keyword anchor',
  )
  assert.ok(xmlColl.includes('<gmd:EX_SpatialTemporalExtent>'), 'collection preview should include EX_SpatialTemporalExtent')
  assert.ok(xmlColl.includes('cruiseSpatiotemporalExtent'), 'collection spatiotemporal TimePeriod id should be present')
  const parsedColl = parseBediCollectionXml(xmlColl)
  assert.ok(parsedColl.ok, `collection re-parse failed: ${parsedColl.error}`)
  assert.equal(parsedColl.partial.metadataUuid, coll.metadataUuid)
  assert.equal(parsedColl.partial.fileId, coll.fileId)
  assert.equal(parsedColl.partial.title, coll.title)
  assert.equal(parsedColl.partial.nceiAccessionId, coll.nceiAccessionId)
  assert.equal(parsedColl.partial.contactNceiHref, coll.contactNceiHref)
  assert.equal(parsedColl.partial.contactOerHref, coll.contactOerHref)
  assert.equal(parsedColl.partial.resourceUseLimitation, coll.resourceUseLimitation)
  assert.ok(
    parsedColl.partial.platforms.includes('R/V Verify'),
    'platform xlink:title should round-trip',
  )
  assert.ok(
    parsedColl.partial.scienceKeywords.includes('Oceans'),
    'GCMD science keyword text should round-trip from gmx:Anchor',
  )
  assert.equal(parsedColl.partial.scienceKeywordHrefs[0], coll.scienceKeywordHrefs[0])

  const granFileId =
    'gov.noaa.ncei.oer:VERIFY_VID_20090730_SIT_DIVE_JSL2-3699_TAPE1OF1_SEG1OF1'
  const gran = bediGranuleProfile.mergeLoaded({
    metadataUuid:               'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    fileId:                     granFileId,
    parentCollectionId:         'gov.noaa.ncei.oer:VERIFY_BEDI_COLLECTION',
    granuleId:                  'VERIFY_SEG1',
    title:                      'Verify BEDI granule preview roundtrip',
    abstract:                   'Synthetic granule abstract.',
    diveId:                     'JSL2-3699',
    tapeNumber:                 '1',
    segmentNumber:              '1',
    hierarchyLevel:             'dataset',
    hierarchyLevelName:       'Granule',
    creationDate:               '2020-01-10',
    presentationForm:           'videoDigital',
    west:                       '-64.5',
    east:                       '-63.5',
    south:                      '32.0',
    north:                      '33.0',
    startDate:                  '2020-01-01T00:00:00Z',
    endDate:                    '2020-01-02T00:00:00Z',
    landingPageUrl:             'https://example.org/verify-granule',
    parentCollectionRef:        'Verify cruise title',
    parentCollectionLandingUrl: 'https://example.org/verify-collection',
    diveSummaryReportUrl:       'https://example.org/verify-dive-report.pdf',
    piName:                     'Dr. Granule Verify',
    piOrg:                      'NOAA Verify Lab',
    piEmail:                    'verify@example.org',
    dataCenterKeyword:          'VERIFY_GCMD_DATA_CENTER_KEYWORD',
    instrumentKeyword:          'VERIFY_GCMD_INSTRUMENT_KEYWORD',
    videoFilename:              'https://example.org/verify-video.mp4',
    contactNceiHref:            'https://example.org/verify-granule-ncei-docucomp',
    contactOerHref:             'https://example.org/verify-granule-oer-docucomp',
    contactPiHref:              'https://example.org/verify-granule-pi-docucomp',
    granulesSearchUrl:          'https://example.org/verify-granule-search',
    dataCenterKeywordHref:      'https://gcmd.earthdata.nasa.gov/kms/concepts/concept/verify-dc-test',
    instrumentKeywordHref:    'https://gcmd.earthdata.nasa.gov/kms/concepts/concept/verify-inst-test',
    resourceUseLimitation:      'VERIFY granule use limitation round-trip.',
  })
  const xmlGran = buildBediGranuleXmlPreview(gran)
  assert.ok(
    xmlGran.includes('uuid="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"'),
    'granule preview must echo metadataUuid on root element',
  )
  assert.ok(xmlGran.includes('xmlns:gsr='), 'granule preview should declare gsr namespace')
  assert.ok(
    xmlGran.indexOf('<gmd:language>') < xmlGran.indexOf('<gmd:parentIdentifier>'),
    'granule preview should place gmd:language before gmd:parentIdentifier (NCEI granule ordering)',
  )
  assert.ok(xmlGran.includes('<gmd:contact>'), 'granule preview should include root gmd:contact for PI')
  assert.ok(xmlGran.includes('Dr. Granule Verify'), 'granule root contact should include PI name')
  assert.ok(xmlGran.includes('gml:id="start"'), 'granule temporal should use TimeInstant id=start')
  assert.ok(xmlGran.includes('MD_CharacterSetCode'), 'granule preview should declare metadata characterSet')
  assert.ok(xmlGran.includes('DQ_DataQuality'), 'granule preview should include dataQuality block')
  assert.ok(xmlGran.includes('<gmd:metadataMaintenance>'), 'granule preview should include metadataMaintenance')
  assert.ok(xmlGran.includes('<gmd:distributorContact '), 'granule preview should include distributorContact')
  assert.ok(xmlGran.includes('https://example.org/verify-granule-ncei-docucomp'), 'granule distributor xlink should echo contactNceiHref')
  assert.ok(xmlGran.includes('<gmd:EX_SpatialTemporalExtent>'), 'granule preview should include EX_SpatialTemporalExtent')
  assert.ok(xmlGran.includes('<gmx:Anchor '), 'granule GCMD keyword preview should use gmx:Anchor')
  assert.ok(xmlGran.includes('https://gcmd.earthdata.nasa.gov/kms/concepts/concept/verify-dc-test'))
  assert.ok(xmlGran.includes('<gmd:citedResponsibleParty>'), 'granule citation should include citedResponsibleParty when PI is set')
  assert.ok(xmlGran.includes('VERIFY granule use limitation'), 'granule preview should echo custom resource use limitation')
  maybeValidateXml(xmlColl)
  maybeValidateXml(xmlGran)
  const parsedGran = parseBediGranuleXml(xmlGran)
  assert.ok(parsedGran.ok, `granule re-parse failed: ${parsedGran.error}`)
  assert.equal(parsedGran.partial.metadataUuid, gran.metadataUuid)
  assert.equal(parsedGran.partial.parentCollectionId, gran.parentCollectionId)
  assert.equal(parsedGran.partial.title, gran.title)
  assert.equal(parsedGran.partial.parentCollectionRef, gran.parentCollectionRef)
  assert.equal(parsedGran.partial.parentCollectionLandingUrl, gran.parentCollectionLandingUrl)
  assert.equal(parsedGran.partial.diveSummaryReportUrl, gran.diveSummaryReportUrl)
  assert.equal(parsedGran.partial.piName, gran.piName)
  assert.equal(parsedGran.partial.piOrg, gran.piOrg)
  assert.equal(parsedGran.partial.piEmail, gran.piEmail)
  assert.equal(parsedGran.partial.contactNceiHref, gran.contactNceiHref)
  assert.equal(parsedGran.partial.granulesSearchUrl, gran.granulesSearchUrl)
  assert.equal(parsedGran.partial.dataCenterKeyword, gran.dataCenterKeyword)
  assert.equal(parsedGran.partial.instrumentKeyword, gran.instrumentKeyword)
  assert.equal(parsedGran.partial.videoFilename, gran.videoFilename)
  assert.equal(parsedGran.partial.contactOerHref, gran.contactOerHref)
  assert.equal(parsedGran.partial.contactPiHref, gran.contactPiHref)
  assert.equal(parsedGran.partial.dataCenterKeywordHref, gran.dataCenterKeywordHref)
  assert.equal(parsedGran.partial.instrumentKeywordHref, gran.instrumentKeywordHref)
  assert.equal(parsedGran.partial.resourceUseLimitation, gran.resourceUseLimitation)
}

async function main() {
  let seededXml = ''
  step('seeded preview roundtrip', () => {
    seededXml = checkSeededRoundtrip()
  })
  step('NCEI fileIdentifier prefix (preview + import + off)', () => {
    checkNceiFileIdPrefixPreviewAndImport()
  })
  step('lineage + distributor + transfer preview import', () => {
    checkPilotXmlImportLineageDistributionRoundtrip()
  })
  step('CI_OnlineResource slot reorder import', () => {
    checkOnlineResourceSlotReorderImport()
  })
  step('NOAA fixture import', () => {
    checkNoaaFixtureImport()
  })
  step('NOAA fixture validation report', () => {
    reportNoaaFixtureValidation()
  })
  step('platform sheet mapping fixture', () => {
    checkPlatformSheetMappingFixture()
  })
  step('pilot → legacy formData mapping', () => {
    checkPilotToLegacyFormDataFixture()
  })
  step('Legacy-shaped merge + sanitize', () => {
    checkLegacySpreadsheetShapedMerge()
  })
  step('Manta text command parser', () => {
    const a = parseMantaCommands('Manta, make it simple and check the forms')
    assert.ok(a.some((c) => c.type === 'simple' && c.on))
    assert.ok(a.some((c) => c.type === 'lens' && c.open))
    const b = parseMantaCommands('go to spatial then zoom in on the map')
    assert.ok(b.some((c) => c.type === 'step' && c.id === 'spatial'))
    assert.ok(b.some((c) => c.type === 'map' && c.action === 'zoomIn'))
  })
  step('xmllint well-formed check', () => {
    maybeValidateXml(seededXml)
  })
  step('validation rules parity (runProfileRules == validatePilotState)', () => {
    checkValidationRulesParity()
  })
  step('pilotState ↔ canonical mapper roundtrip', () => {
    checkPilotStateMapperRoundtrip()
  })
  step('legacyFormData ↔ canonical mapper roundtrip', () => {
    checkLegacyFormDataMapperRoundtrip()
  })
  step('BEDI collection XML parse + validation', () => {
    reportBediCollectionValidation()
  })
  step('BEDI granule XML parse + validation', () => {
    reportBediGranuleValidation()
  })
  step('BEDI preview XML ↔ import roundtrip', () => {
    checkBediXmlPreviewImportRoundtrip()
  })
  step('BEDI scanner envelope — GCMD scienceKeywords merge + hrefs', () => {
    const env = {
      runId: 'verify-bedi-scan',
      profileId: 'bediCollection',
      suggestions: [
        {
          fieldPath: 'scienceKeywords',
          value: [
            { label: 'Earth Science > Oceans > Test A', uuid: '11111111-1111-1111-1111-111111111111' },
            { label: 'Earth Science > Oceans > Test B', uuid: '22222222-2222-2222-2222-222222222222' },
          ],
          confidence: 0.9,
          source: 'unit',
          model: 'test',
        },
      ],
    }
    const parsed = parseScannerSuggestionsToBediPartial(env, {})
    assert.equal(parsed.ok, true)
    const base = bediCollectionProfile.defaultState()
    base.scienceKeywords = ['Legacy plain keyword']
    base.scienceKeywordHrefs = ['']
    const merged = mergeBediScannerPartialIntoPilotState(base, /** @type {Record<string, unknown>} */ (parsed.partial))
    assert.ok(Array.isArray(merged.scienceKeywords))
    assert.ok(merged.scienceKeywords.includes('Legacy plain keyword'))
    assert.ok(merged.scienceKeywords.some((k) => String(k).includes('Test A')))
    assert.ok(Array.isArray(merged.scienceKeywordHrefs))
    assert.ok(
      String(merged.scienceKeywordHrefs.join(' ')).includes('11111111-1111-1111-1111-111111111111'),
    )
  })
  step('Lens Scanner suggestion adapter (paths + confidence + merge)', () => {
    const pilot = defaultPilotState()
    pilot.sensors = [{ ...pilot.sensors[0], modelId: 'BASE', localId: 'loc_base' }]
    const env = {
      runId: 'verify-scan',
      suggestions: [
        { fieldPath: 'mission.title', value: 'Scanned title', confidence: 0.99 },
        { fieldPath: 'sensors.0.modelId', value: 'SCAN-MODEL', confidence: 0.85 },
      ],
    }
    const res = parseScannerSuggestionsToMissionPartial(env, {})
    assert.equal(res.ok, true)
    const merged = mergeScannerPartialIntoPilotState(pilot, /** @type {Record<string, unknown>} */ (res.partial))
    assert.equal(merged.mission.title, 'Scanned title')
    assert.equal(merged.sensors[0].modelId, 'SCAN-MODEL')
    assert.equal(merged.sensors[0].localId, 'loc_base')

    const low = parseScannerSuggestionsToMissionPartial(
      {
        runId: 'low',
        suggestions: [{ fieldPath: 'mission.abstract', value: 'x', confidence: 0.1 }],
      },
      { minConfidence: 0.5 },
    )
    assert.equal(low.ok, false)
  })
  step('Scanner merge unions keyword facets by uuid', () => {
    const pilot = defaultPilotState()
    pilot.keywords.sciencekeywords = [
      { label: 'A', uuid: 'u-a' },
      { label: 'B', uuid: 'u-b' },
    ]
    const partial = {
      keywords: {
        sciencekeywords: [
          { label: 'B-new', uuid: 'u-b' },
          { label: 'C', uuid: 'u-c' },
        ],
      },
    }
    const merged = mergeScannerPartialIntoPilotState(pilot, partial)
    const sk = merged.keywords.sciencekeywords
    assert.equal(sk.length, 3)
    const b = sk.find((k) => k.uuid === 'u-b')
    assert.ok(b)
    assert.equal(b.label, 'B-new')
  })
  step('Scanner merge: multi-facet partial (heuristic v2 shape)', () => {
    const pilot = defaultPilotState()
    pilot.keywords.sciencekeywords = [{ label: 'Ocean', uuid: 'sk-1' }]
    pilot.keywords.platforms = [{ label: 'Ship', uuid: 'pf-1' }]
    pilot.keywords.instruments = [{ label: 'CTD', uuid: 'in-1' }]
    pilot.keywords.locations = [{ label: 'Atlantic', uuid: 'lo-1' }]
    pilot.keywords.providers = [{ label: 'NOAA', uuid: 'pr-1' }]
    pilot.keywords.projects = [{ label: 'OER', uuid: 'pj-1' }]
    const partial = {
      keywords: {
        sciencekeywords: [
          { label: 'Ocean updated', uuid: 'sk-1' },
          { label: 'Atmosphere', uuid: 'sk-2' },
        ],
        platforms: [
          { label: 'Ship updated', uuid: 'pf-1' },
          { label: 'Aircraft', uuid: 'pf-2' },
        ],
        instruments: [
          { label: 'CTD updated', uuid: 'in-1' },
          { label: 'ADCP', uuid: 'in-2' },
        ],
        locations: [
          { label: 'Atlantic updated', uuid: 'lo-1' },
          { label: 'Pacific', uuid: 'lo-2' },
        ],
        providers: [
          { label: 'NOAA updated', uuid: 'pr-1' },
          { label: 'NASA', uuid: 'pr-2' },
        ],
        projects: [
          { label: 'OER updated', uuid: 'pj-1' },
          { label: 'CMR', uuid: 'pj-2' },
        ],
      },
    }
    const merged = mergeScannerPartialIntoPilotState(pilot, partial)
    const sk = merged.keywords.sciencekeywords
    const pf = merged.keywords.platforms
    const ins = merged.keywords.instruments
    const loc = merged.keywords.locations
    const prv = merged.keywords.providers
    const prj = merged.keywords.projects
    assert.equal(sk.length, 2)
    assert.equal(pf.length, 2)
    assert.equal(ins.length, 2)
    assert.equal(loc.length, 2)
    assert.equal(prv.length, 2)
    assert.equal(prj.length, 2)
    assert.equal(sk.find((k) => k.uuid === 'sk-1')?.label, 'Ocean updated')
    assert.equal(sk.find((k) => k.uuid === 'sk-2')?.label, 'Atmosphere')
    assert.equal(pf.find((k) => k.uuid === 'pf-1')?.label, 'Ship updated')
    assert.equal(pf.find((k) => k.uuid === 'pf-2')?.label, 'Aircraft')
    assert.equal(ins.find((k) => k.uuid === 'in-1')?.label, 'CTD updated')
    assert.equal(ins.find((k) => k.uuid === 'in-2')?.label, 'ADCP')
    assert.equal(loc.find((k) => k.uuid === 'lo-1')?.label, 'Atlantic updated')
    assert.equal(loc.find((k) => k.uuid === 'lo-2')?.label, 'Pacific')
    assert.equal(prv.find((k) => k.uuid === 'pr-1')?.label, 'NOAA updated')
    assert.equal(prv.find((k) => k.uuid === 'pr-2')?.label, 'NASA')
    assert.equal(prj.find((k) => k.uuid === 'pj-1')?.label, 'OER updated')
    assert.equal(prj.find((k) => k.uuid === 'pj-2')?.label, 'CMR')
  })
  step('UxS collection context state + canonical roundtrip', () => {
    const base = defaultPilotState()
    const merged = mergeLoadedPilotState(base, {
      mission: {
        uxsContext: {
          primaryLayer: 'dive',
          diveName: '  Dive 7  ',
          diveId: ' DIVE-007 ',
          operationOutcome: 'partial',
          narrative: '  One sensor leg was shortened. ',
        },
      },
    })
    assert.equal(merged.mission.uxsContext.primaryLayer, 'dive')
    assert.equal(merged.mission.uxsContext.diveName, 'Dive 7')
    assert.equal(merged.mission.uxsContext.diveId, 'DIVE-007')
    assert.equal(merged.mission.uxsContext.operationOutcome, 'partial')
    assert.equal(merged.mission.uxsContext.narrative, 'One sensor leg was shortened.')

    const sanitized = sanitizePilotState({
      ...base,
      mission: {
        ...base.mission,
        uxsContext: {
          primaryLayer: 'invalid-layer',
          operationOutcome: 'failed-hard',
          runId: ' RUN-1 ',
        },
      },
    })
    assert.equal(sanitized.mission.uxsContext.primaryLayer, 'datasetProduct')
    assert.equal(sanitized.mission.uxsContext.operationOutcome, '')
    assert.equal(sanitized.mission.uxsContext.runId, 'RUN-1')

    const canonical = pilotStateToCanonical(merged)
    const roundTrip = sanitizePilotState(canonicalToPilotState(canonical))
    assert.equal(roundTrip.mission.uxsContext.primaryLayer, 'dive')
    assert.equal(roundTrip.mission.uxsContext.diveId, 'DIVE-007')
  })
  step('mission abstract quality warnings', () => {
    const base = defaultPilotState()
    const state = sanitizePilotState({
      ...base,
      mission: {
        ...base.mission,
        abstract: 'ABC survey.',
      },
      platform: {
        ...base.platform,
        platformId: 'REMUS-600',
      },
      sensors: [
        {
          ...base.sensors[0],
          sensorId: 'CTD-1',
          modelId: 'CTD-1',
          variable: 'conductivity',
        },
      ],
    })
    const result = validatePilotState('lenient', state)
    const abstractWarnings = result.issues.filter((i) => i.field === 'mission.abstract' && i.severity === 'w')
    assert.ok(abstractWarnings.some((i) => i.message.includes('short')), 'thin abstract should warn on length')
    assert.ok(abstractWarnings.some((i) => i.message.includes('platform')), 'abstract should warn on missing platform/sensor context')
    assert.ok(abstractWarnings.some((i) => i.message.includes('ABC')), 'abstract should warn on unexplained acronym')
  })
  step('GCMD keyword chip UUID quality warnings', () => {
    assert.ok(
      getMissionFieldLabel('keywords.sciencekeywords[0].uuid').includes('Science keywords'),
      'chip UUID fields get a readable validator label',
    )
    const missingUuid = collectGcmdKeywordUuidWarnings({
      sciencekeywords: [{ label: 'Labeled but no id', uuid: '   ' }],
    })
    assert.equal(missingUuid.length, 1)
    assert.equal(missingUuid[0].field, 'keywords.sciencekeywords[0].uuid')
    assert.ok(missingUuid[0].message.includes('KMS') || missingUuid[0].message.toLowerCase().includes('uuid'))

    const badUuid = collectGcmdKeywordUuidWarnings({
      sciencekeywords: [{ label: 'L', uuid: 'not-a-kms-uuid' }],
    })
    assert.equal(badUuid.length, 1)
    assert.equal(badUuid[0].field, 'keywords.sciencekeywords[0].uuid')
    assert.ok(
      badUuid[0].message.toLowerCase().includes('kms') || badUuid[0].message.toLowerCase().includes('look'),
    )

    const ok = collectGcmdKeywordUuidWarnings({
      sciencekeywords: [{ label: 'Oceans', uuid: 'a1b2c3d4-e5f6-4a0b-8c0d-ef1234567890' }],
    })
    assert.equal(ok.length, 0)

    const withBadChip = {
      ...defaultPilotState(),
      keywords: {
        ...defaultPilotState().keywords,
        sciencekeywords: [{ label: 'Needs uuid', uuid: '   ' }],
      },
    }
    const vr = validatePilotState('lenient', withBadChip)
    const fromValidate = vr.issues.find(
      (i) => i.field === 'keywords.sciencekeywords[0].uuid' && i.severity === 'w',
    )
    assert.ok(fromValidate, 'validatePilotState should include chip-level uuid quality warnings')
  })
  step('readinessSummary computeReadinessSnapshot', () => {
    const engine = new ValidationEngine()
    const snap = computeReadinessSnapshot(defaultPilotState(), engine, missionProfile)
    assert.ok(typeof snap.lenient.errCount === 'number')
    assert.ok(typeof snap.strict.errCount === 'number')
    assert.ok(typeof snap.catalog.errCount === 'number')
    assert.ok(snap.lenient.errCount >= 0)
  })
  step('readinessSummary named readiness bundles', () => {
    const failing = {
      lenient: { errCount: 1, warnCount: 0, score: 92, maxScore: 100 },
      strict:  { errCount: 2, warnCount: 0, score: 80, maxScore: 100 },
      catalog: { errCount: 1, warnCount: 0, score: 90, maxScore: 100 },
    }
    const blocked = computeReadinessBundles(failing, { preflightSummary: { overall: 'WARN' }, isDirty: false })
    assert.equal(blocked.find((b) => b.id === 'draft')?.ready, false)
    assert.equal(blocked.find((b) => b.id === 'profile-valid')?.ready, false)
    assert.equal(blocked.find((b) => b.id === 'iso-ready')?.ready, false)
    assert.equal(blocked.find((b) => b.id === 'discovery-ready')?.ready, false)
    assert.equal(blocked.find((b) => b.id === 'comet-preflight')?.ready, false)
    assert.equal(blocked.find((b) => b.id === 'handoff-ready')?.ready, false)

    const passing = {
      lenient: { errCount: 0, warnCount: 0, score: 100, maxScore: 100 },
      strict:  { errCount: 0, warnCount: 0, score: 100, maxScore: 100 },
      catalog: { errCount: 0, warnCount: 0, score: 100, maxScore: 100 },
    }
    const ready = computeReadinessBundles(passing, { preflightSummary: { overall: 'PASS' }, isDirty: false })
    assert.deepEqual(
      Object.fromEntries(ready.map((b) => [b.id, b.ready])),
      { draft: true, 'profile-valid': true, 'iso-ready': true, 'discovery-ready': true, 'comet-preflight': true, 'handoff-ready': true },
    )
    const dirty = computeReadinessBundles(passing, { preflightSummary: { overall: 'PASS' }, isDirty: true })
    assert.equal(dirty.find((b) => b.id === 'handoff-ready')?.ready, false)
  })
  await asyncStep('GCMD client ranks stronger local matches first', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = async (url) => {
      const u = String(url)
      // Fast path: pattern search. In this test we force a fallback to the full scheme scan
      // so the ranking behavior stays explicit and stable.
      const isSchemePattern = u.includes('/concepts/concept_scheme/') && u.includes('/pattern/')
      const isGlobalPattern = u.includes('/concepts/pattern/')
      if (isSchemePattern || isGlobalPattern) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { concepts: [] }
          },
        }
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            concepts: [
              { uuid: 'weak', prefLabel: 'Earth Science > Oceans > Ocean Temperature > Hydrographic Sounding Products Archive' },
              { uuid: 'exact', prefLabel: 'Hydrographic Sounding' },
              { uuid: 'prefix', prefLabel: 'Hydrographic Sounding Profiles' },
            ],
          }
        },
      }
    }
    try {
      const rows = await searchGcmdSchemeClient('sciencekeywords', 'hydrographic sounding', { maxMatches: 3 })
      assert.equal(rows[0].uuid, 'exact')
      assert.equal(rows[0].matchType, 'exact')
      assert.ok(rows[0].score > rows[1].score)
    } finally {
      globalThis.fetch = originalFetch
    }
  })
  await asyncStep('GCMD client can scan bounded additional pages', async () => {
    const originalFetch = globalThis.fetch
    /** @type {number[]} */
    const pages = []
    globalThis.fetch = async (url) => {
      const u = String(url)
      const isSchemePattern = u.includes('/concepts/concept_scheme/') && u.includes('/pattern/')
      const isGlobalPattern = u.includes('/concepts/pattern/')
      if (isSchemePattern || isGlobalPattern) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { concepts: [] }
          },
        }
      }
      const page = Number(new URL(String(url)).searchParams.get('page_num') || '1')
      pages.push(page)
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            concepts: page === 1
              ? [{ uuid: 'page-one-miss', prefLabel: 'Ocean Temperature' }]
              : [{ uuid: 'page-two-hit', prefLabel: 'Hydrographic Sounding' }],
          }
        },
      }
    }
    try {
      const rows = await searchGcmdSchemeClient('sciencekeywords', 'hydrographic sounding', {
        pageSize:   1,
        maxMatches: 5,
        maxPages:   2,
      })
      assert.deepEqual(pages, [1, 2])
      assert.equal(rows[0]?.uuid, 'page-two-hit')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
  await asyncStep('GCMD client global pattern fallback filters by scheme', async () => {
    const originalFetch = globalThis.fetch
    /** @type {string[]} */
    const globalPatternUrls = []
    globalThis.fetch = async (url) => {
      const u = String(url)
      const isSchemePattern = u.includes('/concepts/concept_scheme/') && u.includes('/pattern/')
      const isGlobalPattern = u.includes('/concepts/pattern/') && !u.includes('concept_scheme')
      if (isSchemePattern) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { concepts: [] }
          },
        }
      }
      if (isGlobalPattern) {
        globalPatternUrls.push(u)
        return {
          ok: true,
          status: 200,
          async json() {
            return {
              concepts: [
                {
                  uuid:        'from-global-skw',
                  prefLabel:   'Earth Science > Oceans > Global Pattern Test Term',
                  scheme:      { shortName: 'sciencekeywords' },
                },
                {
                  uuid:        'wrong-scheme',
                  prefLabel:   'Earth Science > Global Pattern Test Term (platform)',
                  scheme:      { shortName: 'platforms' },
                },
              ],
            }
          },
        }
      }
      if (u.includes('/concepts/concept_scheme/') && u.includes('format=json') && !u.includes('/pattern/')) {
        return {
          ok: true,
          status: 200,
          async json() {
            return { concepts: [] }
          },
        }
      }
      return {
        ok: true,
        status: 200,
        async json() {
          return { concepts: [] }
        },
      }
    }
    try {
      const rows = await searchGcmdSchemeClient('sciencekeywords', 'global pattern test term', { maxMatches: 5 })
      assert.ok(globalPatternUrls.length >= 1, 'global /concepts/pattern/... should be requested when scheme pattern is empty')
      assert.ok(
        globalPatternUrls.some((u) => u.includes('/concepts/pattern/') && !u.includes('concept_scheme')),
        'at least one global pattern URL should not use concept_scheme',
      )
      const hit = rows.find((r) => r.uuid === 'from-global-skw')
      assert.ok(hit, 'expected match from global pattern response for shortName=sciencekeywords')
      assert.equal(rows.find((r) => r.uuid === 'wrong-scheme'), undefined, 'platforms scheme should be filtered out')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
  await asyncStep('Lens scanner uses xmlSnippet and filtered phrase seeds', async () => {
    const originalFetch = globalThis.fetch
    /** @type {string[]} */
    const seenUrls = []
    globalThis.fetch = async (url) => {
      seenUrls.push(String(url))
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            concepts: [
              { uuid: 'science-hydrographic-sounding', prefLabel: 'Earth Science > Oceans > Hydrographic Sounding' },
              { uuid: 'science-ocean-mapping', prefLabel: 'Earth Science > Oceans > Ocean Mapping' },
              { uuid: 'platform-uuv', prefLabel: 'Uncrewed Underwater Vehicle' },
            ],
          }
        },
      }
    }
    try {
      const env = await runLensScanHeuristic({
        title:      'Using data from the mission',
        abstract:   'This NOAA NCEI dataset is based on survey results.',
        xmlSnippet: '<gmd:abstract><gco:CharacterString>Hydrographic sounding profiles</gco:CharacterString></gmd:abstract>',
        profileId:  'mission',
      })
      assert.equal(env.profileId, 'mission')
      assert.ok(
        seenUrls.some((u) => u.includes('sciencekeywords') && u.includes('pattern/')),
        'sciencekeywords pattern search should be attempted',
      )
      const science = env.suggestions.find((s) => s.fieldPath === 'keywords.sciencekeywords')
      assert.ok(science, 'xmlSnippet-only science keyword should produce a suggestion')
      assert.ok(
        JSON.stringify(science.value).includes('science-hydrographic-sounding'),
        'xmlSnippet text should be part of scanner seed generation',
      )
      assert.ok(
        String(science.evidence || '').includes('sourceText='),
        'merge suggestion evidence should include source text',
      )
      assert.ok(
        science.value.some((v) => v.uuid === 'science-hydrographic-sounding'),
        'science keyword value should include hydrographic sounding UUID',
      )
      const datacenters = env.suggestions.find((s) => s.fieldPath === 'keywords.datacenters')
      assert.ok(datacenters, 'NOAA/NCEI text should produce a data center suggestion')
      assert.ok(
        JSON.stringify(datacenters.value).includes('2f31b1f2-335f-4248-8165-215755953857'),
        'NCEI data center suggestion should use the GCMD NCEI concept UUID',
      )
    } finally {
      globalThis.fetch = originalFetch
    }
  })
  step('pilotAutoFix trim / date swap / bbox swap', () => {
    const pilot = defaultPilotState()
    pilot.mission.title = '  x  '
    pilot.mission.startDate = '2024-06-10'
    pilot.mission.endDate = '2024-06-01'
    pilot.mission.west = '10'
    pilot.mission.east = '-10'
    pilot.mission.south = '5'
    pilot.mission.north = '-5'
    pilot.mission.language = ''
    const { pilot: out, applied } = applyPilotAutoFixes('lenient', pilot)
    assert.ok(applied.some((a) => a.includes('title')))
    assert.ok(applied.some((a) => a.includes('swapped')))
    assert.equal(out.mission.startDate, '2024-06-01')
    assert.equal(out.mission.endDate, '2024-06-10')
    assert.equal(out.mission.west, '-10')
    assert.equal(out.mission.east, '10')
    assert.equal(out.mission.south, '-5')
    assert.equal(out.mission.north, '5')
    assert.equal(out.mission.language, 'eng')
  })
  step('mergeKeywordFacetArrays helper', () => {
    const m = mergeKeywordFacetArrays(
      [{ label: 'x', uuid: '1' }],
      [{ label: 'y', uuid: '1' }, { label: 'z', uuid: '2' }],
    )
    assert.equal(m.length, 2)
    assert.equal(m.find((r) => r.uuid === '1').label, 'y')
  })
  step('Netlify /api/db legacy GeoJSON + DCAT + validate path', () => {
    const state = defaultPilotState()
    state.mission.west = '-120'
    state.mission.east = '-119'
    state.mission.south = '45'
    state.mission.north = '46'
    state.mission.fileId = 'test-id'
    state.mission.title = 'Hello'
    const fd = pilotStateToLegacyFormData(state)
    const geo = generateGeoJSONString(fd)
    const gj = JSON.parse(geo)
    assert.equal(gj.type, 'FeatureCollection')
    assert.equal(gj.features[0].geometry.type, 'Polygon')

    const dcat = generateDCATString(fd)
    const d = JSON.parse(dcat)
    assert.equal(d['@type'], 'dcat:Dataset')

    const pilot = legacyFormDataToPilotState(fd)
    const engine = new ValidationEngine()
    const r = engine.run({ profile: missionProfile, state: pilot, mode: 'lenient' })
    assert.ok(Array.isArray(r.issues))
  })
  process.stdout.write('\nverify-pilot: all checks passed\n')
}

main().catch((err) => {
  console.error('\nverify-pilot failed')
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})
