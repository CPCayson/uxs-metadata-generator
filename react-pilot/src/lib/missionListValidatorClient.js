const API = '/api/mission-list-validate'

/**
 * @param {{ csvText: string, filename?: string }} args
 * @returns {Promise<{ ok: boolean, rowCount: number, errorCount: number, warningCount: number, errors: string[], warnings: string[] }>}
 */
export async function validateMissionListCsv(args) {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  const body = await res.json().catch(() => ({ ok: false, error: 'Invalid server response' }))
  if (!res.ok && !body?.ok) {
    throw new Error(body?.error || `mission-list-validate failed (${res.status})`)
  }
  return body
}

