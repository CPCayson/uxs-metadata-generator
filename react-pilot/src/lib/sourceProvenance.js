/**
 * Source provenance helpers — stamp metadata imports with origin context.
 *
 * @module lib/sourceProvenance
 */

/**
 * @param {import('../core/registry/types.js').SourceProvenanceType} sourceType
 * @param {import('../core/registry/types.js').ImportParseMeta} [meta]
 * @returns {import('../core/registry/types.js').SourceProvenance}
 */
export function buildSourceProvenance(sourceType, meta = {}) {
  return {
    sourceType,
    sourceId:           String(meta.sourceId ?? '').trim(),
    importedAt:         new Date().toISOString(),
    originalFilename:   String(meta.originalFilename ?? '').trim(),
    originalUuid:       String(meta.originalUuid ?? '').trim(),
  }
}
