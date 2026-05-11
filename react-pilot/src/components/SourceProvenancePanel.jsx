/**
 * SourceProvenancePanel — shows where a pilotState record's field values came
 * from (import, scanner merge, CoMET pull, etc.) and lets the user clear the
 * stamp back to "manual" without losing any field data.
 *
 * Renders nothing when sourceType is 'manual' or absent.
 */

const SOURCE_LABELS = {
  rawIso:      'Imported from ISO XML',
  comet:       'Pulled from CoMET',
  cruisepack:  'Ingested from CruisePack',
  bediXml:     'Imported from BEDI XML',
  lensScanner: 'Auto-filled by Lens scanner',
  unknown:     'Unknown source',
}

const SOURCE_ICONS = {
  rawIso:      '↓',
  comet:       '☁',
  cruisepack:  '📦',
  bediXml:     '↓',
  lensScanner: '◎',
  unknown:     '?',
}

const SOURCE_COLORS = {
  rawIso:      { bg: '#dbeafe', border: '#93c5fd', text: '#1e3a8a', badge: '#3b82f6' },
  comet:       { bg: '#f0fdf4', border: '#86efac', text: '#14532d', badge: '#22c55e' },
  cruisepack:  { bg: '#faf5ff', border: '#c4b5fd', text: '#3b0764', badge: '#8b5cf6' },
  bediXml:     { bg: '#fff7ed', border: '#fdba74', text: '#7c2d12', badge: '#f97316' },
  lensScanner: { bg: '#f0f9ff', border: '#7dd3fc', text: '#0c4a6e', badge: '#0ea5e9' },
  unknown:     { bg: '#f8fafc', border: '#cbd5e1', text: '#475569', badge: '#94a3b8' },
}

const FALLBACK_COLORS = SOURCE_COLORS.unknown

/**
 * @param {{
 *   sourceProvenance: {
 *     sourceType: string,
 *     sourceId?: string,
 *     importedAt?: string,
 *     originalFilename?: string,
 *     originalUuid?: string,
 *   } | null | undefined,
 *   onClear: () => void,
 * }} props
 */
export default function SourceProvenancePanel({ sourceProvenance, onClear }) {
  if (!sourceProvenance || !sourceProvenance.sourceType || sourceProvenance.sourceType === 'manual') {
    return null
  }

  const { sourceType, sourceId, importedAt, originalFilename, originalUuid } = sourceProvenance

  const label  = SOURCE_LABELS[sourceType]  ?? `Source: ${sourceType}`
  const icon   = SOURCE_ICONS[sourceType]   ?? '?'
  const colors = SOURCE_COLORS[sourceType]  ?? FALLBACK_COLORS

  let importedAtDisplay = ''
  if (importedAt) {
    const d = new Date(importedAt)
    importedAtDisplay = Number.isNaN(d.getTime()) ? importedAt : d.toLocaleString()
  }

  const hasDetails = sourceId || originalFilename || originalUuid || importedAtDisplay

  return (
    <div
      role="region"
      aria-label="Record provenance"
      style={{
        marginBottom: '0.75rem',
        borderRadius: 8,
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '0.45rem 0.75rem',
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 22, height: 22,
          borderRadius: '50%',
          background: colors.badge,
          color: '#fff',
          fontSize: '0.7rem',
          fontWeight: 700,
          flexShrink: 0,
          userSelect: 'none',
        }} aria-hidden="true">
          {icon}
        </span>
        <span style={{
          flex: 1,
          fontSize: '0.78rem',
          fontWeight: 700,
          color: colors.text,
        }}>
          {label}
        </span>
        <button
          type="button"
          onClick={onClear}
          title="Clear provenance stamp — field data is unchanged"
          style={{
            padding: '0.2rem 0.6rem',
            border: `1px solid ${colors.border}`,
            borderRadius: 5,
            background: 'transparent',
            color: colors.text,
            fontSize: '0.72rem',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            opacity: 0.8,
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.8' }}
        >
          Clear stamp
        </button>
      </div>

      {/* Detail row — only when at least one detail field is populated */}
      {hasDetails && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem 1.25rem',
          padding: '0.35rem 0.75rem 0.5rem',
          borderTop: `1px solid ${colors.border}`,
        }}>
          {originalFilename && (
            <ProvenanceField label="File" value={originalFilename} colors={colors} />
          )}
          {importedAtDisplay && (
            <ProvenanceField label="Imported" value={importedAtDisplay} colors={colors} />
          )}
          {sourceId && (
            <ProvenanceField label="Source ID" value={sourceId} colors={colors} mono />
          )}
          {originalUuid && (
            <ProvenanceField
              label="Original UUID"
              value={`${originalUuid.slice(0, 8)}…${originalUuid.slice(-4)}`}
              title={originalUuid}
              colors={colors}
              mono
            />
          )}
        </div>
      )}
    </div>
  )
}

function ProvenanceField({ label, value, colors, mono = false, title }) {
  return (
    <div style={{ fontSize: '0.72rem', color: colors.text }}>
      <span style={{ fontWeight: 700, opacity: 0.7 }}>{label}: </span>
      <span
        style={{ fontFamily: mono ? 'monospace' : 'inherit', fontWeight: 600 }}
        title={title}
      >
        {value}
      </span>
    </div>
  )
}
