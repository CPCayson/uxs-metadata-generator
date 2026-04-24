/**
 * BEDI Granule validation rules.
 *
 * The granule is the smallest independently describable unit.
 * The most critical constraint: parentCollectionId MUST be present and
 * follow the OER namespace convention.
 *
 * @module profiles/bedi/bediGranuleRules
 */

import { buildBediGranuleXmlPreview } from '../../lib/bediGranuleXmlPreview.js'
import { collectBediWizardLintIssues } from '../../lib/bediXmlPreviewLint.js'

/** @type {import('../../core/registry/types.js').ValidationRuleSet[]} */
export const bediGranuleRuleSets = [
  {
    id: 'bedi-granule-core',
    modes: ['lenient', 'strict', 'catalog'],
    rules: [
      // ── Parent linkage — THE critical BEDI constraint ─────────────────────
      {
        field: 'parentCollectionId',
        severity: 'e',
        message: 'Parent collection identifier is required — granules MUST link to a collection via gmd:parentIdentifier',
        check: (s) => !s.parentCollectionId?.trim(),
      },
      {
        field: 'parentCollectionId',
        severity: 'e',
        message: 'Parent collection ID must follow OER namespace pattern: gov.noaa.ncei.oer:<ID>',
        check: (s) => {
          const v = s.parentCollectionId?.trim()
          if (!v) return false
          return !v.startsWith('gov.noaa.ncei.oer:')
        },
      },

      // ── File / granule ID ─────────────────────────────────────────────────
      {
        field: 'fileId',
        severity: 'e',
        message: 'File identifier is required',
        check: (s) => !s.fileId?.trim(),
      },
      {
        field: 'fileId',
        severity: 'e',
        message: 'File identifier must follow OER namespace pattern: gov.noaa.ncei.oer:<ID>',
        check: (s) => {
          const v = s.fileId?.trim()
          if (!v) return false
          return !v.startsWith('gov.noaa.ncei.oer:')
        },
      },
      {
        field: 'granuleId',
        severity: 'e',
        message: 'Granule identifier (short ID) is required',
        check: (s) => !s.granuleId?.trim(),
      },

      // ── Hierarchy ─────────────────────────────────────────────────────────
      {
        field: 'hierarchyLevel',
        severity: 'e',
        message: 'BEDI granules must have hierarchyLevel = dataset',
        check: (s) => {
          const v = s.hierarchyLevel?.trim()
          if (!v) return false
          return v !== 'dataset'
        },
      },
      {
        field: 'hierarchyLevelName',
        severity: 'w',
        message: 'hierarchyLevelName should be "Granule" for BEDI granules',
        check: (s) => {
          const v = s.hierarchyLevelName?.trim()
          return !!v && v !== 'Granule'
        },
      },

      // ── Dive identification ───────────────────────────────────────────────
      {
        field: 'diveId',
        severity: 'e',
        message: 'Dive identifier is required (e.g. JSL2-3699, parsed from file ID)',
        check: (s) => !s.diveId?.trim(),
      },
      {
        field: 'tapeNumber',
        severity: 'w',
        message: 'Tape number is recommended (parsed from TAPE<n>OF<total> in file ID)',
        check: (s) => !s.tapeNumber?.trim(),
      },
      {
        field: 'segmentNumber',
        severity: 'w',
        message: 'Segment number is recommended (parsed from SEG<n>OF<total> in file ID)',
        check: (s) => !s.segmentNumber?.trim(),
      },

      // ── Title ─────────────────────────────────────────────────────────────
      {
        field: 'title',
        severity: 'e',
        message: 'Title is required',
        check: (s) => !s.title?.trim(),
      },

      // ── Presentation form ─────────────────────────────────────────────────
      {
        field: 'presentationForm',
        severity: 'e',
        message: 'Presentation form is required for BEDI granules (expected: videoDigital)',
        check: (s) => !s.presentationForm?.trim(),
      },
      {
        field: 'presentationForm',
        severity: 'w',
        message: 'BEDI video granules should have presentationForm = videoDigital',
        check: (s) => {
          const v = s.presentationForm?.trim()
          return !!v && v !== 'videoDigital'
        },
      },

      // ── Date ──────────────────────────────────────────────────────────────
      {
        field: 'creationDate',
        severity: 'e',
        message: 'Creation date is required',
        check: (s) => !s.creationDate?.trim(),
      },

      // ── Abstract / Status ─────────────────────────────────────────────────
      {
        field: 'abstract',
        severity: 'e',
        message: 'Abstract is required',
        check: (s) => !s.abstract?.trim(),
      },
      {
        field: 'status',
        severity: 'e',
        message: 'Status is required',
        check: (s) => !s.status?.trim(),
      },

      // ── Principal Investigator ────────────────────────────────────────────
      {
        field: 'piName',
        severity: 'e',
        message: 'Principal investigator name is required',
        check: (s) => !s.piName?.trim(),
      },
      {
        field: 'piEmail',
        severity: 'w',
        message: 'Principal investigator email is recommended',
        check: (s) => !s.piEmail?.trim(),
      },

      // ── Spatial extent ────────────────────────────────────────────────────
      {
        field: 'west',
        severity: 'e',
        message: 'Bounding box W/E/S/N is required',
        check: (s) => {
          const vals = [s.west, s.east, s.south, s.north]
          return vals.some((v) => !v?.trim() || isNaN(Number(v)))
        },
      },

      // ── Temporal extent ───────────────────────────────────────────────────
      {
        field: 'startDate',
        severity: 'e',
        message: 'Observation start date/time is required',
        check: (s) => !s.startDate?.trim(),
      },
      {
        field: 'endDate',
        severity: 'e',
        message: 'Observation end date/time is required',
        check: (s) => !s.endDate?.trim(),
      },

      // ── Vertical extent ───────────────────────────────────────────────────
      {
        field: 'maxDepth',
        severity: 'e',
        message: 'Maximum dive depth (meters) is required for BEDI granules',
        check: (s) => {
          const v = s.maxDepth?.toString()?.trim()
          return !v || isNaN(Number(v))
        },
      },
      {
        field: 'minDepth',
        severity: 'w',
        message: 'Minimum depth (meters) is recommended',
        check: (s) => {
          const v = s.minDepth?.toString()?.trim()
          return !v || isNaN(Number(v))
        },
      },

      // ── Parent aggregation ────────────────────────────────────────────────
      {
        field: 'parentCollectionRef',
        severity: 'e',
        message: 'largerWorkCitation aggregation (parent collection reference) is required',
        check: (s) => !s.parentCollectionRef?.trim(),
      },
      {
        field: 'parentCollectionLandingUrl',
        severity: 'w',
        message: 'Parent collection NCEI landing page URL is recommended',
        check: (s) => !s.parentCollectionLandingUrl?.trim(),
      },

      {
        field: 'title',
        severity: 'w',
        message: 'XML preview / whitespace lint',
        check: (s) => {
          const issues = collectBediWizardLintIssues(s, () => buildBediGranuleXmlPreview(s), 'granule')
          return issues.length ? issues : false
        },
      },
    ],
  },
  {
    id: 'bedi-granule-strict',
    modes: ['strict', 'catalog'],
    rules: [
      {
        field: 'piOrg',
        severity: 'e',
        message: 'Strict: Principal investigator organization is required',
        check: (s) => !s.piOrg?.trim(),
      },
      {
        field: 'instrumentKeyword',
        severity: 'e',
        message: 'Strict: Instrument keyword (NCEI thesaurus) is required',
        check: (s) => !s.instrumentKeyword?.trim(),
      },
      {
        field: 'dataCenterKeyword',
        severity: 'e',
        message: 'Strict: Data center keyword (NCEI submitting institution) is required',
        check: (s) => !s.dataCenterKeyword?.trim(),
      },
      {
        field: 'diveSummaryReportUrl',
        severity: 'w',
        message: 'Strict: Dive summary report (crossReference) URL is recommended',
        check: (s) => !s.diveSummaryReportUrl?.trim(),
      },
    ],
  },
]
