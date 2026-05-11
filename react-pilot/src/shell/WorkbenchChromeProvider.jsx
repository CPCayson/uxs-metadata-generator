import { useCallback, useMemo, useState } from 'react'
import { WorkbenchChromeCtx } from './workbenchChromeContext.js'

/**
 * @param {{
 *   assistantLayout?: 'floating' | 'left' | 'split-float',
 *   lensActive?: boolean,
 *   workspaceDensity?: 'simple' | 'granular',
 *   setWorkspaceDensity?: (d: 'simple' | 'granular') => void,
 *   children: import('react').ReactNode,
 * }} props
 */
export function WorkbenchChromeProvider({
  assistantLayout = 'floating',
  lensActive = false,
  workspaceDensity = 'simple',
  setWorkspaceDensity,
  children,
}) {
  const [validatorHostEl, setValidatorHostEl] = useState(/** @type {HTMLElement | null} */ (null))

  const registerValidatorHost = useCallback((el) => {
    setValidatorHostEl(el)
  }, [])

  const noopDensity = useCallback(() => {}, [])

  const value = useMemo(
    () => ({
      assistantLayout,
      validatorHostEl,
      registerValidatorHost,
      lensActive,
      workspaceDensity,
      setWorkspaceDensity: typeof setWorkspaceDensity === 'function' ? setWorkspaceDensity : noopDensity,
    }),
    [assistantLayout, validatorHostEl, registerValidatorHost, lensActive, workspaceDensity, setWorkspaceDensity, noopDensity],
  )

  return <WorkbenchChromeCtx.Provider value={value}>{children}</WorkbenchChromeCtx.Provider>
}
