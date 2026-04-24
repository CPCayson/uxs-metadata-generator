/**
 * metadataKnowledgeBase — local metadata knowledge base for the Manta Ray widget.
 *
 * Two exports:
 *   FIELD_DEFINITIONS  — human-readable explanation of each metadata field.
 *   KNOWLEDGE_BASE     — Q&A pairs for the ASK tab (tokenized keyword matching).
 *
 * @module shell/metadataKnowledgeBase
 */

// ── Field definitions ─────────────────────────────────────────────────────────
// Keyed by the leaf field name (last segment of the dotted path).

export const FIELD_DEFINITIONS = {
  fileId: 'Unique identifier for this metadata record. For NOAA OER, must follow the namespace pattern: gov.noaa.ncei.oer:[name]. Example: gov.noaa.ncei.oer:Biolum2009',
  fileIdentifier: 'Same as fileId — the globally unique ID for this record in any catalog system.',
  title: 'A short, specific name for the dataset. Include the main topic, geographic area, and date range if applicable. Example: "Bioluminescence Survey — Gulf Stream, July 2009".',
  abstract: 'A paragraph describing what was collected, where, when, how, and why. Minimum 100 characters; aim for 250–500 for good catalog discoverability.',
  purpose: 'Why this dataset was collected. Provides scientific context for future users.',
  status: 'Production/availability status. Common values: onGoing, completed, historicalArchive, underDevelopment.',
  creationDate: 'Date this metadata record was created. Use ISO 8601 format: YYYY-MM-DD.',
  hierarchyLevel: 'Specifies the level in the data hierarchy. Use "series" for collections/field sessions and "dataset" for individual files or granules.',
  westBoundLongitude: 'Westernmost longitude of the geographic extent, in decimal degrees. Range: –180 to +180.',
  eastBoundLongitude: 'Easternmost longitude of the geographic extent, in decimal degrees. Range: –180 to +180.',
  southBoundLatitude: 'Southernmost latitude of the geographic extent, in decimal degrees. Range: –90 to +90.',
  northBoundLatitude: 'Northernmost latitude of the geographic extent, in decimal degrees. Range: –90 to +90.',
  temporalStart: 'Start of the data collection period. Use ISO 8601: YYYY-MM-DDTHH:MM:SSZ (UTC).',
  temporalEnd: 'End of the data collection period. Leave blank for ongoing datasets.',
  piName: 'Principal Investigator — the lead scientist responsible for this dataset.',
  piEmail: 'Contact email for the Principal Investigator. Required for strict and catalog modes.',
  piOrg: 'Organizational affiliation of the Principal Investigator.',
  scienceKeywords: 'GCMD Science Keywords — hierarchical Earth science vocabulary maintained by NASA. Use the full path, e.g. "Earth Science > Oceans > Ocean Optics > Bioluminescence".',
  platforms: 'GCMD Platform keywords — the vehicle(s) used to collect data. Example: "In Situ Ocean-based Platforms > Underwater Vehicles > Remotely Operated Vehicles > ROV".',
  instruments: 'GCMD Instrument keywords — the sensors used. Example: "Earth Remote Sensing Instruments > Passive Remote Sensing > Spectrometers/Radiometers > Imaging Spectrometers".',
  parentCollectionId: 'BEDI granule field: the fileIdentifier of the parent collection record. Must follow the gov.noaa.ncei.oer: namespace. Required for catalog linkage.',
  diveId: 'BEDI granule field: the identifier for the submersible dive (e.g. JSL2-3699).',
  tapeNumber: 'BEDI granule field: which tape number within the dive session (e.g. 1 for TAPE1OF1).',
  segmentNumber: 'BEDI granule field: which video segment on the tape (e.g. 1 for SEG1OF1).',
  nceiAccessionId: 'NCEI Accession Number — a numeric ID assigned by NCEI when the dataset is submitted (e.g. 0099999).',
  nceiMetadataId: 'NCEI Metadata Record ID — the internal NCEI identifier for this specific metadata record.',
  metadataUuid:
    'Optional catalog / CoMET record UUID. When set on BEDI collection or granule records, the ISO XML preview places it on the root gmi:MI_Metadata uuid attribute; importing that XML restores this field.',
  landingPageUrl: 'The stable, persistent URL where users can learn about and access this dataset. Required for catalog mode.',
  downloadUrl: 'Direct URL to download the data file(s). Required for catalog mode.',
  doi: 'Digital Object Identifier — a persistent globally unique ID. Format: 10.XXXXX/suffix. Required for catalog mode.',
  browseGraphicUrl: 'URL to a preview image (PNG/JPEG) shown in catalog search results. Strongly recommended.',
  minDepth: 'BEDI granule: minimum depth of observations in meters (positive = below sea surface).',
  maxDepth: 'BEDI granule: maximum depth of observations in meters (positive = below sea surface).',
  presentationForm: 'How the data is presented. Common value for video: "imageDigital".',
  videoFilename: 'BEDI granule: the filename of the video file (e.g. BIOLUM2009_VID_20090730_SEG1.mp4).',
  videoFormat: 'BEDI granule: the video file format/codec (e.g. H.264/MP4).',
}

