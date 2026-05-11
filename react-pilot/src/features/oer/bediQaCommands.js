/**
 * Copy-paste commands for BEDI XML QA from the Manta repo root (`react-pilot/`).
 * Import into OERPipelineDashboard or a settings panel if you add a "Local QA" section.
 *
 * Paths assume sibling checkouts:
 *   ~/Downloads/uSX/react-pilot
 *   ~/Downloads/oer
 */

export const BEDI_QA_OER_GRANULES_DIR = '/Users/connorcayson/Downloads/oer/BEDI_METADATA_SAMPLES/out_segments'

export const bediQaCommands = {
  /** Same behavior as `bedi_renderer/link_resolver.py` — checks a template file with placeholder subs. */
  linkTemplateSegment20260424:
    'npm run bedi:link-template -- /Users/connorcayson/Downloads/oer/bedi_renderer/oer-segment-template-20260424.xml',

  linkTemplateCollectionBedi:
    'npm run bedi:link-template -- /Users/connorcayson/Downloads/oer/bedi_renderer/oer-bedi-cruise-template-20260424.xml',

  /** HEAD/GET every URL inside rendered granule XML (parallel). */
  batchWafGranules:
    'npm run batch:waf:audit -- --xml-dir /Users/connorcayson/Downloads/oer/BEDI_METADATA_SAMPLES/out_segments --out reports/bedi-oer-waf',

  uuidAuditGranules:
    'npm run batch:uuid:audit -- --xml-dir /Users/connorcayson/Downloads/oer/BEDI_METADATA_SAMPLES/out_segments --out reports/bedi-oer-uuid',

  batchReportGranules:
    'npm run batch:report -- --xml-dir /Users/connorcayson/Downloads/oer/BEDI_METADATA_SAMPLES/out_segments',

  /** Unique DocuComp path segments under …/docucomp/ — for Vidhya/Jason hygiene lists. */
  scrapeDocucompRefs:
    'npm run bedi:scrape-docucomp -- --xml-dir /Users/connorcayson/Downloads/oer/bedi_renderer/out_collections --out reports/docucomp-refs-collection',
}

/** Rows for UI (OER dashboard copy buttons). */
export const BEDI_QA_ROWS = [
  {
    id: 'link-seg',
    label: 'Template link check — segment',
    hint: 'Same role as bedi_renderer/link_resolver.py on the 20260424 segment template.',
    cmd: bediQaCommands.linkTemplateSegment20260424,
  },
  {
    id: 'link-coll',
    label: 'Template link check — BEDI collection',
    hint: 'Placeholder subs + HTTP check on the cruise template.',
    cmd: bediQaCommands.linkTemplateCollectionBedi,
  },
  {
    id: 'waf',
    label: 'Batch URL audit — granule folder',
    hint: 'HEAD/GET all URLs across rendered granules; writes reports/bedi-oer-waf/.',
    cmd: bediQaCommands.batchWafGranules,
  },
  {
    id: 'uuid',
    label: 'UUID / fileIdentifier audit — granules',
    hint: 'Root UUID v5 + duplicates; CSV under reports/bedi-oer-uuid/.',
    cmd: bediQaCommands.uuidAuditGranules,
  },
  {
    id: 'report',
    label: 'PASS / CHECK / BLOCK lane report',
    hint: 'Consolidates batch outputs + inline XML stats.',
    cmd: bediQaCommands.batchReportGranules,
  },
  {
    id: 'docucomp',
    label: 'Scrape DocuComp refs — collections',
    hint: 'Unique …/docucomp/{id} segments for hygiene spreadsheets.',
    cmd: bediQaCommands.scrapeDocucompRefs,
  },
]
