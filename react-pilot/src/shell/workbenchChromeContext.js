import { createContext } from 'react'

/**
 * Workbench chrome: where the floating validator docks (split-float layout).
 *
 * @typedef {{
 *   assistantLayout: 'floating' | 'left' | 'split-float',
 *   validatorHostEl: HTMLElement | null,
 *   registerValidatorHost: (el: HTMLElement | null) => void,
 *   lensActive: boolean,
 *   workspaceDensity: 'simple' | 'granular',
 *   setWorkspaceDensity: (d: 'simple' | 'granular') => void,
 * }} WorkbenchChromeValue
 */

/** @type {import('react').Context<WorkbenchChromeValue | null>} */
export const WorkbenchChromeCtx = createContext(/** @type {WorkbenchChromeValue | null} */ (null))
