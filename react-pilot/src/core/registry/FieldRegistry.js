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

import { scrollToPilotField, selectorForPilotField } from '../../lib/pilotFieldAnchors.js'

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
/**
 * Return the first DOM node associated with a pilot field (for focus rings / lens).
 * Resolution order matches {@link scrollToField}.
 *
 * @param {string} fieldPath
 * @returns {HTMLElement | null}
 */
export function getFieldElementForPilot(fieldPath) {
  if (!fieldPath) return null

  const dataAttr = `[data-pilot-field="${cssEscape(fieldPath)}"]`
  const byData = document.querySelector(dataAttr)
  if (byData instanceof HTMLElement) return byData

  const desc = registry.get(fieldPath)
  if (desc?.elementId) {
    const byId = document.getElementById(desc.elementId)
    if (byId instanceof HTMLElement) return byId
  }

  const sel = selectorForPilotField(fieldPath)
  if (!sel) return null
  for (const part of sel.split(',')) {
    try {
      const p = part.trim()
      if (!p) continue
      const el = document.querySelector(p)
      if (el instanceof HTMLElement) return el
    } catch {
      // invalid selector fragment
    }
  }
  return null
}

/**
 * DOM nodes to outline for lens / “jump to field” (control + label + local group).
 * Keeps focus rings on both the input and its visible label/panel.
 *
 * @param {string} fieldPath
 * @returns {HTMLElement[]}
 */
export function getFieldElementsForLensHighlight(fieldPath) {
  const el = getFieldElementForPilot(fieldPath)
  if (!el) return []

  const out = /** @type {Set<HTMLElement>} */ (new Set())
  out.add(el)

  const inLabel = el.closest('label')
  if (inLabel instanceof HTMLElement) out.add(inLabel)

  if (el.id) {
    try {
      const forLab = document.querySelector(`label[for="${cssEscapeForFor(el.id)}"]`)
      if (forLab instanceof HTMLElement) out.add(forLab)
    } catch { /* invalid id for selector */ }
  }

  const group = el.closest(
    '.form-group, .form-row, .form-row-2, .keyword-facet, .sensor-card, .input-group, .pilot-multivalue, .field-help, fieldset.pilot-fieldset',
  )
  if (group instanceof HTMLElement) out.add(group)

  const legend = el.closest('fieldset')?.querySelector('legend')
  if (legend instanceof HTMLElement) out.add(legend)

  return [...out]
}

export function scrollToField(fieldPath) {
  if (!fieldPath) return false

  const el = getFieldElementForPilot(fieldPath)
  if (el) return focusAndScroll(el)

  // Last resort: legacy scan may use multi-part logic not duplicated above
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

/** Escape for `label[for="..."]` when the id is not trivially alphanumeric. */
function cssEscapeForFor(id) {
  return String(id)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
}
