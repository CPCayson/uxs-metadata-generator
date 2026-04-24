import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { countLineDiff, highlightXmlToHtml } from '../lib/xmlSyntaxHighlight'
import { fieldKeyForElement, findFieldLineInXml } from '../lib/xmlFieldLineLocator'

/**
 * @param {{
 *   pilotState: object,
 *   buildXml: (state: object) => string,
 *   lastSavedXmlPreview?: string,
 *   expanded?: boolean,
 *   onToggleExpand?: (next: boolean) => void,
 * }} props
 */
function XmlPreviewPanel({
  pilotState,
  buildXml,
  lastSavedXmlPreview = '',
  expanded = false,
  onToggleExpand,
}) {
  // Keep typing snappy: the XML preview (expensive build + 300+ line paint)
  // renders from a DEFERRED copy of pilot state, so form inputs never wait
  // for XML to regenerate before accepting the next keystroke.
  const deferredPilotState = useDeferredValue(pilotState)
  const xml = useMemo(
    () => (typeof buildXml === 'function' ? buildXml(deferredPilotState) || '' : ''),
    [buildXml, deferredPilotState],
  )
  const [showSavedDiff, setShowSavedDiff] = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const [activeField, setActiveField] = useState('')
  const scrollRef = useRef(null)
  const lineRefs = useRef(new Map())

  const diff =
    showSavedDiff && lastSavedXmlPreview
      ? countLineDiff(lastSavedXmlPreview, xml)
      : null

  // Pre-compute per-line highlighted HTML + changed-set (vs last saved draft).
  const lines = useMemo(() => {
    const arr = String(xml).split('\n')
    const prev = showSavedDiff && lastSavedXmlPreview ? String(lastSavedXmlPreview).split('\n') : null
    return arr.map((raw, i) => ({
      num: i + 1,
      html: highlightXmlToHtml(raw),
      changed: prev ? (prev[i] ?? '') !== raw : false,
    }))
  }, [xml, showSavedDiff, lastSavedXmlPreview])

  // Scroll the active line into view and flash it.
  // `smooth: true` for user-initiated focus; false for typing-driven updates
  // (avoids fighting caret position when lines shift while you type).
  const focusLine = useCallback((n, { smooth = false } = {}) => {
    if (!n || n < 1) return
    setActiveLine(n)
    const el = lineRefs.current.get(n)
    const box = scrollRef.current
    if (!el || !box) return
    const boxRect = box.getBoundingClientRect()
    const elRect = el.getBoundingClientRect()
    // Skip scrolling if already comfortably inside the viewport — prevents
    // a cascade of tiny scrolls while the user is typing in the matching field.
    if (elRect.top >= boxRect.top + 24 && elRect.bottom <= boxRect.bottom - 24) return
    const target =
      box.scrollTop + (elRect.top - boxRect.top) - boxRect.height / 2 + elRect.height / 2
    box.scrollTo({ top: Math.max(0, target), behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // Global focusin listener — user-initiated jump uses SMOOTH scroll.
  // Refs allow this effect to bind once and not re-run per keystroke.
  // Updated via useLayoutEffect (not during render) to satisfy react-hooks/refs.
  const xmlRef = useRef(xml)
  const pilotStateRef = useRef(pilotState)
  useLayoutEffect(() => {
    xmlRef.current = xml
    pilotStateRef.current = pilotState
  })

  useEffect(() => {
    function onFocusIn(e) {
      const target = e.target instanceof HTMLElement ? e.target : null
      if (!target) return
      if (!(target.matches('input, select, textarea') || target.hasAttribute('data-pilot-field'))) return
      const key = fieldKeyForElement(target)
      if (!key) {
        // Focused field doesn't map to any pilot key — drop the active
        // line so the tether doesn't stay anchored to a stale target.
        setActiveField('')
        setActiveLine(0)
        return
      }
      setActiveField(key)
      const line = findFieldLineInXml({
        field: key,
        xml: xmlRef.current,
        pilotState: pilotStateRef.current,
      })
      if (line) {
        focusLine(line, { smooth: true })
      } else {
        // The field has a key but no XML line matches — still clear so
        // the tether hides instead of pointing to the previous line.
        setActiveLine(0)
      }
    }
    document.addEventListener('focusin', onFocusIn)
    return () => document.removeEventListener('focusin', onFocusIn)
  }, [focusLine])

  // Re-seek the currently-tracked field when the XML content changes.
  // Debounced via rAF so bursts of keystrokes don't trigger a scroll per char.
  useEffect(() => {
    if (!activeField) return
    let raf = 0
    raf = window.requestAnimationFrame(() => {
      const line = findFieldLineInXml({ field: activeField, xml, pilotState: deferredPilotState })
      if (line && line !== activeLine) focusLine(line, { smooth: false })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [xml, activeField, deferredPilotState, activeLine, focusLine])

  return (
    <div
      className={[
        'xml-preview-panel fx-xml-panel',
        expanded ? 'fx-xml-panel--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="xml-preview-header fx-xml-header">
        <h2>
          <span className="fx-xml-title-dot" aria-hidden>●</span>
          LIVE XML <span className="fx-xml-title-sub">// iso-19115-2</span>
        </h2>
        <div className="fx-xml-header-meta" aria-live="polite">
          <span className="fx-xml-pill">
            <span className="fx-xml-pill-label">L</span>
            <span className="fx-xml-pill-value">{lines.length}</span>
          </span>
          <span
            className={`fx-xml-pill${activeField ? ' fx-xml-pill--active' : ''}`}
            title={activeField ? `Tracking field: ${activeField}` : 'No field tracked'}
          >
            <span className="fx-xml-pill-label">▸</span>
            <span className="fx-xml-pill-value fx-xml-pill-value--mono">
              {activeField || 'idle'}
            </span>
          </span>
          {typeof onToggleExpand === 'function' ? (
            <button
              type="button"
              className="fx-xml-expand-btn"
              onClick={() => onToggleExpand(!expanded)}
              aria-pressed={expanded}
              title={expanded ? 'Collapse XML panel' : 'Expand XML panel to full sidebar'}
            >
              {expanded ? '⤡' : '⤢'}
            </button>
          ) : null}
        </div>
      </div>

      {lastSavedXmlPreview ? (
        <label className="xml-diff-toggle">
          <input type="checkbox" checked={showSavedDiff} onChange={(e) => setShowSavedDiff(e.target.checked)} />
          <span>Highlight line delta vs last successful draft save</span>
        </label>
      ) : null}
      {diff ? (
        <p className="xml-diff-summary" role="status">
          {diff.changed} of {diff.total} lines differ from the last saved draft snapshot.
        </p>
      ) : null}

      <div
        ref={scrollRef}
        className="xml-preview-box xml-preview-box--scroll fx-xml-scroll"
        aria-label="ISO-like XML preview"
      >
        <div className="fx-xml-lines" role="document">
          {lines.map((line) => {
            const isActive = line.num === activeLine
            const cls = [
              'fx-xml-line',
              isActive ? 'fx-xml-line--active' : '',
              line.changed ? 'fx-xml-line--changed' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <div
                key={line.num}
                ref={(node) => {
                  if (node) lineRefs.current.set(line.num, node)
                  else lineRefs.current.delete(line.num)
                }}
                className={cls}
                data-line={line.num}
                data-active-xml-line={isActive ? 'true' : undefined}
              >
                <span className="fx-xml-line-num" aria-hidden>{String(line.num).padStart(3, ' ')}</span>
                <code className="fx-xml-line-code" dangerouslySetInnerHTML={{ __html: line.html || '&nbsp;' }} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(XmlPreviewPanel)
