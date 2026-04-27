const TEXT_MIME_TYPES = new Set([
  'text/plain',
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'application/xml',
  'text/xml',
  'application/vnd.google-apps.document',
  'application/vnd.google-apps.spreadsheet',
])

const METADATA_PATTERNS = [
  /\bcruise\s*pack\b/i,
  /\bcruisepack\b/i,
  /\bOER\b/,
  /\bNCEI\b/,
  /\bNOAA\b/,
  /\bUxS\b/i,
  /\bGCMD\b/i,
  /\bCoMET\b/i,
  /\bOneStop\b/i,
  /\bBEDI\b/i,
  /\bgranule\b/i,
  /\bcollection\b/i,
  /\bISO\s*19115(?:-2)?\b/i,
  /\bgmd:/i,
  /\bgmi:/i,
  /\bfileIdentifier\b/i,
  /\bparentIdentifier\b/i,
  /\bmetadata\b/i,
]

export function isMetadataCandidate(file, keywords = []) {
  const haystack = [
    file?.name,
    file?.description,
    file?.mimeType,
    ...(Array.isArray(keywords) ? keywords : []),
  ].join(' ')
  return METADATA_PATTERNS.some((re) => re.test(haystack))
}

export function canExtractText(mimeType = '') {
  return TEXT_MIME_TYPES.has(mimeType) || mimeType.startsWith('text/')
}

export function metadataSignals(text = '') {
  const signals = []
  for (const re of METADATA_PATTERNS) {
    const hit = text.match(re)
    if (hit) signals.push(hit[0])
  }
  return [...new Set(signals)].slice(0, 25)
}

export function summarizeMetadataText(text = '') {
  const clean = String(text || '').replace(/\r/g, '').trim()
  const lines = clean.split('\n').map((line) => line.trim()).filter(Boolean)
  const signals = metadataSignals(clean)
  const fieldHints = []
  const hintPatterns = [
    ['fileIdentifier', /fileIdentifier|file identifier|file id/i],
    ['title', /\btitle\b/i],
    ['abstract', /\babstract\b/i],
    ['temporal extent', /start date|end date|temporal/i],
    ['spatial extent', /west|east|south|north|bounding box|bbox/i],
    ['contacts', /point of contact|contact|email|PI\b|principal investigator/i],
    ['distribution', /landing page|download|distribution|URL|DOI/i],
    ['parent linkage', /parentIdentifier|parent collection|parent id/i],
    ['GCMD keywords', /GCMD|science keyword|platform|instrument/i],
  ]
  for (const [label, re] of hintPatterns) {
    if (re.test(clean)) fieldHints.push(label)
  }
  return {
    byteLength: Buffer.byteLength(clean, 'utf8'),
    lineCount: lines.length,
    signals,
    fieldHints,
    preview: lines.slice(0, 30).join('\n').slice(0, 4000),
  }
}
