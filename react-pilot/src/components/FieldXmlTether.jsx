import { useEffect, useRef } from 'react'

/**
 * HUD tether — two independent neon bezier wires:
 *
 *  Wire 1 · FIELD → XML LINE  (cyan → violet)
 *  Wire 2 · ISSUE → FIELD     (amber → rose, on issue-row hover)
 *
 * Artifact-free: every hide path resets d="" on the SVG paths so no
 * stale geometry lingers. Both wires are refreshed on scroll/resize.
 */

const TYPING_PAUSE_MS = 240

function findFieldElement(fieldKey) {
  if (!fieldKey) return null
  let el = document.getElementById(fieldKey)
  if (el) return el
  el = document.getElementById(fieldKey.replace(/\./g, '-'))
  if (el) return el
  el = document.querySelector(`[data-pilot-field="${CSS.escape(fieldKey)}"]`)
  if (el) return el
  const leaf = fieldKey.split('.').pop()?.replace(/[[\]]/g, '') ?? ''
  if (leaf) {
    el = document.querySelector(
      `input[id$="${CSS.escape(leaf)}"], select[id$="${CSS.escape(leaf)}"], textarea[id$="${CSS.escape(leaf)}"]`
    )
    if (el) return el
  }
  return null
}

export default function FieldXmlTether() {
  const svgRef = useRef(null)

  // Wire 1 paths
  const w1Path = useRef(null)
  const w1Glow = useRef(null)
  const w1Dot1 = useRef(null)
  const w1Dot2 = useRef(null)

  // Wire 2 paths
  const w2Path = useRef(null)
  const w2Glow = useRef(null)
  const w2Dot1 = useRef(null)
  const w2Dot2 = useRef(null)

  // Mutable tracking (no state → no re-renders)
  const focusedEl   = useRef(null)
  const typing      = useRef(false)
  const w1Visible   = useRef(false)
  const w2Visible   = useRef(false)
  const rafId       = useRef(0)
  const typingTimer = useRef(0)
  const drawTimer   = useRef(0)

  useEffect(() => {
    // ── Class application ────────────────────────────────────────────
    function applyClasses() {
      const svg = svgRef.current
      if (!svg) return
      svg.classList.toggle('fx-tether--on',    w1Visible.current)
      svg.classList.toggle('fx-tether--issue', w2Visible.current)
    }

    // ── Wire 1 clear ─────────────────────────────────────────────────
    function clearWire1() {
      if (!w1Visible.current) return
      w1Visible.current = false
      // Reset geometry so no stale path lingers at opacity-0
      w1Path.current?.setAttribute('d', '')
      w1Glow.current?.setAttribute('d', '')
      applyClasses()
    }

    // ── Wire 2 clear ─────────────────────────────────────────────────
    function clearWire2() {
      if (!w2Visible.current) return
      w2Visible.current = false
      w2Path.current?.setAttribute('d', '')
      w2Glow.current?.setAttribute('d', '')
      applyClasses()
    }

    // ── Wire 1: recompute field → XML ────────────────────────────────
    function recompute() {
      rafId.current = 0
      const input   = focusedEl.current
      const xmlLine = document.querySelector('[data-active-xml-line="true"]')
      const path    = w1Path.current
      const glow    = w1Glow.current
      const dot1    = w1Dot1.current
      const dot2    = w1Dot2.current
      if (!path || !glow || !dot1 || !dot2) return

      if (!input || !xmlLine || !document.contains(input)) {
        clearWire1()
        return
      }

      const a  = input.getBoundingClientRect()
      const b  = xmlLine.getBoundingClientRect()
      const x1 = a.right + 2,  y1 = a.top + a.height / 2
      const x2 = b.left  - 2,  y2 = b.top + b.height / 2

      if (
        x2 - x1 < 40 ||
        y1 < -40 || y1 > window.innerHeight + 40 ||
        y2 < -40 || y2 > window.innerHeight + 40
      ) {
        clearWire1()
        return
      }

      const midX = (x1 + x2) / 2
      const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
      path.setAttribute('d', d)
      glow.setAttribute('d', d)
      dot1.setAttribute('cx', `${x1}`)
      dot1.setAttribute('cy', `${y1}`)
      dot2.setAttribute('cx', `${x2}`)
      dot2.setAttribute('cy', `${y2}`)

      if (!typing.current && !w1Visible.current) {
        w1Visible.current = true
        applyClasses()
      }
    }

    function schedule() {
      if (rafId.current) return
      rafId.current = window.requestAnimationFrame(recompute)
    }

    // ── Wire 2: draw issue → field ───────────────────────────────────
    function drawIssueWire(btn) {
      const path = w2Path.current
      const glow = w2Glow.current
      const dot1 = w2Dot1.current
      const dot2 = w2Dot2.current
      if (!path || !glow || !dot1 || !dot2) return

      const fieldKey = btn.getAttribute('data-pilot-issue-field') ?? ''
      const target   = findFieldElement(fieldKey)
      if (!target) { clearWire2(); return }

      const a  = btn.getBoundingClientRect()
      const b  = target.getBoundingClientRect()
      const x1 = a.left  - 2,  y1 = a.top + a.height / 2
      const x2 = b.right + 2,  y2 = b.top + b.height / 2

      if (
        Math.abs(x1 - x2) < 20 ||
        y1 < -40 || y1 > window.innerHeight + 40 ||
        y2 < -40 || y2 > window.innerHeight + 40
      ) {
        clearWire2()
        return
      }

      const midX = (x1 + x2) / 2
      const d = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`
      path.setAttribute('d', d)
      glow.setAttribute('d', d)
      dot1.setAttribute('cx', `${x1}`)
      dot1.setAttribute('cy', `${y1}`)
      dot2.setAttribute('cx', `${x2}`)
      dot2.setAttribute('cy', `${y2}`)

      const isErr = btn.getAttribute('data-pilot-issue-sev') === 'e'
      dot2.setAttribute('fill', isErr ? '#f43f5e' : '#f59e0b')
      glow.setAttribute('stroke', isErr ? '#f43f5e' : '#f59e0b')

      if (!w2Visible.current) { w2Visible.current = true; applyClasses() }
    }

    // ── Wire 2: refresh on scroll/resize ─────────────────────────────
    // Find the currently hovered issue row and redraw. If none, clear.
    function refreshWire2() {
      const btn = document.querySelector('[data-pilot-issue-field]:hover')
      if (btn) drawIssueWire(btn)
      else clearWire2()
    }

    // Both wires: schedule recompute, also refresh issue wire
    function scheduleAll() {
      schedule()
      refreshWire2()
    }

    // ── Draw-in animation ────────────────────────────────────────────
    let prevKey = ''
    function triggerDrawIn() {
      const svg = svgRef.current
      if (!svg) return
      svg.classList.add('fx-tether--drawing')
      if (drawTimer.current) clearTimeout(drawTimer.current)
      drawTimer.current = window.setTimeout(() => {
        svg.classList.remove('fx-tether--drawing')
      }, 450)
    }

    // ── Listeners ────────────────────────────────────────────────────
    function onFocusIn(e) {
      const t = e.target
      if (!(t instanceof HTMLElement)) return
      if (!(t.matches('input, select, textarea') || t.hasAttribute('data-pilot-field'))) return
      const key = t.id || t.getAttribute('data-pilot-field') || t.getAttribute('name') || ''
      focusedEl.current = t
      if (key && key !== prevKey) triggerDrawIn()
      prevKey = key
      schedule()
    }

    function onFocusOut() {
      setTimeout(() => {
        const a = document.activeElement
        if (
          a instanceof HTMLElement &&
          (a.matches('input, select, textarea') || a.hasAttribute('data-pilot-field'))
        ) return
        focusedEl.current = null
        prevKey = ''
        clearWire1()
      }, 80)
    }

    function onInput() {
      typing.current = true
      clearWire1()
      if (typingTimer.current) clearTimeout(typingTimer.current)
      typingTimer.current = window.setTimeout(() => {
        typing.current = false
        schedule()
      }, TYPING_PAUSE_MS)
    }

    function onMouseOver(e) {
      if (!(e.target instanceof HTMLElement)) return
      const btn = e.target.closest('[data-pilot-issue-field]')
      if (btn) drawIssueWire(btn)
    }

    function onMouseOut(e) {
      if (!(e.target instanceof HTMLElement)) return
      const btn = e.target.closest('[data-pilot-issue-field]')
      if (!btn) return
      setTimeout(() => {
        if (!document.querySelector('[data-pilot-issue-field]:hover')) {
          clearWire2()
        }
      }, 60)
    }

    // Scroll/resize: update both wires
    function onScroll() { schedule(); refreshWire2() }
    function onResize() { scheduleAll() }

    // Mutation: XML active line changed → recompute wire 1
    const mo = new MutationObserver(schedule)
    mo.observe(document.body, {
      attributes: true,
      attributeFilter: ['data-active-xml-line'],
      subtree: true,
    })

    document.addEventListener('focusin',   onFocusIn)
    document.addEventListener('focusout',  onFocusOut)
    document.addEventListener('input',     onInput,     true)
    document.addEventListener('mouseover', onMouseOver, true)
    document.addEventListener('mouseout',  onMouseOut,  true)
    window.addEventListener('scroll',      onScroll,    true)
    window.addEventListener('resize',      onResize)

    return () => {
      document.removeEventListener('focusin',   onFocusIn)
      document.removeEventListener('focusout',  onFocusOut)
      document.removeEventListener('input',     onInput,     true)
      document.removeEventListener('mouseover', onMouseOver, true)
      document.removeEventListener('mouseout',  onMouseOut,  true)
      window.removeEventListener('scroll',      onScroll,    true)
      window.removeEventListener('resize',      onResize)
      mo.disconnect()
      if (rafId.current)      cancelAnimationFrame(rafId.current)
      if (typingTimer.current) clearTimeout(typingTimer.current)
      if (drawTimer.current)   clearTimeout(drawTimer.current)
    }
  }, [])

  return (
    <svg
      ref={svgRef}
      className="fx-tether"
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 40 }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id="fx-tether-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#22d3ee" stopOpacity="0.95" />
          <stop offset="60%"  stopColor="#a855f7" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#22d3ee" stopOpacity="0.95" />
        </linearGradient>
        <linearGradient id="fx-tether-issue-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#f43f5e" stopOpacity="0.9"  />
          <stop offset="55%"  stopColor="#f59e0b" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.9"  />
        </linearGradient>
        <filter id="fx-tether-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        <filter id="fx-tether-issue-blur" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
      </defs>

      {/* Wire 1: focused field → active XML line */}
      <path ref={w1Glow} className="fx-tether__glow"
        d="" fill="none" stroke="#22d3ee"
        strokeWidth="6" strokeOpacity="0.35"
        filter="url(#fx-tether-blur)" pathLength="1" />
      <path ref={w1Path} className="fx-tether__line"
        d="" fill="none" stroke="url(#fx-tether-grad)"
        strokeWidth="1.4" strokeDasharray="6 6" pathLength="1" />
      <circle ref={w1Dot1} className="fx-tether__dot"                           r="3.2" fill="#22d3ee" />
      <circle ref={w1Dot2} className="fx-tether__dot fx-tether__dot--end"       r="3.2" fill="#a855f7" />

      {/* Wire 2: hovered issue row → form field */}
      <path ref={w2Glow} className="fx-tether__issue-glow"
        d="" fill="none" stroke="#f59e0b"
        strokeWidth="7" strokeOpacity="0.28"
        filter="url(#fx-tether-issue-blur)" pathLength="1" />
      <path ref={w2Path} className="fx-tether__issue-line"
        d="" fill="none" stroke="url(#fx-tether-issue-grad)"
        strokeWidth="1.6" strokeDasharray="5 4" pathLength="1" />
      <circle ref={w2Dot1} className="fx-tether__issue-dot"                             r="3"   fill="#f59e0b" />
      <circle ref={w2Dot2} className="fx-tether__issue-dot fx-tether__issue-dot--end"   r="3.4" fill="#f43f5e" />
    </svg>
  )
}
