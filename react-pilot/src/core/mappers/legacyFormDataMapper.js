/**
 * Bidirectional mapper between the legacy GAS formData shape and the
 * canonical metadata entity model.
 *
 * Legacy shape: { mission, platform, sensors, spatial, output }
 * where `mission` carries aliased field names (`missionId`, `missionTitle`,
 * `organization`, `contactEmail`, `nceiAccessionId`) alongside the newer ones.
 *
 * Strategy:
 *   canonicalToLegacyFormData — composed from existing pilotToLegacyFormData.js
 *     so no mapping logic is duplicated.
 *   legacyFormDataToCanonical — normalises aliases → pilotState shape,
 *     then delegates to pilotStateToCanonical.
 *
 * @module core/mappers/legacyFormDataMapper
 */

import { pilotStateToLegacyFormData } from '../../lib/pilotToLegacyFormData.js'
import { pilotStateToCanonical, canonicalToPilotState } from './pilotStateMapper.js'

// ---------------------------------------------------------------------------
// Forward: legacyFormData → canonical
// ---------------------------------------------------------------------------

/**
 * Convert a legacy GAS formData payload to a CanonicalMetadataEntity.
 *
 * The legacy `mission` block uses aliased keys (`missionId`, `missionTitle`,
 * `organization`, etc.) that the pilotState uses under different names.  We
 * normalise them before routing through pilotStateToCanonical so the mapping
 * logic lives in one place.
 *
 * @param {{ mission?: object, platform?: object, sensors?: object[], spatial?: object, output?: object }} formData
 * @returns {import('../entities/types.js').CanonicalMetadataEntity}
 */
export function legacyFormDataToCanonical(formData) {
  const m = formData?.mission && typeof formData.mission === 'object' ? { ...formData.mission } : {}
  const output = formData?.output && typeof formData.output === 'object' ? { ...formData.output } : {}

  // Normalise legacy alias keys → pilotState keys
  const mission = {
    ...m,
    // identifier aliases
    fileId: m.fileId ?? m.missionId ?? '',
    title: m.title ?? m.missionTitle ?? '',
    org: m.org ?? m.organization ?? '',
    email: m.email ?? m.contactEmail ?? '',
    accession: m.accession ?? m.nceiAccessionId ?? '',
    // bbox: legacy may have had west/east/south/north directly on mission
    west: m.west ?? '',
    east: m.east ?? '',
    south: m.south ?? '',
    north: m.north ?? '',
  }

  // Rebuild ROR object from flat legacy fields if the structured .ror is absent
  if (!mission.ror && (m.organizationRorId || m.organizationRorUri)) {
    mission.ror = {
      id: m.organizationRorId ?? m.organizationRorUri ?? '',
      name: m.organizationRorDisplayName ?? m.organizationRorName ?? '',
      country: m.organizationRorCountry ?? '',
    }
  }

  // Map `output` → `distribution` (legacy naming; all fields carry through)
  const distribution = {
    ...output,
    format: output.format ?? output.outputFormat ?? '',
  }

  // Build a pilotState-compatible shape then reuse the canonical mapper
  const pilotState = {
    mission,
    platform: formData?.platform ?? {},
    sensors: Array.isArray(formData?.sensors) ? formData.sensors : [],
    spatial: formData?.spatial ?? {},
    keywords: m.keywords ?? {},
    distribution,
    mode: m.mode ?? 'lenient',
  }

  return pilotStateToCanonical(pilotState)
}

// ---------------------------------------------------------------------------
// Reverse: canonical → legacyFormData
// ---------------------------------------------------------------------------

/**
 * Convert a CanonicalMetadataEntity to the legacy GAS formData shape.
 *
 * Implemented as a composition of the two existing mappers so no new field
 * logic is introduced here:
 *   canonical → pilotState → legacyFormData
 *
 * @param {import('../entities/types.js').CanonicalMetadataEntity} entity
 * @returns {{ mission: object, platform: object, sensors: object[], spatial: object, output: object }}
 */
export function canonicalToLegacyFormData(entity) {
  return pilotStateToLegacyFormData(canonicalToPilotState(entity))
}

/**
 * Round-trip helper for HTTP `/api/db` server validation: legacy formData → pilotState
 * using the same canonical bridge as imports.
 *
 * @param {{ mission?: object, platform?: object, sensors?: object[], spatial?: object, output?: object }} formData
 * @returns {object}
 */
export function legacyFormDataToPilotState(formData) {
  return canonicalToPilotState(legacyFormDataToCanonical(formData))
}
