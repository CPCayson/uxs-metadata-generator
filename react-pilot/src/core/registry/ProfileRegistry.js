/**
 * ProfileRegistry — global store of registered entity profiles.
 *
 * Profiles are registered at app startup (main.jsx or shell init) and looked
 * up by the engine layer when validating, exporting, or routing fields.
 *
 * @module core/registry/ProfileRegistry
 */

/** @type {Map<string, import('./types.js').EntityProfile>} */
const registry = new Map()

/**
 * Register an entity profile. Throws if a profile with the same id is already
 * registered (prevents accidental double-registration).
 *
 * @param {import('./types.js').EntityProfile} profile
 */
export function registerProfile(profile) {
  if (registry.has(profile.id)) {
    throw new Error(`ProfileRegistry: profile '${profile.id}' is already registered`)
  }
  registry.set(profile.id, profile)
}

/**
 * Retrieve a registered profile by id. Throws if not found.
 *
 * @param {string} profileId
 * @returns {import('./types.js').EntityProfile}
 */
export function getProfile(profileId) {
  const p = registry.get(profileId)
  if (!p) throw new Error(`ProfileRegistry: no profile registered for '${profileId}'`)
  return p
}

/**
 * Returns true if a profile with the given id is registered.
 *
 * @param {string} profileId
 * @returns {boolean}
 */
export function hasProfile(profileId) {
  return registry.has(profileId)
}

/**
 * Returns all registered profiles.
 *
 * @returns {import('./types.js').EntityProfile[]}
 */
export function listProfiles() {
  return [...registry.values()]
}

/**
 * Clears all registered profiles. Intended for use in tests only.
 */
export function _clearRegistryForTesting() {
  registry.clear()
}
