/**
 * EnrichmentService — unified interface for keyword suggestion and org lookup.
 *
 * Wraps gcmdClient and rorClient under a common contract. Components import
 * useEnrichmentService() from shell context instead of importing clients directly,
 * so the underlying sources can be swapped without touching step components.
 *
 * @module core/enrichment/EnrichmentService
 */

import { searchGcmdSchemeClient } from '../../lib/gcmdClient.js'
import { searchRorOrganizationsClient } from '../../lib/rorClient.js'

export class EnrichmentService {
  /**
   * Search GCMD KMS for keyword suggestions within a given scheme/facet.
   *
   * @param {string} scheme - GCMD scheme name, e.g. 'sciencekeywords', 'instruments'
   * @param {string} query
   * @param {{ maxMatches?: number }} [opts]
   * @returns {Promise<Array<{ label: string, uuid: string }>>}
   */
  async suggestKeywords(scheme, query, opts = {}) {
    const rows = await searchGcmdSchemeClient(scheme, query, opts)
    return rows.map((r) => ({
      label: r.prefLabel || r.label || '',
      uuid: r.uuid || '',
    }))
  }

  /**
   * Search ROR for organizations matching a query.
   *
   * @param {string} query
   * @param {{ limit?: number }} [opts]
   * @returns {Promise<Array<{ id: string, displayName: string, country: string | null, types: string[] }>>}
   */
  async searchOrganizations(query, opts = {}) {
    return searchRorOrganizationsClient(query, opts)
  }
}

/** Shared singleton instance for use in shells and components. */
export const enrichmentService = new EnrichmentService()
