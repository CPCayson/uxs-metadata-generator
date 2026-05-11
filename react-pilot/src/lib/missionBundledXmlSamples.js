/**
 * Bundled mission XML fixtures (ship in the JS bundle via Vite glob).
 * Same folder as Archive demo-records — keeps offline “import templates” working without /api/db.
 */

const RAW_GLOB = import.meta.glob('../features/archive/demo-records/*.xml', {
  eager: true,
  query: '?raw',
  import: 'default',
})

/** Prefer stable, human-friendly ordering in UI */
const PREFERRED_ORDER = [
  'navy-uxs-gmi-template-2026.xml',
  'uxs-ncei-template-preview.xml',
  'navy-uxs-swarm-clean.xml',
  'PS2418L0-UUV01-GOOD.xml',
  'PS2418L0-UUV01-BAD.xml',
  'PS2418L0-UUV01-norbit-mb-20240505.xml',
  'PS2418L0-AUV01-norbit-mb-20240505.xml',
  '9f21ce1a-1e11-4461-bc84-81939f73cfc2.xml',
]

const LABEL_BY_FILE = {
  'navy-uxs-gmi-template-2026.xml': 'Navy UxS GMI template (2026)',
  'uxs-ncei-template-preview.xml': 'NCEI UxS preview',
  'navy-uxs-swarm-clean.xml': 'Navy swarm (clean)',
  'PS2418L0-UUV01-GOOD.xml': 'PS2418 good fixture',
  'PS2418L0-UUV01-BAD.xml': 'PS2418 bad (repair)',
  'PS2418L0-UUV01-norbit-mb-20240505.xml': 'PS2418 Norbit MB',
  'PS2418L0-AUV01-norbit-mb-20240505.xml': 'PS2418 AUV01 Norbit',
  '9f21ce1a-1e11-4461-bc84-81939f73cfc2.xml': 'CoMET UUID sample',
}

/**
 * @returns {Array<{ file: string, label: string, xml: string }>}
 */
export function getBundledMissionXmlSamples() {
  const entries = Object.entries(RAW_GLOB).map(([path, mod]) => {
    const file = path.replace(/^.*\//, '')
    const xml = typeof mod === 'string' ? mod : ''
    const label = LABEL_BY_FILE[file] || file.replace(/\.xml$/i, '').replace(/-/g, ' ')
    return { file, label, xml }
  }).filter((x) => x.xml.length > 0)

  entries.sort((a, b) => {
    const ia = PREFERRED_ORDER.indexOf(a.file)
    const ib = PREFERRED_ORDER.indexOf(b.file)
    if (ia === -1 && ib === -1) return a.label.localeCompare(b.label)
    if (ia === -1) return 1
    if (ib === -1) return -1
    return ia - ib
  })
  return entries
}
