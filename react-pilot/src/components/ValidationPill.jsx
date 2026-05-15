import { usePreviewNoaaSchemaValidation } from '../hooks/usePreviewNoaaSchemaValidation.js'

export function ValidationPill({ xmlData }) {
  const { status, errors, isLoading } = usePreviewNoaaSchemaValidation(xmlData)

  const pillColor = isLoading ? '#888' : status === 'valid' ? '#2e7d32' : status === 'error' ? '#c62828' : '#555'
  const pillLabel = isLoading
    ? '⌛ Validating...'
    : status === 'valid'
      ? '✓ Tier 2: Valid NOAA XML'
      : status === 'error'
        ? '✗ Tier 2: Schema Error'
        : 'Tier 2: Idle'

  return (
    <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>
      <div
        style={{
          display: 'inline-block',
          padding: '3px 10px',
          borderRadius: '12px',
          background: pillColor,
          color: '#fff',
          fontWeight: 600,
          marginBottom: errors.length ? '8px' : 0,
        }}
      >
        {pillLabel}
      </div>

      {errors.length > 0 ? (
        <ul
          style={{
            margin: '6px 0 0 0',
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
          {errors.map((err, i) => (
            <li key={i} style={{ marginBottom: '4px' }}>
              {err}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
