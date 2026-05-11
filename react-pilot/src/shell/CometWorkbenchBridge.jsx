/**
 * Bridges CoMET workflow state from WizardShell (useCometActionsForProfile) to
 * AssistantShell FAB when split-float hides the right-rail CoMET tab.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import CometPushPanel from '../features/comet/CometPushPanel.jsx'

/** @typedef {{ cometUuid: string } & Record<string, unknown>} CometWorkbenchPayload */

const CometWorkbenchBridgeCtx = createContext(
  /** @type {{ payload: CometWorkbenchPayload | null, registerCometWorkbench: (p: CometWorkbenchPayload | null) => void }} */ ({
    payload: null,
    registerCometWorkbench: () => {},
  }),
)

export function CometWorkbenchBridgeProvider({ children }) {
  const [payload, setPayload] = useState(/** @type {CometWorkbenchPayload | null} */ (null))
  const registerCometWorkbench = useCallback((next) => {
    setPayload(next)
  }, [])
  const value = useMemo(
    () => ({ payload, registerCometWorkbench }),
    [payload, registerCometWorkbench],
  )
  return (
    <CometWorkbenchBridgeCtx.Provider value={value}>
      {children}
    </CometWorkbenchBridgeCtx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- context hook + provider
export function useCometWorkbenchBridge() {
  return useContext(CometWorkbenchBridgeCtx)
}

/**
 * Renders {@link CometPushPanel} from a {@link CometWorkbenchPayload} registered in WizardShell
 * (`{ cometUuid, ...useCometActionsForProfile() }`).
 * @param {{ payload: CometWorkbenchPayload | null, embedInFab?: boolean }} props
 */
export function CometPushPanelFromWorkbench({ payload, embedInFab = true }) {
  if (!payload) return null
  const { cometUuid, ...c } = payload
  return (
    <CometPushPanel
      cometUuid={cometUuid}
      localUuidInput={c.localUuidInput}
      setLocalUuidInput={c.setLocalUuidInput}
      similarUuidCandidates={c.similarUuidCandidates}
      capPull={c.capPull}
      capPreflight={c.capPreflight}
      capPush={c.capPush}
      pullBusy={c.pullBusy}
      pushBusy={c.pushBusy}
      preflightBusy={c.preflightBusy}
      metaserverBusy={c.metaserverBusy}
      preflightSummary={c.preflightSummary}
      metaserverSummary={c.metaserverSummary}
      onPull={c.pullFromComet}
      onPreflight={c.runPreflightChain}
      onMetaserverValidate={c.runMetaserverValidate}
      onPush={c.pushDraftToComet}
      cometUsername={c.cometUsername}
      setCometUsername={c.setCometUsername}
      cometPassword={c.cometPassword}
      setCometPassword={c.setCometPassword}
      authBusy={c.authBusy}
      authStatus={c.authStatus}
      onRefreshAuthStatus={c.refreshAuthStatus}
      onCometLogin={c.runCometLogin}
      onMetaserverLogin={c.runMetaserverLogin}
      onClearAuth={c.clearAuthSessions}
      embedInFab={embedInFab}
    />
  )
}
