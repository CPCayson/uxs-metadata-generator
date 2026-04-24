/**
 * FieldRegistry — profile-driven field descriptor store.
 *
 * Replaces the hardcoded selector map in `pilotFieldAnchors.js` with a
 * registration-based approach: profiles declare their fields via
 * `registerField()`, and shell components call `scrollToField()` to navigate
 * the user to a specific field after a validation issue click.
 *
 * Backward compatibility:
 *   For any field that has NOT been explicitly registered, `scrollToField`
 *   falls back to `scrollToPilotField` from `pilotFieldAnchors.js`.  This
 *   ensures the full 6-step mission wizard continues to work without requiring
 *   every step component to be updated immediately.
 *
 * Migration path:
 *   Step components add `data-pilot-field="<fieldPath>"` attributes on their
 *   inputs and call `registerField()` (or let profiles call it at startup).
 *   Once all fields are registered, the `pilotFieldAnchors.js` fallback can
 *   be removed.
 *
 * @module core/registry/FieldRegistry
 */

import { scrollToPilotField } from '../../lib/pilotFieldAnchors.js'

/**
 * @typedef {{
 *   fieldPath:  string,
 *   stepId:     string,
 *   label:      string,
 *   elementId?: string,
 * }} FieldDescriptor
 */

/** @type {Map<string, FieldDescriptor>} */
const registry = new Map()

// ---------------------------------------------------------------------------
// Registration API
// ---------------------------------------------------------------------------

/**
 * Register a field descriptor.
 * Called at profile or step component initialisation time.
 *
 * @param {FieldDescriptor} descriptor
 */
export function registerField(descriptor) {
  if (!descriptor?.fieldPath) return
  registry.set(descriptor.fieldPath, descriptor)
}

/**
 * Register multiple field descriptors at once.
 * Convenience helper for profiles that declare all their fields in one array.
 *
 * @param {FieldDescriptor[]} descriptors
 */
export function registerFields(descriptors) {
  for (const d of descriptors ?? []) registerField(d)
}

/**
 * Look up a registered field descriptor.
 *
 * @param {string} fieldPath
 * @returns {FieldDescriptor | undefined}
 */
export function getField(fieldPath) {
  return registry.get(fieldPath)
}

/**
 * Returns all registered field descriptors (snapshot).
 *
 * @returns {FieldDescriptor[]}
 */
export function listFields() {
  return [...registry.values()]
}

/**
 * Clear all registered fields.
 * Primarily used in tests to reset state between cases.
 */
export function clearFields() {
  registry.clear()
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * Scroll the browser viewport to the DOM element for a given field path.
 *
 * Resolution order:
 *   1. `data-pilot-field="<fieldPath>"` attribute on any element
 *   2. `#<elementId>` if the descriptor has an explicit `elementId`
 *   3. Fallback: `scrollToPilotField(fieldPath)` from pilotFieldAnchors.js
 *      (covers all legacy mission-step fields during the transition period)
 *
 * @param {string} fieldPath  e.g. 'mission.fileId' or 'identification.title'
 * @returns {boolean}  true if an element was found and scrolled to
 */
export function scrollToField(fieldPath) {
  if (!fieldPath) return false

  // 1. Try data-attribute selector (works for any profile/step that sets it)
  const dataAttr = `[data-pilot-field="${cssEscape(fieldPath)}"]`
  const byData = document.querySelector(dataAttr)
  if (byData instanceof HTMLElement) {
    return focusAndScroll(byData)
  }

  // 2. Try explicit elementId from registered descriptor
  const desc = registry.get(fieldPath)
  if (desc?.elementId) {
    const byId = document.getElementById(desc.elementId)
    if (byId instanceof HTMLElement) {
      return focusAndScroll(byId)
    }
  }

  // 3. Fallback: pilotFieldAnchors.js legacy lookup
  return scrollToPilotField(fieldPath)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} el
 * @returns {boolean}
 */
function focusAndScroll(el) {
  try {
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    if (typeof el.focus === 'function') {
      try { el.focus({ preventScroll: true }) } catch { el.focus() }
    }
    return true
  } catch {
    return false
  }
}

/** Escape a string for use inside a CSS attribute selector value. */
function cssEscape(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}
