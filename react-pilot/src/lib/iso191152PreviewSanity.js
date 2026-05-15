/**
 * Structural “ISO 19115-2-shaped” checks for mission preview XML (`gmi:MI_Metadata`).
 * Shared by `verify-pilot.mjs` and `audit-manta-end-user-samples.mjs`.
 *
 * Complements schema validation: catches generator regressions (wrong root, schemaLocation,
 * bbox typing, empty typed decimals) before tooling-specific rubrics.
 */

/**
 * @param {string} xml
 * @param {string} localName
 */
export function xmlHasBoundingBoxDecimal_(xml, localName) {
  const prefixed = new RegExp(`<\\w+:${localName}\\b[^>]*>\\s*<\\w+:Decimal\\b`, 'i')
  const unprefixed = new RegExp(`<${localName}\\b[^>]*>\\s*<Decimal\\b`, 'i')
  return prefixed.test(xml) || unprefixed.test(xml)
}

/**
 * @param {string} xml mission profile XML from {@link buildXmlPreview}
 * @returns {string[]} failed check ids (empty = pass)
 */
export function missionPreviewIso191152SanityFailures(xml) {
  const checks = [
    { id: 'root.prefixed', passed: /<gmi:MI_Metadata\b/.test(xml) },
    {
      id: 'root.namespace.gmi',
      passed: /xmlns:gmi="http:\/\/www\.isotc211\.org\/2005\/gmi"/.test(xml),
    },
    {
      id: 'schema.gmi',
      passed:
        /http:\/\/www\.isotc211\.org\/2005\/gmi\s+https:\/\/data\.noaa\.gov\/resources\/iso19139\/schema\.xsd/.test(xml),
    },
    {
      id: 'root.namespace.iso191152',
      passed:
        /xmlns:gsr="http:\/\/www\.isotc211\.org\/2005\/gsr"/.test(xml) &&
        /xmlns:gss="http:\/\/www\.isotc211\.org\/2005\/gss"/.test(xml) &&
        /xmlns:gts="http:\/\/www\.isotc211\.org\/2005\/gts"/.test(xml) &&
        /xmlns:srv="http:\/\/www\.isotc211\.org\/2005\/srv"/.test(xml),
    },
    {
      id: 'bbox.decimalTyped',
      passed:
        !/<gmd:geographicElement\b/.test(xml) ||
        (xmlHasBoundingBoxDecimal_(xml, 'westBoundLongitude') &&
          xmlHasBoundingBoxDecimal_(xml, 'eastBoundLongitude') &&
          xmlHasBoundingBoxDecimal_(xml, 'southBoundLatitude') &&
          xmlHasBoundingBoxDecimal_(xml, 'northBoundLatitude')),
    },
    {
      id: 'preview.noEmptyGcoDecimal',
      passed: !/<gco:Decimal[^>]*>\s*<\/gco:Decimal>/i.test(xml),
    },
    {
      id: 'preview.dateStampNonempty',
      passed:
        /<gmd:dateStamp\b[^>]*>[\s\S]*?<gco:(?:Date|DateTime)\b[^>]*>[\s\S]*?<\/gco:(?:Date|DateTime)>[\s\S]*?<\/gmd:dateStamp>/i.test(
          xml,
        ),
    },
    {
      id: 'preview.progressCodeNonempty',
      passed:
        !/<gmd:status\b/.test(xml) ||
        (/<gmd:MD_ProgressCode\b[^>]*\bcodeListValue\s*=\s*"[^"]+"[\s\S]*?<\/gmd:MD_ProgressCode>/i.test(xml) &&
          !/<gmd:MD_ProgressCode\b[^>]*\bcodeListValue\s*=\s*""/i.test(xml)),
    },
  ]
  return checks.filter((c) => !c.passed).map((c) => c.id)
}
