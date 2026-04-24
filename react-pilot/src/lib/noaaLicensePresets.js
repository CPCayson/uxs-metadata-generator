/**
 * NOAA / NCEI data-license presets for XML preview — mirrors `NOAA_DATA_LICENSE_PRESET_DEFS`
 * and `normalizeDataLicensePresetKey_` in `SchemaValidator.gs` (`UniversalXMLGenerator`).
 */

const NOAA_CC0_ACDO_ANCHOR_BLOCKS = [
  {
    href: 'https://creativecommons.org/publicdomain/zero/1.0',
    title: 'CC0-1.0',
    text: 'These data were produced by NOAA and are not subject to copyright protection in the United States. NOAA waives any potential copyright and related rights in these data worldwide through the Creative Commons Zero 1.0 Universal Public Domain Dedication (CC0-1.0).',
  },
  {
    href: 'https://spdx.org/licenses/CC0-1.0',
    title: 'CC0-1.0',
    text: 'SPDX License: Creative Commons Zero v1.0 Universal (CC0-1.0)',
  },
]

/** @type {Record<string, { anchors: typeof NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: string | null }>} */
export const NOAA_DATA_LICENSE_PRESET_DEFS = {
  custom: { anchors: [], docucompHref: null },
  cc0_acdo: { anchors: NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: null },
  ncei_cc0: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51' },
  ncei_cc_by_4: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/551ecbfb-70c4-43a9-b361-3bf9fea67a75' },
  ncei_cc0_internal_noaa: { anchors: [], docucompHref: 'https://data.noaa.gov/docucomp/493b9ff1-4465-404d-bcdf-e0fe1cedb14f' },
  cc0_acdo_and_ncei: { anchors: NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: 'https://data.noaa.gov/docucomp/10bb305d-f440-4b92-8c1c-759dd543bc51' },
}

/**
 * @param {unknown} raw
 * @returns {keyof typeof NOAA_DATA_LICENSE_PRESET_DEFS}
 */
export function normalizeDataLicensePresetKey(raw) {
  const s = String(raw || 'custom')
    .trim()
    .toLowerCase()
    .replace(/-/g, '_')
  return NOAA_DATA_LICENSE_PRESET_DEFS[s] ? s : 'custom'
}

/**
 * @param {unknown} raw
 * @returns {{ anchors: typeof NOAA_CC0_ACDO_ANCHOR_BLOCKS, docucompHref: string | null }}
 */
export function getDataLicensePresetDef(raw) {
  const k = normalizeDataLicensePresetKey(raw)
  return NOAA_DATA_LICENSE_PRESET_DEFS[k] || NOAA_DATA_LICENSE_PRESET_DEFS.custom
}

/**
 * Reverse-map NCEI docucomp `xlink:href` → preset key (see `SchemaValidator.gs` import hints).
 * @param {unknown} href
 * @returns {keyof typeof NOAA_DATA_LICENSE_PRESET_DEFS | ''}
 */
export function inferLicensePresetFromDocucompHref(href) {
  const h = String(href || '').trim()
  if (!h) return ''
  if (h.indexOf('10bb305d') !== -1) return 'ncei_cc0'
  if (h.indexOf('551ecbfb') !== -1) return 'ncei_cc_by_4'
  if (h.indexOf('493b9ff1') !== -1) return 'ncei_cc0_internal_noaa'
  return ''
}
