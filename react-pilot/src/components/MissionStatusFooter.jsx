import { memo, useEffect, useState } from 'react'

/**
 * Mission-control style HUD footer.
 *
 * - Left:   status LED + SYSTEMS label (cyan when saved, magenta when dirty)
 * - Middle: live UTC timestamp + session uptime (mm:ss)
 * - Right:  version chip + persistence pill
 *
 * Isolated in its own component so the once-a-second clock tick re-renders
 * *only* the footer — the wizard, validator, and XML preview stay idle.
 */
function MissionStatusFooter({ isDirty, appVersion }) {
  const [now, setNow] = useState(() => Date.now())
  const [mountedAt] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const d = new Date(now)
  const hh = String(d.getUTCHours()).padStart(2, '0')
  const mm = String(d.getUTCMinutes()).padStart(2, '0')
  const ss = String(d.getUTCSeconds()).padStart(2, '0')
  const utcTime = `${hh}:${mm}:${ss}Z`

  const elapsed = Math.max(0, Math.floor((now - mountedAt) / 1000))
  const upMin = String(Math.floor(elapsed / 60)).padStart(2, '0')
  const upSec = String(elapsed % 60).padStart(2, '0')
  const uptime = `${upMin}:${upSec}`

  const statusText = isDirty ? 'UNSAVED' : 'NOMINAL'
  const statusMod = isDirty ? 'mission-footer__status--dirty' : 'mission-footer__status--ok'

  return (
    <footer className="pilot-app-footer mission-footer" role="contentinfo">
      {/* Left: system LED + label */}
      <div className="mission-footer__cluster mission-footer__cluster--left">
        <span className={`mission-footer__led ${statusMod}`} aria-hidden="true" />
        <span className="mission-footer__label">SYSTEMS</span>
        <span className={`mission-footer__state ${statusMod}`}>{statusText}</span>
      </div>

      {/* Spine: animated accent line */}
      <div className="mission-footer__spine" aria-hidden="true" />

      {/* Middle: live UTC + session uptime */}
      <div className="mission-footer__cluster mission-footer__cluster--mid">
        <span className="mission-footer__meta">
          <span className="mission-footer__key">UTC</span>
          <span className="mission-footer__val mission-footer__val--clock">{utcTime}</span>
        </span>
        <span className="mission-footer__meta">
          <span className="mission-footer__key">UPTIME</span>
          <span className="mission-footer__val">{uptime}</span>
        </span>
        <span className="mission-footer__meta">
          <span className="mission-footer__key">SESSION</span>
          <span className="mission-footer__val mission-footer__val--persist">
            <span className="mission-footer__heartbeat" aria-hidden="true" />
            persisted
          </span>
        </span>
      </div>

      {/* Right: version chip */}
      <div className="mission-footer__cluster mission-footer__cluster--right">
        <span className="mission-footer__chip">
          <span className="mission-footer__chip-key">BUILD</span>
          <span className="mission-footer__chip-val">v{appVersion}</span>
        </span>
      </div>
    </footer>
  )
}

export default memo(MissionStatusFooter)
