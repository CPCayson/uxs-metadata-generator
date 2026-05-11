/**
 * Inline UxS gap analysis results (CoMET detectGaps output).
 */

export function GapPanel({ gaps, onClose }) {
  if (!gaps || gaps.length === 0) {
    return (
      <div
        style={{
          padding: '0.6rem 0.85rem',
          background: '#f0fdf4',
          border: '1px solid #16a34a33',
          borderRadius: 7,
          fontSize: '0.78rem',
          fontWeight: 600,
          color: '#14532d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>✓ No UxS-specific gaps detected in current record.</span>
        <button
          type="button"
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#14532d', fontWeight: 700 }}
        >
          ✕
        </button>
      </div>
    )
  }
  return (
    <div
      style={{
        padding: '0.6rem 0.85rem',
        background: '#fff',
        border: '1px solid var(--border-color)',
        borderRadius: 7,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontSize: '0.75rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: 'var(--text-muted)',
          }}
        >
          UxS Gap Analysis · {gaps.length} item{gaps.length !== 1 ? 's' : ''}
        </span>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            fontWeight: 700,
            fontSize: '0.8rem',
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {gaps.map((g, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              gap: 7,
              alignItems: 'flex-start',
              padding: '4px 8px',
              background: '#fefce8',
              border: '1px solid #ca8a0422',
              borderRadius: 5,
            }}
          >
            <span style={{ fontSize: '0.85rem', flexShrink: 0 }}>⚠</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#713f12', lineHeight: 1.45 }}>{g}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
