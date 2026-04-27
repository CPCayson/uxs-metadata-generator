export const UXS_LAYER_OPTIONS = [
  { value: 'datasetProduct', label: 'Dataset or product', idField: '', nameField: '' },
  { value: 'deployment', label: 'Deployment / field effort', idField: 'deploymentId', nameField: 'deploymentName' },
  { value: 'run', label: 'Run / continuous operation', idField: 'runId', nameField: 'runName', parentField: 'deploymentId' },
  { value: 'sortie', label: 'Sortie', idField: 'sortieId', nameField: 'sortieName', parentField: 'runId' },
  { value: 'dive', label: 'Dive / submerged operation', idField: 'diveId', nameField: 'diveName', parentField: 'runId' },
  { value: 'other', label: 'Other / mixed', idField: '', nameField: '' },
]

export const UXS_OUTCOME_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'completed', label: 'Completed' },
  { value: 'partial', label: 'Partial' },
  { value: 'aborted', label: 'Aborted' },
  { value: 'unknown', label: 'Unknown' },
]

export const UXS_OPERATION_RELATIONSHIP_TYPES = [
  { id: 'program-deployment', label: 'Program contains deployment', parent: 'program', child: 'deployment' },
  { id: 'deployment-run', label: 'Deployment contains run', parent: 'deployment', child: 'run' },
  { id: 'run-sortie', label: 'Run contains sortie', parent: 'run', child: 'sortie' },
  { id: 'run-dive', label: 'Run contains dive', parent: 'run', child: 'dive' },
  { id: 'operation-dataset', label: 'Operation produces dataset/product', parent: 'operation', child: 'datasetProduct' },
]

/**
 * @param {unknown} uxsContext
 */
export function getUxsLayerDefinition(uxsContext) {
  const ctx = uxsContext && typeof uxsContext === 'object' ? /** @type {Record<string, unknown>} */ (uxsContext) : {}
  const layer = String(ctx.primaryLayer || 'datasetProduct')
  return UXS_LAYER_OPTIONS.find((opt) => opt.value === layer) ?? UXS_LAYER_OPTIONS[0]
}

/**
 * @param {unknown} uxsContext
 */
export function buildUxsOperationalRelationship(uxsContext) {
  const ctx = uxsContext && typeof uxsContext === 'object' ? /** @type {Record<string, unknown>} */ (uxsContext) : {}
  const def = getUxsLayerDefinition(ctx)
  const id = def.idField ? String(ctx[def.idField] || '').trim() : ''
  const name = def.nameField ? String(ctx[def.nameField] || '').trim() : ''
  const parentId = def.parentField ? String(ctx[def.parentField] || '').trim() : ''
  return {
    kind: def.value,
    label: def.label,
    id,
    name,
    parentId,
    outcome: String(ctx.operationOutcome || '').trim(),
    narrative: String(ctx.narrative || '').trim(),
  }
}

/**
 * @param {unknown} uxsContext
 */
export function summarizeUxsOperationalRelationship(uxsContext) {
  const rel = buildUxsOperationalRelationship(uxsContext)
  const parts = [`UxS operational layer: ${rel.label}`]
  if (rel.id) parts.push(`ID: ${rel.id}`)
  if (rel.name) parts.push(`name: ${rel.name}`)
  if (rel.parentId) parts.push(`parent ID: ${rel.parentId}`)
  if (rel.outcome) parts.push(`outcome: ${rel.outcome}`)
  if (rel.narrative) parts.push(`note: ${rel.narrative}`)
  return parts.join('; ')
}
