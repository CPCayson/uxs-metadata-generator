import { useState } from 'react'
import { useCometValidator } from '../hooks/useCometValidator'

/**
 * CometValidationPanel — Tier 3 UI
 *
 * @param {{ xmlData: string }} props
 */
export function CometValidationPanel({ xmlData }) {
  const { runCometValidation, status, result, isLoading, error } = useCometValidator()
  const [showBreakdown, setShowBreakdown] = useState(false)

  const pillStyle = (s) => ({
    display: 'inline-block',
    padding: '3px 10px',
    borderRadius: '12px',
    fontFamily: 'monospace',
    fontSize: '13px',
    fontWeight: 600,
    color: '#fff',
    background:
      s === 'valid'
        ? '#2e7d32'
        : s === 'invalid'
          ? '#c62828'
          : s === 'unauthenticated'
            ? '#e65100'
            : s === 'error'
              ? '#6a1b9a'
              : '#555',
  })

  const pillLabel = () => {
    if (isLoading) return '⌛ Checking CoMET...'
    switch (status) {
      case 'valid':
        return `✓ Tier 3: CoMET Valid${result?.rubricScore != null ? ` — Score ${result.rubricScore}` : ''}`
      case 'invalid':
        return '✗ Tier 3: CoMET Errors'
      case 'unauthenticated':
        return '⚠ Tier 3: CoMET Session Expired'
      case 'error':
        return '✗ Tier 3: Proxy Error'
      default:
        return 'Tier 3: CoMET'
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '13px', padding: '6px 0 0 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={() => void runCometValidation(xmlData, { runRubric: true, runResolver: false })}
          disabled={isLoading || !xmlData?.trim()}
          style={{
            padding: '4px 14px',
            borderRadius: '6px',
            border: '1px solid #90a4ae',
            background: '#eceff1',
            cursor: isLoading ? 'wait' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          {isLoading ? 'Checking…' : 'Check with CoMET'}
        </button>

        {status !== 'idle' ? <span style={pillStyle(status)}>{pillLabel()}</span> : null}
      </div>

      {status === 'unauthenticated' ? (
        <div style={{ marginTop: '6px', color: '#e65100', fontSize: '12px' }}>
          Log in via the CoMET panel (top-right) and click &quot;Check with CoMET&quot; again.
        </div>
      ) : null}

      {status === 'error' && error ? (
        <div style={{ marginTop: '6px', color: '#6a1b9a', fontSize: '12px' }}>
          {error}
        </div>
      ) : null}

      {result && !result.isoValid && result.isoErrors?.length > 0 ? (
        <ul
          style={{
            margin: '8px 0 0 0',
            padding: '8px 12px',
            background: '#fff3f3',
            border: '1px solid #f5c6c6',
            borderRadius: '6px',
            maxHeight: '200px',
            overflowY: 'auto',
            listStyle: 'none',
            color: '#c62828',
          }}
        >
          {result.isoErrors.map((e, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>
              {typeof e === 'string' ? e : JSON.stringify(e)}
            </li>
          ))}
        </ul>
      ) : null}

      {result?.isoValid && result?.rubricScore != null ? (
        <div style={{ marginTop: '8px' }}>
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#1565c0',
              fontSize: '12px',
              padding: 0,
            }}
          >
            {showBreakdown ? '▾ Hide rubric breakdown' : '▸ Show rubric breakdown'}
          </button>

          {showBreakdown && result.rubricBreakdown ? (
            <pre
              style={{
                marginTop: '6px',
                padding: '8px',
                background: '#f5f5f5',
                borderRadius: '6px',
                fontSize: '11px',
                overflowX: 'auto',
                maxHeight: '200px',
                overflowY: 'auto',
              }}
            >
              {JSON.stringify(result.rubricBreakdown, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}

      {result?.resolverErrors?.length > 0 ? (
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#e65100' }}>
          <strong>Resolver / XLinks:</strong>
          <ul style={{ margin: '4px 0', paddingLeft: '16px' }}>
            {result.resolverErrors.map((e, i) => (
              <li key={i}>{typeof e === 'string' ? e : JSON.stringify(e)}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
