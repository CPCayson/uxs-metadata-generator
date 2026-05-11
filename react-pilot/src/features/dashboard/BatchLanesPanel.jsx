import { useRef, useState } from 'react'

function loadBatchLanes() {
  try {
    const raw = localStorage.getItem('manta:batch-report')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function BatchStatusBadge({ status }) {
  const colors = {
    PASS: { bg: '#dcfce7', text: '#14532d', border: '#16a34a44' },
    CHECK: { bg: '#fefce8', text: '#713f12', border: '#ca8a0444' },
    BLOCK: { bg: '#fee2e2', text: '#7f1d1d', border: '#dc262644' },
  }
  const c = colors[status] ?? colors.CHECK
  return (
    <span
      style={{
        fontSize: '0.67rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        background: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        padding: '1px 7px',
        borderRadius: 4,
        display: 'inline-block',
      }}
    >
      {status}
    </span>
  )
}

/**
 * Batch lane summary from `npm run batch:report` JSON (stored in localStorage or loaded from file).
 */
export function BatchLanesPanel() {
  const [report, setReport] = useState(() => loadBatchLanes())
  const fileRef = useRef(null)

  function handleFileLoad(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        localStorage.setItem('manta:batch-report', JSON.stringify(data))
        setReport(data)
      } catch {
        /* ignore */
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  if (!report) {
    return (
      <div
        style={{
          margin: '0.75rem 0',
          padding: '0.6rem 0.85rem',
          border: '1px dashed var(--border-color, #e2e8f0)',
          borderRadius: 7,
          fontSize: '0.76rem',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span>
          Batch lane report not loaded. Run <code style={{ fontSize: '0.72rem' }}>npm run batch:report</code> then load the JSON.
        </span>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            fontSize: '0.72rem',
            fontWeight: 700,
            padding: '2px 10px',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            background: 'var(--card-bg)',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Load report
        </button>
        <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileLoad} />
      </div>
    )
  }

  const lanes = report.lanes ?? []
  const overall = report.overallStatus ?? 'CHECK'
  const overallColor = overall === 'PASS' ? '#16a34a' : overall === 'BLOCK' ? '#dc2626' : '#ca8a04'

  return (
    <div style={{ margin: '0.75rem 0' }}>
      <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileLoad} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--text-muted)',
          }}
        >
          Batch audit lanes
        </span>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: overallColor }}>
          Overall: {overall} · {report.summary?.pass ?? 0}P / {report.summary?.check ?? 0}C / {report.summary?.block ?? 0}B
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lanes.map((lane) => (
          <div
            key={lane.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 8px',
              background: 'var(--card-bg, #fff)',
              border: '1px solid var(--border-color, #e2e8f0)',
              borderRadius: 5,
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: 600,
                color: 'var(--text-color)',
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {lane.name}
            </span>
            <BatchStatusBadge status={lane.status} />
          </div>
        ))}
      </div>
      <div style={{ textAlign: 'right', marginTop: 4 }}>
        <button
          type="button"
          onClick={() => fileRef?.current?.click()}
          style={{
            fontSize: '0.67rem',
            color: 'var(--text-muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textDecoration: 'underline',
          }}
        >
          Reload report
        </button>
      </div>
    </div>
  )
}
