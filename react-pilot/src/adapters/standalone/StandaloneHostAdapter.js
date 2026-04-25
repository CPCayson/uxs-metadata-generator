import { runLensScanHeuristic } from '../../lib/lensScanHeuristic.js'

/**
 * StandaloneHostAdapter — no-op HostBridge for dev server and static deploys.
 *
 * All methods return empty results or throw friendly errors when no backend is configured.
 *
 * @module adapters/standalone/StandaloneHostAdapter
 */

/**
 * @returns {import('../HostBridge.js').HostBridge}
 */
export function createStandaloneHostAdapter() {
  return {
    isAvailable() {
      return false
    },

    async listTemplates() {
      return { rows: [], unexpectedShape: false }
    },

    async loadTemplate(name) {
      throw new Error(`StandaloneHostAdapter: loadTemplate('${name}') — no host connected`)
    },

    async saveTemplate() {
      throw new Error('StandaloneHostAdapter: saveTemplate — no host connected')
    },

    async listPlatforms() {
      return { rows: [], unexpectedShape: false }
    },

    async savePlatform() {
      throw new Error('StandaloneHostAdapter: savePlatform — no host connected')
    },

    async listSensors() {
      return { rows: [], unexpectedShape: false }
    },

    async saveSensor() {
      throw new Error('StandaloneHostAdapter: saveSensor — no host connected')
    },

    async saveSensorsBatch() {
      throw new Error('StandaloneHostAdapter: saveSensorsBatch — no host connected')
    },

    async validateOnServer() {
      throw new Error('StandaloneHostAdapter: validateOnServer — no host connected')
    },

    async generateGeoJSON() {
      throw new Error('StandaloneHostAdapter: generateGeoJSON — no host connected')
    },

    async generateDCAT() {
      throw new Error('StandaloneHostAdapter: generateDCAT — no host connected')
    },

    /**
     * Stateless heuristic (GCMD) — same contract as HttpHostAdapter `lensScan` for local demos.
     * @param {{ title?: string, abstract?: string, xmlSnippet?: string, profileId?: string, uxsContext?: unknown }} payload
     */
    async lensScan(payload) {
      return runLensScanHeuristic({
        title:      typeof payload?.title === 'string' ? payload.title : '',
        abstract:   typeof payload?.abstract === 'string' ? payload.abstract : '',
        xmlSnippet: typeof payload?.xmlSnippet === 'string' ? payload.xmlSnippet : '',
        profileId:  typeof payload?.profileId === 'string' ? payload.profileId : '',
        uxsContext: payload && typeof payload === 'object' ? payload.uxsContext : undefined,
      })
    },
  }
}
