/**
 * Lightweight audit hook for pilot actions (draft save, import, etc.).
 * Dispatches a debug event; can be extended to POST to an API.
 *
 * @param {Record<string, unknown>} detail
 */
export function emitPilotAuditEvent(detail) {
  try {
    window.dispatchEvent(new CustomEvent('manta:pilot-audit', { detail }))
  } catch {
    // ignore
  }
}
