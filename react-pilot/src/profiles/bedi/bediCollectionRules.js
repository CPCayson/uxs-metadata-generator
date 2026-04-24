/**
 * BEDI Collection validation rules.
 *
 * Rules are grounded against real examples from Biolum2009_collection.xml.
 * Severities: 'e' = error (blocks completion), 'w' = warning (should fix).
 *
 * @module profiles/bedi/bediCollectionRules
 */

import { buildBediCollectionXmlPreview } from '../../lib/bediCollectionXmlPreview.js'
import { collectBediWizardLintIssues } from '../../lib/bediXmlPreviewLint.js'

/** @type {import('../../core/registry/types.js').ValidationRuleSet[]} */
export const bediCollectionRuleSets = [
  {
    id: 'bedi-collection-core',
    modes: ['lenient', 'strict', 'catalog'],
    rules: [
      // ── File / record ID ────────────────────────────────────────────────
      {
        field: 'fileId',
        severity: 'e',
        message: 'File identifier is required (e.g. gov.noaa.ncei.oer:COLLECTION_ID)',
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

      // ── Hierarchy ────────────────────────────────────────────────────────
      {
        field: 'hierarchyLevel',
        severity: 'e',
        message: 'BEDI collections must have hierarchyLevel = fieldSession',
        check: (s) => {
          const v = s.hierarchyLevel?.trim()
          if (!v) return false           // separate "required" rule below
          return v !== 'fieldSession'
        },
      },
      {
        field: 'hierarchyLevel',
        severity: 'e',
        message: 'Hierarchy level is required',
        check: (s) => !s.hierarchyLevel?.trim(),
      },

      // ── Collection ID & accession ─────────────────────────────────────────
      {
        field: 'collectionId',
        severity: 'e',
        message: 'Short collection identifier is required (e.g. Biolum2009)',
        check: (s) => !s.collectionId?.trim(),
      },
      {
        field: 'nceiAccessionId',
        severity: 'e',
        message: 'NCEI Accession ID is required (numeric, from NCEI AMS authority identifier)',
        check: (s) => !s.nceiAccessionId?.trim(),
      },
      {
        field: 'nceiAccessionId',
        severity: 'e',
        message: 'NCEI Accession ID must be numeric',
        check: (s) => {
          const v = s.nceiAccessionId?.trim()
          if (!v) return false
          return !/^\d+$/.test(v)
        },
      },

      // ── Title ─────────────────────────────────────────────────────────────
      {
        field: 'title',
        severity: 'e',
        message: 'Title is required',
        check: (s) => !s.title?.trim(),
      },
      {
        field: 'alternateTitle',
        severity: 'w',
        message: 'Alternate title (dataset name) is recommended for BEDI collections',
        check: (s) => !s.alternateTitle?.trim(),
      },
      {
        field: 'vesselName',
        severity: 'w',
        message: 'Vessel name (second alternate title) is recommended',
        check: (s) => !s.vesselName?.trim(),
      },

      // ── Date ──────────────────────────────────────────────────────────────
      {
        field: 'creationDate',
        severity: 'e',
        message: 'Creation date is required',
        check: (s) => !s.creationDate?.trim(),
      },

      // ── Abstract / Purpose ────────────────────────────────────────────────
      {
        field: 'abstract',
        severity: 'e',
        message: 'Abstract is required',
        check: (s) => !s.abstract?.trim(),
      },
      {
        field: 'purpose',
        severity: 'w',
        message: 'Purpose is recommended for BEDI collections',
        check: (s) => !s.purpose?.trim(),
      },

      // ── Status ────────────────────────────────────────────────────────────
      {
        field: 'status',
        severity: 'e',
        message: 'Status is required (e.g. completed, historicalArchive)',
        check: (s) => !s.status?.trim(),
      },

      // ── Keywords ─────────────────────────────────────────────────────────
      {
        field: 'scienceKeywords',
        severity: 'e',
        message: 'At least one GCMD Science Keyword is required',
        check: (s) => !(s.scienceKeywords?.length > 0),
      },
      {
        field: 'datacenters',
        severity: 'e',
        message: 'At least one data center keyword is required',
        check: (s) => !(s.datacenters?.length > 0),
      },
      {
        field: 'oerKeywords',
        severity: 'w',
        message: 'OER program keywords are recommended',
        check: (s) => !(s.oerKeywords?.length > 0),
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
        message: 'Start date is required',
        check: (s) => !s.startDate?.trim(),
      },
      {
        field: 'endDate',
        severity: 'e',
        message: 'End date is required',
        check: (s) => !s.endDate?.trim(),
      },

      // ── Platforms ─────────────────────────────────────────────────────────
      {
        field: 'platforms',
        severity: 'e',
        message: 'At least one platform reference is required (ship or submersible)',
        check: (s) => !(s.platforms?.length > 0),
      },

      // ── Preview XML / form whitespace (Oxygen-style signals) ─────────────
      {
        field: 'title',
        severity: 'w',
        message: 'XML preview / whitespace lint',
        check: (s) => {
          const issues = collectBediWizardLintIssues(s, () => buildBediCollectionXmlPreview(s), 'collection')
          return issues.length ? issues : false
        },
      },
    ],
  },
  {
    id: 'bedi-collection-strict',
    modes: ['strict', 'catalog'],
    rules: [
      {
        field: 'nceiMetadataId',
        severity: 'e',
        message: 'Strict: NCEI Metadata ID is required (gov.noaa.ncei.oer:COLLECTION_ID format)',
        check: (s) => !s.nceiMetadataId?.trim(),
      },
      {
        field: 'browseGraphicUrl',
        severity: 'e',
        message: 'Strict: Browse graphic URL is required for catalog-ready collections',
        check: (s) => !s.browseGraphicUrl?.trim(),
      },
      {
        field: 'placeKeywords',
        severity: 'e',
        message: 'Strict: At least one place/location keyword is required',
        check: (s) => !(s.placeKeywords?.length > 0),
      },
      {
        field: 'landingPageUrl',
        severity: 'w',
        message: 'Strict: Landing page URL is recommended for catalog readiness',
        check: (s) => !s.landingPageUrl?.trim(),
      },
    ],
  },
]
