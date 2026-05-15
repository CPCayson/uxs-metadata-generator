import { useState } from 'react'
import { useCometValidator } from '../hooks/useCometValidator'

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
  const pad = size === 'lg' ? '4px 14px' : '2px 8px'
  const fs = size === 'lg' ? '14px' : '12px'
  return (
    <span style={{
      display: 'inline-block', padding: pad, borderRadius: '10px',
      background: color, color: '#fff', fontWeight: 700,
      fontSize: fs, fontFamily: 'monospace', whiteSpace: 'nowrap',
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
 * CometValidationPanel — Tier 3 CoMET preflight
 *
 * Runs ISO validate and Rubric V2 in parallel. Both execute on click so the user
 * always sees a rubric score regardless of whether schema validation passes.
 *
 * @param {{ xmlData: string }} props
 */
export function CometValidationPanel({ xmlData }) {
  const { runCometValidation, status, result, isLoading, error } = useCometValidator()
  const [showErrors, setShowErrors] = useState(false)

  const isoValid = result?.isoValid
  const isoErrorCount = result?.isoErrorCount ?? null
  const rubricScore = result?.rubricBreakdown?.totalScore ?? null
  const categories = result?.rubricBreakdown?.categories ?? []
  const isoErrors = result?.isoErrors ?? []

  const validateColor =
    isoErrorCount === null ? '#78909c'
    : isoErrorCount === 0 ? '#2e7d32'
    : '#c62828'

  const validateLabel =
    isLoading ? '⌛ ISO schema…'
    : isoErrorCount === null && status !== 'idle' ? 'ISO Schema: ?'
    : isoErrorCount === 0 ? `✓ ISO Schema: 0 errors`
    : isoErrorCount != null ? `✗ ISO Schema: ${isoErrorCount} error${isoErrorCount !== 1 ? 's' : ''}`
    : 'ISO Schema'

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '13px', padding: '6px 0 0 0' }}>

      {/* ── Action button ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <button
          type="button"
          onClick={() => void runCometValidation(xmlData, { runRubric: true, runResolver: false })}
          disabled={isLoading || !xmlData?.trim()}
          style={{
            padding: '4px 14px', borderRadius: '6px',
            border: '1px solid #90a4ae', background: '#eceff1',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '12px', fontWeight: 600,
          }}
        >
          {isLoading ? 'Checking CoMET…' : 'Check with CoMET'}
        </button>
      </div>

      {/* ── Auth error ── */}
      {status === 'unauthenticated' && (
        <div style={{ color: '#e65100', fontSize: '12px', marginBottom: '6px' }}>
          ⚠ Session expired. Log in via the CoMET panel or configure{' '}
          <code>COMET_USER</code> + <code>COMET_PASS</code> on the server.
        </div>
      )}

      {/* ── Proxy/network error ── */}
      {status === 'error' && error && (
        <div style={{ color: '#6a1b9a', fontSize: '12px', marginBottom: '6px' }}>✗ {error}</div>
      )}

      {/* ── Results grid ── */}
      {(status !== 'idle' && status !== 'running') && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

          {/* VALIDATE */}
          <div style={{
            padding: '8px 10px', borderRadius: '8px',
            border: `1px solid ${validateColor}22`,
            background: `${validateColor}08`,
          }}>
            <div style={{ fontWeight: 700, fontSize: '11px', color: '#555', marginBottom: '4px', letterSpacing: '0.04em' }}>
              ISO SCHEMA
            </div>
            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: '10px',
              background: validateColor, color: '#fff',
              fontWeight: 700, fontSize: '13px',
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
                  {showErrors ? '▾ Hide errors' : `▸ Show ${isoErrors.length} error${isoErrors.length !== 1 ? 's' : ''}`}
                </button>
                {showErrors && (
                  <ul style={{
                    margin: '4px 0 0 0', padding: '6px 10px',
                    background: '#fff3f3', border: '1px solid #f5c6c6',
                    borderRadius: '6px', maxHeight: '120px', overflowY: 'auto',
                    listStyle: 'none', color: '#c62828', fontSize: '11px',
                  }}>
                    {isoErrors.map((e, i) => <li key={i} style={{ marginBottom: '2px' }}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* RUBRIC */}
          <div style={{
            padding: '8px 10px', borderRadius: '8px',
            border: '1px solid #b0bec522',
            background: '#fafafa',
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
              <span style={{ color: '#999', fontSize: '12px' }}>
                {isoValid === false ? 'Run after fixing schema errors' : '—'}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
