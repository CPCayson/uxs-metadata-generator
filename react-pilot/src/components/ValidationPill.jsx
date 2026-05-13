import { useState, useEffect } from 'react'
import { useNoaaValidator } from '../hooks/useNoaaValidator'

export function ValidationPill({ xmlData }) {
  const { runStrictValidation } = useNoaaValidator()
  const [status, setStatus] = useState('idle')
  const [errors, setErrors] = useState([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!xmlData?.trim()) return undefined

    const validate = async () => {
      setIsLoading(true)
      const result = await runStrictValidation(xmlData)
      setIsLoading(false)

      if (result.valid) {
        setStatus('valid')
        setErrors([])
      } else {
        setStatus('error')
        setErrors(result.errors)
      }
    }

    const timer = setTimeout(() => {
      void validate()
    }, 500)
    return () => clearTimeout(timer)
  }, [xmlData, runStrictValidation])

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
