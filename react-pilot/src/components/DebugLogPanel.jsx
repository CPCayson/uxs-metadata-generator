import { useEffect, useState } from 'react'
import { pilotDebugEnabled, subscribePilotDebug } from '../lib/pilotDebugLog'

export default function DebugLogPanel() {
  const [rows, setRows] = useState(() => [])
  const on = pilotDebugEnabled()

  useEffect(() => {
    if (!on) return undefined
    return subscribePilotDebug(setRows)
  }, [on])

  if (!on) return null

  return (
    <section className="pilot-debug-log card" aria-label="Client debug log">
      <h2 className="pilot-debug-log__title">Debug log (?debug=1)</h2>
      <ul className="pilot-debug-log__list">
        {rows.length ? (
          rows
            .slice()
            .reverse()
            .map((r, i) => (
              <li key={`${r.t}-${i}`}>
                <span className="pilot-debug-log__time">{new Date(r.t).toLocaleTimeString()}</span>{' '}
                <span className="pilot-debug-log__kind">{r.kind}</span>
                {typeof r.ok === 'boolean' ? (
                  <span className={r.ok ? 'pilot-debug-log__ok' : 'pilot-debug-log__fail'}>{r.ok ? ' ok' : ' fail'}</span>
                ) : null}
                {r.detail ? <span className="pilot-debug-log__detail"> — {r.detail}</span> : null}
              </li>
            ))
        ) : (
          <li className="hint">No events yet (save draft, bridge check, etc.).</li>
        )}
      </ul>
    </section>
  )
}
