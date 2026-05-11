import { useContext } from 'react'
import { WorkbenchChromeCtx } from './workbenchChromeContext.js'

/**
 * @returns {import('./workbenchChromeContext.js').WorkbenchChromeValue}
 */
export function useWorkbenchChrome() {
  const v = useContext(WorkbenchChromeCtx)
  if (!v) {
    return {
      assistantLayout: 'floating',
      validatorHostEl: null,
      registerValidatorHost: () => {},
      lensActive: false,
      workspaceDensity: 'simple',
      setWorkspaceDensity: () => {},
    }
  }
  return v
}
