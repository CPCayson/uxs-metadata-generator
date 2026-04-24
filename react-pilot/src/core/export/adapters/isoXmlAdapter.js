/**
 * ISO XML export adapter.
 * Wraps the existing buildXmlPreview function behind the ExportAdapter interface.
 *
 * @module core/export/adapters/isoXmlAdapter
 */

import { buildXmlPreview } from '../../../lib/xmlPreviewBuilder.js'

/** @type {import('../../registry/types.js').ExportAdapter} */
export const isoXmlAdapter = {
  format: 'iso-xml',
  mimeType: 'application/xml',
  fileExtension: 'xml',

  /**
   * @param {object} state - pilotState (the current internal shape)
   * @returns {string}
   */
  generate(state) {
    return buildXmlPreview(state)
  },
}
