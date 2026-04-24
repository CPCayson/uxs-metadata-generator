/**
 * Server-side GeoJSON + DCAT JSON-LD from legacy formData (UxS `collectFormData` shape after `mapClientDataToServer`).
 *
 * Kept in Netlify `functions/lib` so `db.mjs` can import without pulling the full React bundle.
 *
 * @module netlify/functions/lib/legacyGeoDcat
 */

function emptyMappedClientData() {
  return { mission: {}, platform: {}, sensors: [], spatial: {}, output: {} }
}

function cleanValue(value) {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
  }
  return value
}

function firstDefinedValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null) return value
  }
  return null
}

/** Mirrors ValidationSystem.gs `mapClientDataToServer` (subset used by exports). */
export function mapClientDataToServer(clientData) {
  if (clientData == null) return emptyMappedClientData()
  if (typeof clientData !== 'object' || Array.isArray(clientData)) return emptyMappedClientData()

  const result = {
    mission: {
      ...clientData.mission,
      id: cleanValue(clientData.mission?.missionId || clientData.mission?.id),
      title: cleanValue(clientData.mission?.missionTitle || clientData.mission?.title),
      abstract: cleanValue(clientData.mission?.abstract),
      startDate: cleanValue(clientData.mission?.startDate),
      endDate: cleanValue(clientData.mission?.endDate),
      contactEmail: cleanValue(clientData.mission?.contactEmail),
      contactAddress: cleanValue(clientData.mission?.contactAddress),
    },
    platform: {
      ...clientData.platform,
      id: cleanValue(firstDefinedValue(
        clientData.platform?.platformId,
        clientData.platform?.platformID,
        clientData.platform?.id,
        clientData.platform?.identifier,
      )),
      name: cleanValue(clientData.platform?.platformName || clientData.platform?.name),
      description: cleanValue(firstDefinedValue(
        clientData.platform?.description,
        clientData.platform?.platformComments,
      )),
    },
    sensors: (clientData.sensors || [])
      .filter((s) => s != null && typeof s === 'object')
      .map((s) => {
        const id = cleanValue(s.id || s.sensorId || s.serialNumber)
        const type = cleanValue(s.type || s.sensorType)
        return { ...s, id, type }
      }),
    spatial: clientData.spatial || {},
    output: clientData.output || {},
  }
  return result
}

export function buildGeoJsonBoundingPolygon(bbox) {
  if (!bbox) return null
  const upperLeft = bbox.upperLeft || {}
  const upperRight = bbox.upperRight || {}
  const lowerRight = bbox.lowerRight || {}
  const lowerLeft = bbox.lowerLeft || {}

  const points = [
    [Number(lowerLeft.lon), Number(lowerLeft.lat)],
    [Number(lowerRight.lon), Number(lowerRight.lat)],
    [Number(upperRight.lon), Number(upperRight.lat)],
    [Number(upperLeft.lon), Number(upperLeft.lat)],
    [Number(lowerLeft.lon), Number(lowerLeft.lat)],
  ]

  const hasInvalid = points.some((p) => Number.isNaN(p[0]) || Number.isNaN(p[1]))
  if (hasInvalid) return null

  return { type: 'Polygon', coordinates: [points] }
}

export function buildWktBoundingPolygon(bbox) {
  const geometry = buildGeoJsonBoundingPolygon(bbox)
  if (!geometry || !Array.isArray(geometry.coordinates) || !geometry.coordinates.length) return null
  const ring = geometry.coordinates[0]
  const coords = ring.map((pair) => `${pair[0]} ${pair[1]}`).join(', ')
  return `POLYGON((${coords}))`
}

/**
 * @param {unknown} data - legacy { mission, platform, sensors, spatial, output }
 * @returns {string} pretty-printed GeoJSON FeatureCollection
 */
export function generateGeoJSONString(data) {
  if (!data) throw new Error('No form data provided to generateGeoJSON')

  const mappedData = mapClientDataToServer(data)
  const mission = mappedData.mission || {}
  const platform = mappedData.platform || {}
  const sensors = mappedData.sensors || []
  const spatial = mappedData.spatial || {}
  const output = mappedData.output || {}
  const geometry = buildGeoJsonBoundingPolygon(spatial.boundingBox)
  const missionId = mission.id || mission.missionId || ''
  const missionTitle = mission.title || mission.missionTitle || ''
  const gcmdKeywords = Array.isArray(mission.gcmdKeywords) ? mission.gcmdKeywords : []
  const freeKeywords = Array.isArray(mission.keywords) ? mission.keywords : []

  const geojson = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: missionId || undefined,
        geometry,
        properties: {
          missionId,
          title: missionTitle,
          description: mission.abstract || '',
          temporal: {
            start: mission.startDate || null,
            end: mission.endDate || null,
          },
          status: mission.status || null,
          organization: {
            name: mission.organization || '',
            rorId: mission.organizationRor?.shortId || mission.organizationRorId || '',
            rorUri: mission.organizationRor?.id || mission.organizationRorUri || '',
          },
          contact: {
            email: mission.contactEmail || '',
            phone: mission.contactPhone || '',
            url: mission.contactUrl || '',
          },
          keywords: {
            gcmd: gcmdKeywords,
            freeText: freeKeywords,
          },
          platform,
          sensors,
          sensorCount: sensors.length,
          spatial: {
            referenceSystem: spatial.referenceSystem || 'EPSG:4326',
            boundingBox: spatial.boundingBox || null,
          },
          metadata: {
            standard: output.metadataStandard || 'ISO 19115-2',
            version: output.metadataVersion || '2.0',
            generated: new Date().toISOString(),
            generator: 'UxS Metadata Generator',
          },
        },
      },
    ],
  }

  return JSON.stringify(geojson, null, 2)
}

