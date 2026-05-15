import { useState, useRef, useEffect } from 'react'
import { useCometValidator } from '../hooks/useCometValidator'
import { loginToComet } from '../lib/cometClient.js'

const CAT_ORDER = [
  'Identification', 'Access', 'Coverage', 'Content',
  'History', 'Quality', 'Connections', 'Metadata',
  'Associated Resource', 'Attribution',
]

function scoreColor(score) {
  const pct = Number.parseFloat(String(score ?? '').replace('%', ''))
  if (Number.isNaN(pct)) return '#78909c'
  if (pct >= 80) return '#2e7d32'
  if (pct >= 50) return '#e65100'
  return '#c62828'
}

function ScoreBadge({ score, size = 'md' }) {
  const color = scoreColor(score)
  return (
    <span style={{
      display: 'inline-block',
      padding: size === 'lg' ? '4px 14px' : '2px 8px',
      borderRadius: '10px', background: color, color: '#fff',
      fontWeight: 700, fontSize: size === 'lg' ? '14px' : '12px',
      fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>
      {score ?? '—'}
    </span>
  )
}

function RubricTable({ categories }) {
  if (!Array.isArray(categories) || categories.length === 0) return null
  const sorted = CAT_ORDER.map((name) => {
    const found = categories.find((c) => String(c.name ?? '').toLowerCase() === name.toLowerCase())
    return found ?? { name, score: null, ec: null }
  })
  return (
    <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '12px', marginTop: '6px' }}>
      <tbody>
        {sorted.map(({ name, score, ec }) => (
          <tr key={name} style={{ borderBottom: '1px solid #e0e0e0' }}>
            <td style={{ padding: '3px 8px 3px 0', color: '#555', whiteSpace: 'nowrap' }}>{name}</td>
            <td style={{ padding: '3px 6px', textAlign: 'right' }}>
              <ScoreBadge score={score} />
            </td>
            {ec != null && (
              <td style={{ padding: '3px 0 3px 6px', color: '#999', textAlign: 'right', fontSize: '11px' }}>
                {ec !== '0' ? `${ec} err` : ''}
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * Compact inline login form shown when the user is not authenticated.
 * On success calls onSuccess() so the parent can retry validation immediately.
 */
function InlineCometLogin({ onSuccess }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [busy, setBusy] = useState(false)
  const [loginError, setLoginError] = useState('')
  const userRef = useRef(null)

  useEffect(() => {
    userRef.current?.focus()
  }, [])

  const handleLogin = async () => {
    if (!user.trim() || !pass.trim()) {
      setLoginError('Enter your NOAA email and password.')
      return
    }
    setBusy(true)
    setLoginError('')
    try {
      const res = await loginToComet(user.trim(), pass.trim())
      if (res.ok) {
        onSuccess()
      } else {
        setLoginError('Login failed — check your NOAA credentials.')
      }
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : 'Login error.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{
      marginTop: '8px', padding: '10px 12px', borderRadius: '8px',
      background: '#fff8e1', border: '1px solid #ffe082',
    }}>
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#e65100', marginBottom: '6px' }}>
        ⚠ CoMET session required — log in to continue
      </div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          ref={userRef}
          type="text"
          value={user}
          onChange={(e) => setUser(e.target.value)}
          placeholder="noaa.email@noaa.gov"
          autoComplete="username"
          disabled={busy}
          style={{
            flex: '2 1 160px', padding: '4px 8px', borderRadius: '4px',
            border: '1px solid #bbb', fontSize: '12px',
          }}
        />
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          disabled={busy}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleLogin() }}
          style={{
            flex: '1 1 100px', padding: '4px 8px', borderRadius: '4px',
            border: '1px solid #bbb', fontSize: '12px',
          }}
        />
        <button
          type="button"
          onClick={() => void handleLogin()}
          disabled={busy}
          style={{
            padding: '4px 12px', borderRadius: '4px', border: 'none',
            background: '#1565c0', color: '#fff', fontSize: '12px',
            fontWeight: 600, cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
          }}
        >
          {busy ? 'Logging in…' : 'Login & check'}
        </button>
      </div>
      {loginError && (
        <div style={{ color: '#c62828', fontSize: '11px', marginTop: '4px' }}>{loginError}</div>
      )}
    </div>
  )
}

/**
 * CometValidationPanel — Tier 3 CoMET preflight
 *
 * Runs ISO validate and Rubric V2 in parallel. On auth failure shows an inline
 * login form and retries automatically on success — no need to open the CoMET
 * panel in the right rail.
 *
 * @param {{ xmlData: string }} props
 */
export function CometValidationPanel({ xmlData }) {
  const { runCometValidation, status, result, isLoading, error } = useCometValidator()
  const [showErrors, setShowErrors] = useState(false)
  // Store xmlData at the time of the click so login-retry uses the same XML
  const pendingXmlRef = useRef('')

  const handleCheck = () => {
    pendingXmlRef.current = xmlData
    void runCometValidation(xmlData, { runRubric: true, runResolver: false })
  }

  // After successful login, retry with the same XML that was pending
  const handleLoginSuccess = () => {
    if (pendingXmlRef.current) {
      void runCometValidation(pendingXmlRef.current, { runRubric: true, runResolver: false })
    }
  }

  const isoErrorCount = result?.isoErrorCount ?? null
  const rubricScore = result?.rubricBreakdown?.totalScore ?? null
  const categories = result?.rubricBreakdown?.categories ?? []
  const isoErrors = result?.isoErrors ?? []

  const validateColor =
    isoErrorCount === null ? '#78909c'
    : isoErrorCount === 0 ? '#2e7d32'
    : '#c62828'

  const validateLabel =
    isLoading ? '⌛ Checking schema…'
    : isoErrorCount === 0 ? '✓ ISO Schema: 0 errors'
    : isoErrorCount != null ? `✗ ISO Schema: ${isoErrorCount} error${isoErrorCount !== 1 ? 's' : ''}`
    : status !== 'idle' ? 'ISO Schema: ?'
    : 'ISO Schema'

  const showResults = status !== 'idle' && status !== 'running' && status !== 'unauthenticated'

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '13px', padding: '6px 0 0 0' }}>

      {/* ── Action button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={handleCheck}
          disabled={isLoading || !xmlData?.trim()}
          style={{
            padding: '4px 14px', borderRadius: '6px',
            border: '1px solid #90a4ae', background: '#eceff1',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '12px', fontWeight: 600,
          }}
        >
          {isLoading ? 'Checking…' : 'Check with CoMET'}
        </button>
        {status === 'valid' && <span style={{ color: '#2e7d32', fontSize: '12px' }}>✓ Discovery-ready</span>}
        {status === 'invalid' && <span style={{ color: '#c62828', fontSize: '12px' }}>✗ Schema errors</span>}
      </div>

      {/* ── Proxy/network error (not auth) ── */}
      {status === 'error' && error && (
        <div style={{ color: '#6a1b9a', fontSize: '12px', marginBottom: '6px' }}>✗ {error}</div>
      )}

      {/* ── Inline login (shown on unauthenticated) ── */}
      {status === 'unauthenticated' && (
        <InlineCometLogin onSuccess={handleLoginSuccess} />
      )}

      {/* ── Results grid ── */}
      {showResults && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>

          {/* VALIDATE column */}
          <div style={{
            padding: '8px 10px', borderRadius: '8px',
            border: `1px solid ${validateColor}33`,
            background: `${validateColor}08`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#555', marginBottom: '4px', letterSpacing: '0.04em' }}>
              ISO SCHEMA
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: '10px',
              background: validateColor, color: '#fff', fontWeight: 700, fontSize: '12px',
            }}>
              {validateLabel}
            </span>

            {isoErrors.length > 0 && (
              <div style={{ marginTop: '6px' }}>
                <button
                  type="button"
                  onClick={() => setShowErrors((v) => !v)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontSize: '11px', padding: 0 }}
                >
                  {showErrors ? '▾ Hide errors' : `▸ ${isoErrors.length} error${isoErrors.length !== 1 ? 's' : ''}`}
                </button>
                {showErrors && (
                  <ul style={{
                    margin: '4px 0 0 0', padding: '6px 10px',
                    background: '#fff3f3', border: '1px solid #f5c6c6',
                    borderRadius: '6px', maxHeight: '120px', overflowY: 'auto',
                    listStyle: 'none', color: '#c62828', fontSize: '11px',
                  }}>
                    {isoErrors.map((e, i) => (
                      <li key={i} style={{ marginBottom: '2px' }}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* RUBRIC column */}
          <div style={{
            padding: '8px 10px', borderRadius: '8px',
            border: '1px solid #b0bec533', background: '#fafafa',
          }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#555', marginBottom: '4px', letterSpacing: '0.04em' }}>
              RUBRIC V2
            </div>
            {isLoading ? (
              <span style={{ color: '#888', fontSize: '12px' }}>⌛ Scoring…</span>
            ) : rubricScore != null ? (
              <>
                <ScoreBadge score={rubricScore} size="lg" />
                <RubricTable categories={categories} />
              </>
            ) : (
              <span style={{ color: '#999', fontSize: '12px' }}>—</span>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
