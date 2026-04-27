/**
 * Profile-neutral CoMET action hook.
 *
 * CoMET remains an external publication/preflight adapter. The current
 * implementation delegates to the existing mission-profile hook, which already
 * branches by active profile capabilities and profile merge/export methods.
 *
 * @module features/comet/useCometActionsForProfile
 */

import {
  cometPushDescriptionForProfile,
  useMissionCometActions,
} from '../../profiles/mission/useMissionCometActions.js'

export { cometPushDescriptionForProfile }

export const useCometActionsForProfile = useMissionCometActions