// ── Q&A knowledge base ────────────────────────────────────────────────────────

export const KNOWLEDGE_BASE = [
  {
    keywords: ['file', 'identifier', 'fileid', 'id', 'unique', 'namespace'],
    q: 'What is a file identifier?',
    a: `The **file identifier** (fileId) uniquely identifies this metadata record across all catalog systems.\n\nFor NOAA OER records it must follow this namespace pattern:\n  \`gov.noaa.ncei.oer:[name]\`\n\nExample: \`gov.noaa.ncei.oer:Biolum2009\`\n\nBEDI granule records reference their parent collection via this ID in the parentCollectionId field. Keep it stable once published — changing it breaks cross-references.`,
  },
  {
    keywords: ['abstract', 'description', 'summary', 'write', 'describe'],
    q: 'What should I write in the abstract?',
    a: `A strong **abstract** covers five things:\n\n1. **What** — data type and variables measured\n2. **Where** — geographic location, depth range\n3. **When** — start/end dates\n4. **How** — instruments, platforms, methods\n5. **Why** — scientific purpose or significance\n\nMinimum 100 characters. Aim for 250–500 for best catalog discoverability. Avoid acronyms without definition on first use.`,
  },
  {
    keywords: ['strict', 'mode', 'lenient', 'catalog', 'validation', 'difference', 'modes'],
    q: 'What is the difference between validation modes?',
    a: `Three modes check progressively stricter requirements:\n\n**LENIENT** — Minimum required fields only. Use while drafting.\n\n**STRICT** — All fields needed for official publication: PI contact, bounding box, keywords, dates, and abstract length. Run before submitting to NCEI.\n\n**CATALOG** — Adds discovery requirements: landing page URL, download URL, and either a DOI or NCEI accession ID. Run before publishing to OneStop or CoMET.`,
  },
  {
    keywords: ['bbox', 'bounding', 'box', 'spatial', 'extent', 'geographic', 'coordinates', 'longitude', 'latitude'],
    q: 'Why do I need a bounding box?',
    a: `A **geographic bounding box** enables spatial filtering in data catalogs (OneStop, ERDDAP, Google Dataset Search).\n\nFour values in decimal degrees:\n  \`westLon\`  / \`eastLon\`  (–180 to +180)\n  \`southLat\` / \`northLat\` (–90 to +90)\n\nExample for a Gulf of Mexico ROV dive:\n  W: –97.5,  E: –80.2\n  S:  18.3,  N:  30.8\n\nFor global datasets use W:–180, E:180, S:–90, N:90.`,
  },
  {
    keywords: ['gcmd', 'keyword', 'science', 'vocabulary', 'kms', 'keywords', 'terms'],
    q: 'What are GCMD keywords?',
    a: `**GCMD** (Global Change Master Directory) is NASA's controlled vocabulary for Earth science metadata.\n\nKeywords are hierarchical paths:\n  \`Earth Science > Oceans > Ocean Optics > Bioluminescence\`\n\nUse the **SEARCH** tab to find matching keywords — type a term and select from results. Correct GCMD keywords make your record discoverable in NASA Earthdata, NOAA OneStop, and partner portals.`,
  },
  {
    keywords: ['ror', 'organization', 'institution', 'affiliation', 'id'],
    q: 'What is a ROR ID?',
    a: `**ROR** (Research Organization Registry) provides persistent, globally unique identifiers for research institutions.\n\nExample: NOAA NCEI → \`https://ror.org/04r0wrp59\`\n\nUsing ROR IDs removes ambiguity when the same institution has multiple name variants. Search for your organization in the **SEARCH** tab (select "Organizations" scheme) to find and copy the correct ROR ID.`,
  },
  {
    keywords: ['bedi', 'granule', 'parent', 'collection', 'parentcollectionid', 'link', 'linkage'],
    q: 'What is parentCollectionId?',
    a: `**parentCollectionId** links a BEDI granule (video segment) to its parent collection (field session) record.\n\nIt must be the exact **fileIdentifier** of the parent collection:\n  \`gov.noaa.ncei.oer:Biolum2009\`\n\nThis linkage enables catalog systems to group granules under their collection and lets users navigate from granule → collection → series. It is the most critical field in the BEDI granule profile.`,
  },
  {
    keywords: ['doi', 'accession', 'ncei', 'identifier', 'persistent'],
    q: 'What is a DOI and when do I need one?',
    a: `A **DOI** (Digital Object Identifier) is a permanent, globally resolvable ID.\n  Format: \`10.25921/[suffix]\`\n\nFor NOAA datasets, NCEI assigns DOIs after internal review. Before that, use the **NCEI Accession ID** (numeric, e.g. \`0099999\`).\n\nBoth identifiers are required in **catalog** validation mode. If you don't have a DOI yet, you can pass catalog mode using just the accession ID.`,
  },
  {
    keywords: ['iso', '19115', 'standard', 'metadata', 'schema', '19139'],
    q: 'What is ISO 19115?',
    a: `**ISO 19115** is the international standard for geographic information metadata.\n\n**ISO 19115-1** — Core geographic metadata concepts.\n**ISO 19115-2** — Extensions for imagery and gridded data (required for BEDI).\n**ISO 19139** — XML encoding of ISO 19115.\n\nThis tool generates ISO 19115-2/19139-compliant XML required by NCEI's BEDI program, compatible with NOAA OneStop and CoMET catalog ingest.`,
  },
  {
    keywords: ['platform', 'vehicle', 'auv', 'rov', 'vessel', 'ship', 'submersible'],
    q: 'How do I describe my platform?',
    a: `Use **GCMD Platform keywords** from the hierarchy:\n  \`In Situ Ocean-based Platforms >\n    Underwater Vehicles >\n      Remotely Operated Vehicles > ROV\`\n\nFor NOAA OER deep-sea dives:\n• **ROV** — Remotely Operated Vehicle (e.g. Deep Discoverer)\n• **AUV** — Autonomous Underwater Vehicle\n• **Manned Submersibles** — e.g. JSL, Alvin, Pisces\n• **Research Vessels** — for ship-based operations\n\nSearch for the exact GCMD term in the **SEARCH** tab.`,
  },
  {
    keywords: ['temporal', 'date', 'time', 'format', 'iso8601', '8601', 'datetime', 'when'],
    q: 'How should I format dates?',
    a: `All dates use **ISO 8601** format:\n\n• Date only:  \`YYYY-MM-DD\`  e.g. \`2009-07-30\`\n• Date+time:  \`YYYY-MM-DDTHH:MM:SSZ\`  e.g. \`2009-07-30T14:32:00Z\`\n\nThe \`T\` separates date and time. The \`Z\` suffix means UTC.\n\nAlways use UTC for temporal extents. For ongoing datasets, fill in the start date and leave the end date blank.`,
  },
  {
    keywords: ['hierarchy', 'level', 'series', 'dataset', 'collection', 'granule', 'hierarchylevel'],
    q: 'What hierarchy level should I use?',
    a: `**hierarchyLevel** places your record in the data tree:\n\n• **series** — a named collection of related datasets (use for BEDI field sessions / collections)\n• **dataset** — an individual file or granule (use for BEDI video segments)\n• **service** — a web service (OGC WMS, WFS, etc.)\n• **nonGeographicDataset** — tabular or non-spatial data\n\nFor most BEDI records: field session → **series**, video segment → **dataset**.`,
  },
  {
    keywords: ['depth', 'vertical', 'extent', 'mindepth', 'maxdepth', 'meters'],
    q: 'How do I record depth information?',
    a: `For BEDI granules (and other ocean datasets), provide a **vertical extent**:\n\n• \`minDepth\` — shallowest observation in meters (positive = below surface)\n• \`maxDepth\` — deepest observation in meters\n\nExample for a 1500 m dive:\n  minDepth: 1200,  maxDepth: 1520\n\nDepth values enable filtering in catalogs like ERDDAP and OneStop that support 3D spatial queries.`,
  },
  {
    keywords: ['browse', 'graphic', 'image', 'thumbnail', 'preview', 'picture'],
    q: 'What is a browse graphic?',
    a: `A **browse graphic** is a preview image (PNG or JPEG) shown in catalog search results.\n\nIt should be a representative image from the dataset — a map of the dive track, a frame from the video, or a chart of key measurements.\n\nProvide a stable, publicly accessible URL. Recommended size: 400–800 px on the longest side.\n\nThis field is optional in strict mode but strongly recommended — records with thumbnails get significantly higher click-through rates in catalog UIs.`,
  },
  {
    keywords: ['landing', 'page', 'url', 'access', 'link', 'catalog'],
    q: 'What is a landing page URL?',
    a: `The **landing page URL** is a stable, persistent web address where users can:\n• Learn about the dataset\n• Access or download the data\n• Find citation information\n\nFor NCEI-hosted datasets, this is typically:\n  \`https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=[accessionId]\`\n\nThis URL is required in **catalog** validation mode and is essential for catalog systems like OneStop to link back to your data.`,
  },
]

