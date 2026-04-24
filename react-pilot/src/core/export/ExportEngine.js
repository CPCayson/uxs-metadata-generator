/**
 * ExportEngine — format-adapter dispatch for metadata export.
 *
 * Accepts a pilotState or CanonicalMetadataEntity and routes to the correct
 * registered adapter. During Phase 1/2 the engine works with pilotState
 * directly (passed from App.jsx); the canonical entity path is used in Phase 3+.
 *
 * @module core/export/ExportEngine
 */

import { isoXmlAdapter } from './adapters/isoXmlAdapter.js'
import { canonicalToPilotState } from '../mappers/pilotStateMapper.js'

const DEFAULT_ADAPTERS = [isoXmlAdapter]

export class ExportEngine {
  /**
   * @param {import('../registry/types.js').ExportAdapter[]} [adapters]
   */
  constructor(adapters = DEFAULT_ADAPTERS) {
    /** @type {Map<string, import('../registry/types.js').ExportAdapter>} */
    this._adapters = new Map()
    for (const a of adapters) {
      this._adapters.set(a.format, a)
    }
  }

  /**
   * Register an additional export adapter (or replace an existing one).
   *
   * @param {import('../registry/types.js').ExportAdapter} adapter
   */
  registerAdapter(adapter) {
    this._adapters.set(adapter.format, adapter)
  }

  /**
   * Export a pilotState to the given format.
   * This is the current primary path (App.jsx passes pilotState directly).
   *
   * @param {object} pilotState
   * @param {string} [format]
   * @returns {string | Promise<string>}
   */
  exportPilotState(pilotState, format = 'iso-xml') {
    const adapter = this._adapters.get(format)
    if (!adapter) throw new Error(`ExportEngine: no adapter registered for format '${format}'`)
    return adapter.generate(pilotState)
  }

  /**
   * Export a CanonicalMetadataEntity to the given format.
   * Converts to pilotState internally for adapters that expect it.
   *
   * @param {import('../entities/types.js').CanonicalMetadataEntity} entity
   * @param {string} [format]
   * @returns {string | Promise<string>}
   */
  exportEntity(entity, format = 'iso-xml') {
    const pilotState = canonicalToPilotState(entity)
    return this.exportPilotState(pilotState, format)
  }

  /**
   * Returns the registered adapter for a format, or undefined.
   *
   * @param {string} format
   * @returns {import('../registry/types.js').ExportAdapter | undefined}
   */
  adapterFor(format) {
    return this._adapters.get(format)
  }

  /**
   * Returns all registered format strings.
   * @returns {string[]}
   */
  supportedFormats() {
    return [...this._adapters.keys()]
  }
}

/** Shared singleton instance for use in shells and panels. */
export const exportEngine = new ExportEngine()
