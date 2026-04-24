/**
 * MetadataEngineContext — React context that wires the engine layer into
 * all shell components and step forms. Components call useMetadataEngine()
 * instead of importing engine modules directly.
 *
 * @module shell/context
 */

import { createContext, useContext } from 'react'

/**
 * @typedef {{
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   workflowEngine: import('../core/workflow/WorkflowEngine.js').WorkflowEngine,
 *   validationEngine: import('../core/validation/ValidationEngine.js').ValidationEngine,
 *   enrichmentService: import('../core/enrichment/EnrichmentService.js').EnrichmentService,
 *   exportEngine: import('../core/export/ExportEngine.js').ExportEngine,
 *   hostBridge: import('../adapters/HostBridge.js').HostBridge,
 *   hostContext: HostContext,
 *   mode: ShellMode,
 *   readOnly: boolean,
 *   onRecordSaved?: (entity: object) => void,
  *   onPublish?: (result: { uuid: string, cometUrl: string, message?: string }) => void,
 *   onCometLoad?: (parsed: object, uuid: string, gaps: string[]) => void,
 *   clearCometPending?: () => void,
 *   cometUuid?: string,
 *   cometPending?: { parsed: object, uuid: string, gaps: string[] } | null,
 * }} MetadataEngineContextValue
 */

/**
 * @typedef {'full'|'sidebar'|'widget'|'panel'} ShellMode
 */

/**
 * @typedef {{
 *   recordId?: string,
 *   recordType?: string,
 *   hostSystem?: string,
 *   permissions?: string[],
 *   environment?: 'production'|'staging'|'development',
 * }} HostContext
 */

export const MetadataEngineCtx = createContext(/** @type {MetadataEngineContextValue|null} */ (null))

/**
 * Returns the MetadataEngineContext value.
 * Must be called inside an EmbeddableShell tree.
 *
 * @returns {MetadataEngineContextValue}
 */
export function useMetadataEngine() {
  const ctx = useContext(MetadataEngineCtx)
  if (!ctx) {
    throw new Error('useMetadataEngine must be called inside an EmbeddableShell')
  }
  return ctx
}
