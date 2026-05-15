import { memo, useCallback, useDeferredValue, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { countLineDiff, highlightXmlToHtml } from '../lib/xmlSyntaxHighlight'
import { fieldKeyForElement, findFieldLineInXml, FIELD_ELEMENT_HINT } from '../lib/xmlFieldLineLocator'
import { analyzeMissionPreviewXml } from '../lib/xmlPreviewStructuralHints.js'
import FieldHintTooltip from './FieldHintTooltip.jsx'
import { ValidationPill } from './ValidationPill.jsx'
import { CometValidationPanel } from './CometValidationPanel.jsx'
import PreviewVerificationTierStrip from './PreviewVerificationTierStrip.jsx'

const ALL_FIELD_KEYS = Object.keys(FIELD_ELEMENT_HINT)

/**
 * @param {{
 *   pilotState: object,
 *   buildXml: (state: object) => string,
 *   lastSavedXmlPreview?: string,
 *   expanded?: boolean,
 *   onToggleExpand?: (next: boolean) => void,
 *   compactRailHeader?: boolean,
 *   railHideFieldPill?: boolean,
 * }} props
 */
function XmlPreviewPanel({
  pilotState,
  buildXml,
  lastSavedXmlPreview = '',
  expanded = false,
  onToggleExpand,
  compactRailHeader = false,
  railHideFieldPill = false,
}) {
  // Canonical preview = same string as Download preview / `</> ISO XML` / import-report diff (immediate state).
  const previewXml = useMemo(
    () => (typeof buildXml === 'function' ? buildXml(pilotState) || '' : ''),
    [buildXml, pilotState],
  )
  // Defer only the painted snapshot so syntax highlighting does not block keystrokes; Copy XML / draft diff use previewXml.
  const renderXml = useDeferredValue(previewXml)
  const [showSavedDiff, setShowSavedDiff] = useState(false)
  const [activeLine, setActiveLine] = useState(0)
  const [activeField, setActiveField] = useState('')
  const [copyFlash, setCopyFlash] = useState(false)
  const scrollRef = useRef(null)
  const lineRefs = useRef(new Map())

  const diff =
    showSavedDiff && lastSavedXmlPreview
      ? countLineDiff(lastSavedXmlPreview, previewXml)
      : null

  const canonicalLineCount = useMemo(
    () => (previewXml ? String(previewXml).split('\n').length : 0),
    [previewXml],
  )

  /** DOMParser well-formed check (same idea as `xmllint --noout` for structure; XSD validation stays external). */
  const xmlWellFormed = useMemo(() => {
    const x = String(previewXml || '').trim()
    if (!x) return { ok: null, detail: '' }
    try {
      const doc = new DOMParser().parseFromString(x, 'application/xml')
      const pe = doc.getElementsByTagName('parsererror')[0]
      if (pe) {
        const d = String(pe.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160)
        return { ok: false, detail: d }
      }
      return { ok: true, detail: '' }
    } catch {
      return { ok: false, detail: 'XML parser error' }
    }
  }, [previewXml])

  // Pre-compute per-line highlighted HTML + changed-set (vs last saved draft).
  const structuralHints = useMemo(
    () => analyzeMissionPreviewXml(previewXml).messages,
    [previewXml],
  )

  const lines = useMemo(() => {
    const displayArr = String(renderXml).split('\n')
    const canonicalArr = String(previewXml).split('\n')
    const prev = showSavedDiff && lastSavedXmlPreview ? String(lastSavedXmlPreview).split('\n') : null
    return displayArr.map((raw, i) => ({
      num: i + 1,
      html: highlightXmlToHtml(raw),
      changed: prev ? (prev[i] ?? '') !== (canonicalArr[i] ?? '') : false,
    }))
  }, [previewXml, renderXml, showSavedDiff, lastSavedXmlPreview])

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

  // Reverse map: line number → nearest field key, rebuilt when xml changes.
  const lineToField = useMemo(() => {
    const map = new Map()
    for (const field of ALL_FIELD_KEYS) {
      const line = findFieldLineInXml({ field, xml: previewXml, pilotState: null })
      if (line) map.set(line, field)
    }
    return map
  }, [previewXml])

  const copyPreviewXml = useCallback(async () => {
    const text = String(previewXml || '')
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      setCopyFlash(true)
      window.setTimeout(() => setCopyFlash(false), 2000)
    } catch {
      /* clipboard may be denied — ignore */
    }
  }, [previewXml])

  const handleLineClick = useCallback((lineNum) => {
    // Find the closest mapped field at or before the clicked line.
    let best = null
    let bestDist = Infinity
    for (const [mappedLine, field] of lineToField) {
      const dist = Math.abs(mappedLine - lineNum)
      if (dist < bestDist) { bestDist = dist; best = field }
    }
    if (!best || bestDist > 30) return
    focusLine(lineNum, { smooth: true })
    window.dispatchEvent(new CustomEvent('manta:lens-goto-field', { detail: { field: best } }))
  }, [lineToField, focusLine])

  // Global focusin listener — user-initiated jump uses SMOOTH scroll.
  // Refs allow this effect to bind once and not re-run per keystroke.
  // Updated via useLayoutEffect (not during render) to satisfy react-hooks/refs.
  const xmlRef = useRef(previewXml)
  const pilotStateRef = useRef(pilotState)
  useLayoutEffect(() => {
    xmlRef.current = previewXml
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
      const line = findFieldLineInXml({ field: activeField, xml: previewXml, pilotState })
      if (line && line !== activeLine) focusLine(line, { smooth: false })
    })
    return () => window.cancelAnimationFrame(raf)
  }, [previewXml, activeField, pilotState, activeLine, focusLine])

  return (
    <div
      className={[
        'xml-preview-panel fx-xml-panel',
        expanded ? 'fx-xml-panel--expanded' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        className={[
          'xml-preview-header fx-xml-header',
          compactRailHeader ? 'fx-xml-header--rail-compact' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div className="fx-xml-header-title-group">
          <h2>
            {compactRailHeader ? (
              'XML preview'
            ) : (
              <>
                <span className="fx-xml-title-dot" aria-hidden>●</span>
                LIVE XML <span className="fx-xml-title-sub">// iso-19115-2</span>
              </>
            )}
          </h2>
          {!compactRailHeader ? (
            <FieldHintTooltip ariaLabel="About the XML preview" className="fx-xml-preview-hint">
              <>
                <strong>Live preview</strong> uses the same XML string as <strong>Download preview</strong>,{' '}
                <strong>{'</>'} ISO XML</strong>, and import reports.
              </>
            </FieldHintTooltip>
          ) : null}
        </div>
        <div className="fx-xml-header-meta" aria-live="polite">
          <button
            type="button"
            className="fx-xml-copy-btn"
            onClick={() => void copyPreviewXml()}
            disabled={!String(previewXml || '').trim()}
            title="Copy preview XML only (no labels or line numbers)"
            aria-label="Copy preview XML to clipboard"
          >
            {copyFlash ? 'Copied' : 'Copy XML'}
          </button>
          {compactRailHeader ? (
            <PreviewVerificationTierStrip variant="xml-compact" className="fx-xml-tier-strip--compact" />
          ) : xmlWellFormed.ok != null ? (
            <span
              className={`fx-xml-pill${xmlWellFormed.ok ? ' fx-xml-pill--ok' : ' fx-xml-pill--bad'}`}
              title={
                xmlWellFormed.ok
                  ? 'Well-formed XML (browser DOMParser). Tier 2 (below): NOAA XSD via xmllint-wasm. External xmllint/CoMET still available.'
                  : xmlWellFormed.detail || 'Not well-formed'
              }
            >
              <span className="fx-xml-pill-label">WF</span>
              <span className="fx-xml-pill-value">{xmlWellFormed.ok ? 'ok' : 'err'}</span>
            </span>
          ) : null}
          <span className="fx-xml-pill">
            <span className="fx-xml-pill-label">L</span>
            <span className="fx-xml-pill-value">{canonicalLineCount}</span>
          </span>
          {!railHideFieldPill ? (
            <span
              className={`fx-xml-pill${activeField ? ' fx-xml-pill--active' : ''}`}
              title={activeField ? `Tracking field: ${activeField}` : 'No field tracked'}
            >
              <span className="fx-xml-pill-label">▸</span>
              <span className="fx-xml-pill-value fx-xml-pill-value--mono">
                {activeField || 'idle'}
              </span>
            </span>
          ) : null}
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
        {!compactRailHeader ? (
          <>
            <PreviewVerificationTierStrip variant="xml-expanded" className="fx-xml-tier-strip--expanded" />
            <div className="fx-xml-tier2-wrap" style={{ padding: '4px 0 0 4px' }}>
              <ValidationPill xmlData={previewXml} />
            </div>
            <div className="fx-xml-tier3-wrap" style={{ padding: '4px 0 0 4px' }}>
              <CometValidationPanel xmlData={previewXml} />
            </div>
          </>
        ) : null}
      </div>

      {pilotState?.sourceProvenance?.importIsoXmlFamily === '19115-3' ? (
        <div className="xml-preview-structural-hints" role="note">
          <p className="hint">
            Imported as ISO 19115-3; live preview and file export are normalized to ISO 19115-2 (GMI / GMD).
          </p>
        </div>
      ) : null}
      {structuralHints.length ? (
        <div className="xml-preview-structural-hints" role="note">
          {structuralHints.map((msg, i) => (
            <p key={i} className="hint">
              {msg}
            </p>
          ))}
        </div>
      ) : null}
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
                onClick={() => handleLineClick(line.num)}
                style={{ cursor: lineToField.has(line.num) ? 'pointer' : 'default' }}
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