/**
 * @param {unknown} data - legacy formData
 * @returns {string} pretty-printed DCAT JSON-LD
 */
export function generateDCATString(data) {
  if (!data) throw new Error('No form data provided to generateDCATJsonLd')

  const mappedData = mapClientDataToServer(data)
  const mission = mappedData.mission || {}
  const spatial = mappedData.spatial || {}
  const output = mappedData.output || {}
  const missionId = mission.id || mission.missionId || ''
  const missionTitle = mission.title || mission.missionTitle || ''
  const gcmdKeywords = Array.isArray(mission.gcmdKeywords) ? mission.gcmdKeywords : []
  const keywordLabels = gcmdKeywords.map((k) => k.prefLabel).filter(Boolean)
  const themeUris = gcmdKeywords
    .map((k) => (k.uuid ? `https://gcmd.earthdata.nasa.gov/kms/concepts/concept/${k.uuid}` : ''))
    .filter(Boolean)

  const rorUri = mission.organizationRor?.id || mission.organizationRorUri || ''
  const organizationName = mission.organization || mission.organizationRor?.displayName || mission.organizationRorDisplayName || ''
  const email = mission.contactEmail ? `mailto:${mission.contactEmail}` : null
  const website = mission.contactUrl || null
  const modifiedDate = mission.endDate || mission.startDate || new Date().toISOString()
  const issuedDate = mission.startDate || modifiedDate
  const geoJsonGeometry = buildGeoJsonBoundingPolygon(spatial.boundingBox)
  const wktBbox = buildWktBoundingPolygon(spatial.boundingBox)
  const gcmdVersions = Array.from(
    new Set(gcmdKeywords.map((k) => String(k.keywordVersion || '').trim()).filter(Boolean)),
  )

  const distributions = [
    { '@type': 'dcat:Distribution', 'dct:title': 'ISO 19115-2 XML metadata export', 'dct:format': 'application/xml', 'dcat:mediaType': 'application/xml' },
    { '@type': 'dcat:Distribution', 'dct:title': 'JSON metadata export', 'dct:format': 'application/json', 'dcat:mediaType': 'application/json' },
    { '@type': 'dcat:Distribution', 'dct:title': 'CSV metadata export', 'dct:format': 'text/csv', 'dcat:mediaType': 'text/csv' },
    { '@type': 'dcat:Distribution', 'dct:title': 'GeoJSON metadata export', 'dct:format': 'application/geo+json', 'dcat:mediaType': 'application/geo+json' },
    { '@type': 'dcat:Distribution', 'dct:title': 'DCAT JSON-LD metadata export', 'dct:format': 'application/ld+json', 'dcat:mediaType': 'application/ld+json' },
  ]

  const conformsTo = [
    {
      '@type': 'dct:Standard',
      'dct:title': output.metadataStandard || 'ISO 19115-2',
      'dct:description': `Metadata version ${output.metadataVersion || '2.0'}`,
    },
  ]

  if (gcmdKeywords.length > 0) {
    conformsTo.push({
      '@type': 'dct:Standard',
      'dct:title': 'Global Change Master Directory (GCMD) Keywords',
      'dct:description': gcmdVersions.length
        ? `Keyword versions: ${gcmdVersions.join(', ')}`
        : 'Current keyword version',
      'rdfs:seeAlso': 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all?gtm_scheme=all',
    })
  }

  const dcat = {
    '@context': {
      dcat: 'http://www.w3.org/ns/dcat#',
      dct: 'http://purl.org/dc/terms/',
      foaf: 'http://xmlns.com/foaf/0.1/',
      vcard: 'http://www.w3.org/2006/vcard/ns#',
      schema: 'https://schema.org/',
      rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    },
    '@type': 'dcat:Dataset',
    'dct:identifier': missionId,
    'dct:title': missionTitle,
    'dct:description': mission.abstract || '',
    'dct:issued': issuedDate,
    'dct:modified': modifiedDate,
    'dct:publisher': {
      '@type': 'foaf:Organization',
      ...(rorUri ? { '@id': rorUri } : {}),
      'foaf:name': organizationName,
    },
    'dcat:contactPoint': {
      '@type': 'vcard:Kind',
      'vcard:fn': organizationName,
      ...(email ? { 'vcard:hasEmail': email } : {}),
      ...(website ? { 'vcard:hasURL': website } : {}),
    },
    'dcat:keyword': keywordLabels,
    'dcat:theme': themeUris,
    'dct:spatial': spatial.boundingBox
      ? {
          '@type': 'dct:Location',
          'dcat:bbox': wktBbox,
          'dcat:centroid': geoJsonGeometry ? JSON.stringify(geoJsonGeometry) : null,
        }
      : null,
    'dcat:distribution': distributions,
    'dct:conformsTo': conformsTo,
    'schema:version': output.metadataVersion || '2.0',
    'schema:dateModified': new Date().toISOString(),
  }

  return JSON.stringify(dcat, null, 2)
}
