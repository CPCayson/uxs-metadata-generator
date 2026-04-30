/**
 * classifyInput — pattern-based profile classifier for the intake screen.
 *
 * Returns { profileId, confidence, label, fieldsNote, platformHint,
 *           matchedPatterns, comingSoon? } or null when text is too short.
 *
 * Rules are evaluated in priority order; first match wins.
 */

const RULES = [
  {
    profileId: 'mission',
    platformHint: 'surface',
    label: 'SUMD / Surface Mission',
    fieldsNote: 'Surface uncrewed system detected · routes to Mission PED wizard',
    confidence: 95,
    patterns: ['SUMD', 'saildrone', 'wave glider', 'USV', 'uncrewed surface',
               'surface vehicle', 'SD-1043', 'meteorological', 'air-sea interface'],
  },
  {
    profileId: 'mission',
    platformHint: 'underwater',
    label: 'UxS Mission',
    fieldsNote: 'Underwater uncrewed system detected · routes to Mission PED wizard',
    confidence: 94,
    patterns: ['UxS', 'UUV', 'AUV', 'glider', 'MDBC', 'norbit', 'dive identifier',
               'uncrewed underwater', 'autonomous underwater', 'seafloor mapping',
               'multibeam sonar', 'sub-bottom', 'MI_Metadata', 'gmi:'],
  },
  {
    profileId: 'bediGranule',
    platformHint: null,
    label: 'BEDI Granule',
    fieldsNote: 'BEDI video segment pattern detected',
    confidence: 92,
    patterns: ['BEDI', 'granule', 'WoRMS', 'SeaTube', 'annotation', 'taxon',
               'species', 'coral', 'sponge', 'aphia', 'video segment', 'dive segment'],
  },
  {
    profileId: 'bediCollection',
    platformHint: null,
    label: 'BEDI Collection',
    fieldsNote: 'BEDI collection pattern detected',
    confidence: 90,
    patterns: ['BEDI collection', 'field session', 'benthic collection'],
  },
  {
    profileId: 'oerDashboard',
    platformHint: null,
    label: 'OER/BEDI Workbench',
    fieldsNote: 'OER expedition pattern detected · launches workbench with BEDI actions',
    confidence: 89,
    patterns: ['EX-', 'okeanos', 'deep discoverer', 'seirios', 'expedition',
               'cruise report', 'ROV dive', 'OER'],
  },
  {
    profileId: 'nofo',
    platformHint: null,
    label: 'NOFO Closeout',
    fieldsNote: 'NOFO closeout pattern detected',
    confidence: 85,
    comingSoon: true,
    patterns: ['NOFO', 'DISP', 'DMP', 'closeout', 'final report', 'grant',
               'award', 'principal investigator', 'data management plan'],
  },
  {
    profileId: 'collection',
    platformHint: null,
    label: 'Collection record',
    fieldsNote: 'ISO 19115-1 collection pattern detected',
    confidence: 80,
    patterns: ['MD_Metadata', 'gmd:', 'collection', 'dataset', 'archive',
               'accession'],
  },
]

export function classifyInput(text) {
  if (!text || text.trim().length < 10) return null
  const lower = text.toLowerCase()

  for (const rule of RULES) {
    const hits = rule.patterns.filter(p => lower.includes(p.toLowerCase()))
    if (hits.length > 0) {
      return {
        profileId: rule.profileId,
        confidence: rule.confidence,
        label: rule.label,
        fieldsNote: rule.fieldsNote,
        platformHint: rule.platformHint ?? null,
        matchedPatterns: hits,
        ...(rule.comingSoon ? { comingSoon: true } : {}),
      }
    }
  }

  return null
}
