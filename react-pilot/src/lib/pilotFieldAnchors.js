/**
 * Map validator `field` strings to DOM selectors (legacy-style ids in step components).
 * @param {string} field
 * @returns {string | null}
 */
export function selectorForPilotField(field) {
  if (!field || typeof field !== 'string') return null

  const data = `[data-pilot-field="${cssEscapeAttr(field)}"]`
  const direct = {
    'mission.fileId': '#fileId',
    'mission.title': '#title',
    'mission.abstract': '#abstract',
    'mission.startDate': '#startDate',
    'mission.endDate': '#endDate',
    'mission.org': '#org',
    'mission.individualName': '#individualName',
    'mission.email': '#email',
    'mission.purpose': '#purpose',
    'mission.status': '#missionStatus',
    'mission.language': '#language',
    'mission.publicationDate': '#publicationDate',
    'mission.metadataRecordDate': '#metadataRecordDate',
    'mission.contactUrl': '#contactUrl',
    'mission.licenseUrl': '#licenseUrl',
    'mission.doi': '#doi',
    'mission.accession': '#accession',
    'mission.dataLicensePreset': '#dataLicensePreset',
    'mission.relatedDataUrl': '#relatedDataUrl',
    'mission.bbox': '#west',
    'mission.vmin': '#vmin',
    'mission.vmax': '#vmax',
    'mission.vertical': '#vmin',
    'platform.platformType': '#platformType',
    'platform.platformId': '#platformId',
    'platform.platformDesc': '#platformDesc',
    'spatial.verticalCrsUrl': '#verticalCrsUrl',
    'spatial.gridRepresentation': '#gridColumnSize',
    'spatial.trajectorySampling': '#trajectorySampling',
    'spatial.accuracyValue': '#accuracyValue',
    'spatial.errorValue': '#errorValue',
    'distribution.format': '#format',
    'distribution.license': '#license',
    'distribution.landingUrl': '#landingUrl',
    'distribution.downloadUrl': '#downloadUrl',
    'distribution.metadataLandingUrl': '#metadataLandingUrl',
    'distribution.nceiMetadataContactHref': '#nceiMetadataContactHref',
    'distribution.nceiDistributorContactHref': '#nceiDistributorContactHref',
    'distribution.publication': '#publication',
    sensors: '[id="sensors[0]-sid"]',
  }

  if (direct[field]) return `${direct[field]}, ${data}`

  const m = field.match(/^sensors\[(\d+)\]\.(modelId|type|variable|sensorId|firmware|[\w]+)$/)
  if (m) {
    const idx = m[1]
    const prop = m[2]
    const idSuffix =
      prop === 'sensorId'
        ? 'sid'
        : prop === 'modelId'
          ? 'model'
          : prop === 'type'
            ? 'type'
            : prop === 'variable'
              ? 'var'
              : prop === 'firmware'
                ? 'fw'
                : prop
    return `[id="${cssEscapeAttr(`sensors[${idx}]-${idSuffix}`)}"], ${data}`
  }

  if (field.startsWith('spatial.')) {
    const tail = field.slice('spatial.'.length)
    const gridMap = {
      gridColumnSize: '#gridColumnSize',
      gridRowSize: '#gridRowSize',
      gridVerticalSize: '#gridVerticalSize',
    }
    if (gridMap[tail]) return `${gridMap[tail]}, ${data}`
  }

  if (field.startsWith('keywords.')) return `${data}`

  if (field.startsWith('distribution.')) return `${data}`

  if (field.startsWith('mission.')) {
    const tail = field.slice('mission.'.length)
    if (tail === 'ror') return '#rorSearch, #org, ' + data
  }

  return data
}

/**
 * @param {string} field
 * @returns {boolean}
 */
export function scrollToPilotField(field) {
  const sel = selectorForPilotField(field)
  if (!sel) return false
  const parts = sel.split(',').map((s) => s.trim())
  for (const part of parts) {
    try {
      const el = document.querySelector(part)
      if (el instanceof HTMLElement) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        if ('focus' in el && typeof el.focus === 'function') {
          try {
            el.focus({ preventScroll: true })
          } catch {
            el.focus()
          }
        }
        return true
      }
    } catch {
      // Invalid selector
    }
  }
  return false
}

/** @param {string} s */
function cssEscapeAttr(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
