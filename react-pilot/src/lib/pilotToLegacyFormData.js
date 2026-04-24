/**
 * Maps React `pilotState` → legacy `collectFormData()`-like payload for GAS functions that call
 * `mapClientDataToServer` (`validateFormDataWithRules`, `generateGeoJSON`, `generateDCATJsonLd`, …).
 */

const KW_FACETS = [
  'sciencekeywords',
  'datacenters',
  'platforms',
  'instruments',
  'locations',
  'projects',
  'providers',
]

/**
 * @param {Record<string, unknown>} mission
 * @returns {Record<string, { lat: number, lon: number }> | null}
 */
function boundingBoxFromMissionAxes(mission) {
  const w = Number(mission?.west)
  const e = Number(mission?.east)
  const s = Number(mission?.south)
  const n = Number(mission?.north)
  if (![w, e, s, n].every((x) => Number.isFinite(x))) return null
  return {
    upperLeft: { lat: n, lon: w },
    upperRight: { lat: n, lon: e },
    lowerRight: { lat: s, lon: e },
    lowerLeft: { lat: s, lon: w },
  }
}

/**
 * @param {unknown} state
 * @returns {{ mission: object, platform: object, sensors: object[], spatial: object, output: object }}
 */
export function pilotStateToLegacyFormData(state) {
  const m = state?.mission && typeof state.mission === 'object' ? { ...state.mission } : {}
  const sp = state?.spatial && typeof state.spatial === 'object' ? { ...state.spatial } : {}
  const p = state?.platform && typeof state.platform === 'object' ? { ...state.platform } : {}
  const sensors = Array.isArray(state?.sensors) ? state.sensors.map((s) => ({ ...s })) : []
  const dist = state?.distribution && typeof state.distribution === 'object' ? { ...state.distribution } : {}
  const kw = state?.keywords && typeof state.keywords === 'object' ? state.keywords : {}

  const mission = {
    ...m,
    missionId: m.fileId ?? m.missionId ?? '',
    missionTitle: m.title ?? m.missionTitle ?? '',
    organization: m.org ?? m.organization ?? '',
    contactEmail: m.email ?? m.contactEmail ?? '',
    nceiAccessionId: m.accession ?? m.nceiAccessionId ?? '',
  }

  const gcmdKeywords = KW_FACETS.flatMap((facet) =>
    Array.isArray(kw[facet])
      ? kw[facet].map((k) => ({
          prefLabel: k?.label ?? '',
          uuid: k?.uuid ?? '',
          keywordVersion: k?.version ?? k?.keywordVersion ?? '',
        }))
      : [],
  ).filter((k) => k.prefLabel || k.uuid)
  if (gcmdKeywords.length) {
    mission.gcmdKeywords = gcmdKeywords
  }

  const ror = m.ror && typeof m.ror === 'object' ? m.ror : null
  if (ror?.id) {
    const id = String(ror.id).trim()
    const uri = id.startsWith('http') ? id : `https://ror.org/${id.replace(/^https?:\/\/ror\.org\//i, '')}`
    const shortId = id.replace(/^https?:\/\/ror\.org\//i, '')
    mission.organizationRor = {
      id: uri,
      shortId,
      displayName: String(ror.name || '').trim(),
      country: String(ror.country || '').trim(),
    }
    mission.organizationRorId = shortId
    mission.organizationRorUri = uri
    mission.organizationRorDisplayName = String(ror.name || '').trim()
    mission.organizationRorCountry = String(ror.country || '').trim()
  }

  const platform = {
    ...p,
    platformComments: p.platformDesc ?? p.platformComments ?? '',
  }

  const existingBbox = sp.boundingBox && typeof sp.boundingBox === 'object' ? sp.boundingBox : null
  const hasCornerKeys =
    existingBbox &&
    ['upperLeft', 'upperRight', 'lowerRight', 'lowerLeft'].some((k) => existingBbox[k])
  const fromMission = boundingBoxFromMissionAxes(m)
  const spatial = {
    ...sp,
    boundingBox: hasCornerKeys ? { ...existingBbox } : fromMission || {},
  }

  const output = {
    ...dist,
    outputFormat: dist.format || dist.outputFormat || 'xml',
    metadataStandard: dist.metadataStandard,
    metadataVersion: dist.metadataVersion,
    metadataLandingUrl: dist.metadataLandingUrl,
    downloadUrl: dist.downloadUrl,
    distributionFeesText: dist.distributionFeesText,
    distributionOrderingInstructions: dist.distributionOrderingInstructions,
    useNceiMetadataContactXlink: dist.useNceiMetadataContactXlink,
    omitRootReferenceSystemInfo: dist.omitRootReferenceSystemInfo,
    nceiMetadataContactHref: dist.nceiMetadataContactHref,
    nceiMetadataContactTitle: dist.nceiMetadataContactTitle,
    nceiDistributorContactHref: dist.nceiDistributorContactHref,
    nceiDistributorContactTitle: dist.nceiDistributorContactTitle,
    outputLocation: dist.outputLocation,
    awsBucket: dist.awsBucket,
    awsPrefix: dist.awsPrefix,
    finalNotes: dist.finalNotes,
    templateName: dist.templateName,
    templateCategory: dist.templateCategory,
  }

  return { mission, platform, sensors, spatial, output }
}

/**
 * @param {string} mode
 * @returns {string}
 */
export function pilotModeToValidationEngineLevel(mode) {
  const m = String(mode || '').trim().toLowerCase()
  if (m === 'lenient') return 'basic'
  return 'strict'
}
