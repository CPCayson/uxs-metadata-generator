#!/usr/bin/env node
/**
 * Generate representative BEDI collection + granule ISO previews and run `xmllint --noout`.
 * Optional full XSD validation: `npm run validate:bedi -- --schema` (uses NOAA schema URL from preview).
 *
 * Requires `xmllint` on PATH (macOS: libxml2; Linux: libxml2-utils).
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'

import { buildBediCollectionXmlPreview } from '../src/lib/bediCollectionXmlPreview.js'
import { buildBediGranuleXmlPreview } from '../src/lib/bediGranuleXmlPreview.js'
import { bediCollectionProfile } from '../src/profiles/bedi/bediCollectionProfile.js'
import { bediGranuleProfile } from '../src/profiles/bedi/bediGranuleProfile.js'

function findXmllint() {
  const r = spawnSync('xmllint', ['--version'], { encoding: 'utf8' })
  if (r.error && /** @type {NodeJS.ErrnoException} */ (r.error).code === 'ENOENT') return null
  return r.status === 0 ? 'xmllint' : null
}

const xmllint = findXmllint()
if (!xmllint) {
  console.error('xmllint not found — install libxml2 and retry.')
  process.exit(1)
}

const wantSchema = process.argv.includes('--schema')
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bedi-ncei-xml-'))

const coll = bediCollectionProfile.mergeLoaded({
  fileId:             'gov.noaa.ncei.oer:VALIDATE_BEDI_COLLECTION',
  collectionId:       'ValidateCruise',
  nceiAccessionId:    '0000001',
  title:              'Validate BEDI collection XML',
  abstract:           'Synthetic.',
  hierarchyLevel:     'fieldSession',
  hierarchyLevelName: 'Project Level Metadata',
  creationDate:       '2020-01-01',
  west: '-64', east: '-63', south: '32', north: '33',
  startDate: '2020-01-01', endDate: '2020-01-02',
  scienceKeywords: ['Oceans'],
  scienceKeywordHrefs: ['https://gcmd.earthdata.nasa.gov/kms/concepts/concept/validate-test'],
  datacenters: ['DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information'],
  contactNceiHref: 'https://www.ncei.noaa.gov/contact/validate',
  landingPageUrl: 'https://example.org/collection',
  granulesSearchUrl: 'https://example.org/granules',
  platforms: ['R/V Validate'],
})

const gran = bediGranuleProfile.mergeLoaded({
  fileId:             'gov.noaa.ncei.oer:VALIDATE_VID_20090730_SIT_DIVE_V-1_TAPE1OF1_SEG1OF1',
  parentCollectionId: 'gov.noaa.ncei.oer:VALIDATE_BEDI_COLLECTION',
  title:              'Validate BEDI granule XML',
  abstract:           'Synthetic granule.',
  hierarchyLevel:     'dataset',
  hierarchyLevelName: 'Granule',
  creationDate:       '2020-01-10',
  presentationForm:   'videoDigital',
  west: '-64', east: '-63', south: '32', north: '33',
  startDate: '2020-01-01T00:00:00Z', endDate: '2020-01-02T00:00:00Z',
  piName: 'Dr. Validate', piOrg: 'NOAA', piEmail: 'v@example.org',
  dataCenterKeyword: 'US DOC; NOAA; NCEI',
  dataCenterKeywordHref: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept/validate-dc',
  instrumentKeyword: 'video camera',
  instrumentKeywordHref: 'https://gcmd.earthdata.nasa.gov/kms/concepts/concept/validate-inst',
  contactNceiHref: 'https://www.ncei.noaa.gov/contact/validate',
  landingPageUrl: 'https://example.org/granule',
  videoFilename: 'https://example.org/clip.mp4',
})

const collPath = path.join(dir, 'collection.xml')
const granPath = path.join(dir, 'granule.xml')
fs.writeFileSync(collPath, buildBediCollectionXmlPreview(coll), 'utf8')
fs.writeFileSync(granPath, buildBediGranuleXmlPreview(gran), 'utf8')

function runXmllint(file, schemaUrl) {
  const args = ['--noout']
  if (schemaUrl) args.push('--schema', schemaUrl)
  args.push(file)
  const r = spawnSync(xmllint, args, { encoding: 'utf8' })
  if (r.status !== 0) {
    console.error(r.stderr || r.stdout || 'xmllint failed')
    process.exit(1)
  }
}

const schemaUrl = wantSchema
  ? 'https://data.noaa.gov/resources/iso19139/schema.xsd'
  : ''

runXmllint(collPath, schemaUrl)
runXmllint(granPath, schemaUrl)
fs.rmSync(dir, { recursive: true, force: true })

console.log(
  wantSchema
    ? 'validate-bedi-ncei-xml: OK (well-formed + schema where xmllint could fetch XSD)'
    : 'validate-bedi-ncei-xml: OK (well-formed)',
)
