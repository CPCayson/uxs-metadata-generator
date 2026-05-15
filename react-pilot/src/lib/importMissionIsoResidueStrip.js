/**
 * After ISO XML import into the mission pilot, remove known UxS **demo seed**
 * fingerprints (mission profile `seedPilotState`) that can linger when the
 * imported record is clearly external (e.g. NMFS InPort) or when a facet still
 * exactly matches the shipped demo chip set.
 *
 * @module lib/importMissionIsoResidueStrip
 */

import { defaultPilotState } from './pilotValidation.js'

/** GCMD / facet chips copied from `profiles/mission/missionProfile.js` seedPilotState. */
const SEED_KEYWORD_CHIPS = {
  sciencekeywords: [{ label: 'Oceans', uuid: '2ef69df0-bf69-4d5e-b7ff-0cece46ed206' }],
  datacenters: [
    { label: 'DOC/NOAA/NESDIS/NCEI > National Centers for Environmental Information' },
  ],
  platforms: [{ label: 'UAV', uuid: '3a1196e4-c0d0-4c8d-9a7d-0f5e0c5e5d01' }],
  instruments: [{ label: 'Multibeam Swath Bathymetry System', uuid: '4b22a7f5-d1e1-5d9e-ab8e-1a6f1d6f6e12' }],
  locations: [{ label: 'Gulf of Mexico', uuid: '5c33b8a6-e2f2-6e0f-bc9f-2b7a2e7a7f23' }],
  projects: [{ label: 'MDBC', uuid: '6d44c9b7-f3a3-7f1a-cdaf-3c8b3f8b8a34' }],
  providers: [{ label: 'NOAA', uuid: '7e55d0c8-a4b4-8a2b-dfc0-4d9c4a0c9b45' }],
}

const KW_FACETS = Object.keys(SEED_KEYWORD_CHIPS)

const PLACEHOLDER_DOI = '10.7289/V5ABC123'
const PLACEHOLDER_CITE_SUBSTR = 'NOAA UxS pilot QA dataset (placeholder)'

const DEFAULT_PLATFORM = {
  platformType: '',
  customPlatformType: '',
  platformId: '',
  platformName: '',
  platformDesc: '',
  manufacturer: '',
  model: '',
  serialNumber: '',
  weight: '',
  length: '',
  width: '',
  height: '',
  material: '',
  speed: '',
  powerSource: '',
  navigationSystem: '',
  sensorMounts: '',
  operationalArea: '',
  deploymentDate: '',
}

/** @param {unknown} c */
function normChip(c) {
  if (!c || typeof c !== 'object') return { label: '', uuid: '' }
  return {
    label: String(/** @type {{ label?: unknown }} */ (c).label ?? '').trim(),
    uuid: String(/** @type {{ uuid?: unknown }} */ (c).uuid ?? '').trim().toLowerCase(),
  }
}

/** @param {object} a @param {object} b */
function chipMatchesSeed(a, b) {
  const x = normChip(a)
  const y = normChip(b)
  if (x.label !== y.label) return false
  if (x.uuid && y.uuid) return x.uuid === y.uuid
  if (!x.uuid && !y.uuid) return true
  return x.uuid === y.uuid
}

/**
 * True when merged mission metadata is almost certainly not the packaged PS2418 demo.
 * @param {object} mission
 */
function looksLikeExternalCatalogMission(mission) {
  const fid = String(mission?.fileId || '').trim()
  if (/inport/i.test(fid)) return true
  if (/gov\.noaa\.nmfs/i.test(fid)) return true
  if (/gov\.noaa\./i.test(fid) && !/PS2418/i.test(fid)) return true
  return false
}

/**
 * @param {object} state mission pilotState (sanitized)
 * @returns {object} cloned state with residue removed
 */
export function stripMissionPilotIsoImportResidue(state) {
  if (!state || typeof state !== 'object') return state
  const out = JSON.parse(JSON.stringify(state))
  const m = out.mission && typeof out.mission === 'object' ? out.mission : {}
  const external = looksLikeExternalCatalogMission(m)

  if (!out.keywords || typeof out.keywords !== 'object') out.keywords = {}
  const kw = { ...out.keywords }

  for (const facet of KW_FACETS) {
    const arr = Array.isArray(kw[facet]) ? [...kw[facet]] : []
    const seedArr = SEED_KEYWORD_CHIPS[/** @type {keyof typeof SEED_KEYWORD_CHIPS} */ (facet)]
    const seedNorm = JSON.stringify(seedArr.map(normChip))
    const curNorm = JSON.stringify(arr.map(normChip))
    if (external) {
      kw[facet] = arr.filter((c) => !seedArr.some((s) => chipMatchesSeed(c, s)))
    } else if (curNorm === seedNorm) {
      kw[facet] = []
    }
  }
  out.keywords = kw

  if (String(m.doi || '').trim() === PLACEHOLDER_DOI) {
    out.mission = { ...out.mission, doi: '' }
  }
  const cite = String(m.citeAs || '')
  if (cite.includes(PLACEHOLDER_CITE_SUBSTR)) {
    out.mission = { ...out.mission, citeAs: '' }
  }

  if (external) {
    const d = out.distribution && typeof out.distribution === 'object' ? out.distribution : {}
    const nextDist = { ...d }
    const stripEx = (/** @type {string} */ u) => {
      const t = String(u || '').trim().toLowerCase()
      return t.includes('example.org')
    }
    if (stripEx(d.landingUrl)) nextDist.landingUrl = ''
    if (stripEx(d.downloadUrl)) nextDist.downloadUrl = ''
    out.distribution = nextDist

    if (String(m.parentProjectTitle || '').trim() === 'MDBC Restoration') {
      out.mission = { ...out.mission, parentProjectTitle: '', parentProjectCode: '', parentProjectDate: '' }
    }
    if (String(d.parentProject || '').trim() === 'MDBC Restoration') {
      out.distribution = { ...out.distribution, parentProject: '' }
    }

    const pid = String(out.platform?.platformId || '').trim()
    const mfr = String(out.platform?.manufacturer || '').trim()
    if (pid === 'UUV-01' && mfr === 'Norbit') {
      out.platform = { ...DEFAULT_PLATFORM }
    }

    const sensors = Array.isArray(out.sensors) ? out.sensors : []
    const s0 = sensors[0]
    if (
      s0
      && String(s0.type || '').includes('Earth Remote Sensing')
      && String(s0.modelId || '').includes('MBES-Norbit')
      && String(s0.variable || '').toLowerCase() === 'bathymetry'
    ) {
      out.sensors = JSON.parse(JSON.stringify(defaultPilotState().sensors))
    }
  }

  return out
}
