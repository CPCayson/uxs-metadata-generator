/**
 * Manta host ↔ embed contract (window events + targets).
 * Used by the React app, EmbeddableShell, and (future) browser extension content
 * scripts that need to open the lens, sync session, or jump to a field.
 *
 * Events (name → detail / notes):
 * - `manta:open-lens` — no detail; close floating card and enter lens
 * - `manta:close-lens` — close lens
 * - `manta:pilot-session-updated` — sessionStorage pilot payload written
 * - `manta:wizard-active-step` — { stepId: string }
 * - `manta:goto-step` — { stepId: string }
 * - `manta:lens-goto-field` — { field: string }  pilot path e.g. mission.title
 * - `manta:set-pilot-field` — { field, value }
 * - `manta:set-validation-mode` — { mode: 'lenient'|'strict'|'catalog' }
 * - `manta:wizard-validation-mode-changed` — from wizard, same as above
 * - `manta:pilot-auto-fix-request` — { mode?: string }
 * - `manta:comet-load` — { parsed, uuid, gaps }
 *
 * Portals: lens mounts under `#manta-scanner-host` (wraps the side rail card next to
 * the form; see WizardShell) via MantaScannerFrame.
 *
 * @module lib/mantaHostEvents
 */
export const MANTA_SCANNER_HOST_ID = 'manta-scanner-host'
