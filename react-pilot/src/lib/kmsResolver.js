import { searchGcmdSchemeClient } from './gcmdClient.js'

const FACETS = [
  { key: 'sciencekeywords', scheme: 'sciencekeywords' },
  { key: 'datacenters', scheme: 'datacenters' },
  { key: 'platforms', scheme: 'platforms' },
  { key: 'instruments', scheme: 'instruments' },
  { key: 'locations', scheme: 'locations' },
  { key: 'projects', scheme: 'projects' },
  { key: 'providers', scheme: 'providers' },
]

const KMS_RESOLVE_MIN_SCORE = 0.72

/**
 * Resolves all missing keyword UUIDs in the provided keywords object.
 * @param {Record<string, any[]>} keywords 
 * @returns {Promise<{ next: Record<string, any[]>, updated: number }>}
 */
export async function bulkResolveKeywords(keywords) {
  const next = { ...keywords }
  let updated = 0
  
  for (const { key, scheme } of FACETS) {
    const list = Array.isArray(next[key]) ? [...next[key]] : []
    let listModified = false
    
    for (let i = 0; i < list.length; i += 1) {
      const row = list[i]
      const label = String(row?.label || '').trim()
      const uuid = String(row?.uuid || '').trim()
      
      if (!label || uuid) continue
      
      try {
        const matches = await searchGcmdSchemeClient(scheme, label, { maxMatches: 10, maxPages: 2 })
        const top = matches[0]
        if (top && top.score >= KMS_RESOLVE_MIN_SCORE) {
          list[i] = { label: top.prefLabel || label, uuid: top.uuid }
          updated += 1
          listModified = true
        }
      } catch (err) {
        console.warn(`Failed to resolve keyword "${label}" in scheme "${scheme}":`, err)
      }
    }
    
    if (listModified) {
      next[key] = list
    }
  }
  
  return { next, updated }
}