// ── Query matching ────────────────────────────────────────────────────────────

/**
 * Find the best KB entry matching a user question via token overlap.
 * @param {string} question
 * @returns {{ q: string, a: string } | null}
 */
export function answerQuestion(question) {
  const tokens = question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2)

  if (!tokens.length) return null

  let best     = null
  let bestScore = 0

  for (const entry of KNOWLEDGE_BASE) {
    let score = 0
    for (const kw of entry.keywords) {
      for (const tok of tokens) {
        if (tok === kw || tok.includes(kw) || kw.includes(tok)) score++
      }
    }
    if (score > bestScore) { best = entry; bestScore = score }
  }

  return bestScore > 0 ? best : null
}

/**
 * Get the definition for a field path (e.g. "mission.title" → looks up "title").
 * @param {string | undefined} fieldPath
 * @returns {string | null}
 */
export function getFieldDefinition(fieldPath) {
  if (!fieldPath) return null
  const leaf = fieldPath.split('.').pop()
  return FIELD_DEFINITIONS[leaf] ?? FIELD_DEFINITIONS[fieldPath] ?? null
}

/** Suggested starter questions for the ASK tab */
export const SUGGESTED_QUESTIONS = [
  'What is a fileIdentifier?',
  'How to format dates?',
  'What does catalog mode check?',
  'Why do I need a bounding box?',
  'What is parentCollectionId?',
  'How do I pick GCMD keywords?',
  'What hierarchy level should I use?',
]
