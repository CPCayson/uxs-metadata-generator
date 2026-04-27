/**
 * Profile-neutral host-backed shell actions.
 *
 * This is the public shell import for draft/template/platform/server-export
 * actions. The current implementation delegates to the legacy mission-named
 * hook while those actions are still being generalized by capability.
 *
 * @module shell/hooks/useProfileHostActions
 */

import { useMissionActions } from './useMissionActions.js'

export const useProfileHostActions = useMissionActions
