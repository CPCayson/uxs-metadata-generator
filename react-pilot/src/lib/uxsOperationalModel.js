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

/** Keys persisted in `gmd:supplementalInformation` for preview ↔ import roundtrip (matches `UXS_CONTEXT_DEFAULT`). */
export const UXS_PILOT_MACHINE_KEYS = [
  'primaryLayer',
  'deploymentName',
  'deploymentId',
  'runName',
  'runId',
  'sortieName',
  'sortieId',
  'diveName',
  'diveId',
  'operationOutcome',
  'narrative',
]

export const UXS_PILOT_MACHINE_HEADER = 'UxS operational context (Manta pilot state)'

/**
 * True when non-default UxS context should be written into ISO supplemental text.
 * @param {unknown} uxsContext
 */
export function shouldEmitUxsPilotMachineBlock(uxsContext) {
  const ctx = uxsContext && typeof uxsContext === 'object' ? /** @type {Record<string, unknown>} */ (uxsContext) : {}
  if (String(ctx.primaryLayer || '').trim() && String(ctx.primaryLayer) !== 'datasetProduct') return true
  for (const k of UXS_PILOT_MACHINE_KEYS) {
    if (k === 'primaryLayer') continue
    if (String(ctx[k] ?? '').trim()) return true
  }
  return false
}

/**
 * Strip the machine-readable UxS trailer from supplemental text (if present).
 * @param {string} text
 */
export function stripUxsPilotMachineBlock(text) {
  const s = String(text ?? '')
  const idx = s.indexOf(UXS_PILOT_MACHINE_HEADER)
  if (idx === -1) return s.trimEnd()
  return s.slice(0, idx).trimEnd()
}

/**
 * @param {unknown} uxsContext
 * @returns {string}
 */
export function formatUxsPilotMachineBlock(uxsContext) {
  if (!shouldEmitUxsPilotMachineBlock(uxsContext)) return ''
  const ctx = uxsContext && typeof uxsContext === 'object' ? /** @type {Record<string, unknown>} */ (uxsContext) : {}
  const lines = [UXS_PILOT_MACHINE_HEADER]
  for (const k of UXS_PILOT_MACHINE_KEYS) {
    lines.push(`${k}=${String(ctx[k] ?? '').trim()}`)
  }
  return lines.join('\n')
}

/**
 * Split supplemental XML text into user-facing prose (minus machine block) + parsed key/value pairs for `uxsContext`.
 * @param {string} fullText
 * @returns {{ userSupplemental: string, uxsPatch: Record<string, string> | null }}
 */
export function parseUxsPilotMachineBlockFromSupplemental(fullText) {
  const s = String(fullText ?? '')
  const idx = s.indexOf(UXS_PILOT_MACHINE_HEADER)
  if (idx === -1) return { userSupplemental: s.trim(), uxsPatch: null }
  const userSupplemental = s.slice(0, idx).trimEnd()
  const block = s.slice(idx)
  const lines = block.split(/\r?\n/)
  /** @type {Record<string, string>} */
  const raw = {}
  const allowed = new Set(UXS_PILOT_MACHINE_KEYS)
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i]
    const eq = line.indexOf('=')
    if (eq === -1) continue
    const k = line.slice(0, eq).trim()
    if (!allowed.has(k)) continue
    raw[k] = line.slice(eq + 1).trim()
  }
  if (!Object.keys(raw).length) return { userSupplemental, uxsPatch: null }
  return { userSupplemental, uxsPatch: raw }
}

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
