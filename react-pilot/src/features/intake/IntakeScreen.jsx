/**
 * IntakeScreen — universal drop zone + classifier for new record intake.
 *
 * Props:
 *   onLaunch(profileId, platformHint, prefillData?) — called when user confirms
 */

import { useState, useCallback, useRef } from 'react'
import { classifyInput } from './intakeClassifier.js'
import { validateMissionListCsv } from '../../lib/missionListValidatorClient.js'

// ── Manual profile grid config ────────────────────────────────────────────────

const PROFILE_GRID = [
  [
    { profileId: 'mission', platformHint: 'underwater', label: 'UxS Mission PED',       sub: 'Uncrewed underwater · AUV / UUV' },
    { profileId: 'mission', platformHint: 'surface',    label: 'SUMD / Surface Mission', sub: 'Uncrewed surface · USV / Saildrone' },
  ],
  [
    { profileId: 'oerDashboard', platformHint: null, label: 'OER/BEDI Workbench', sub: 'OER pipeline + BEDI launch actions' },
    { profileId: 'nofo',         platformHint: null, label: 'NOFO Closeout',  sub: 'Grant closeout · DISP / DMP', comingSoon: true },
  ],
  [
    { profileId: 'bediGranule',    platformHint: null, label: 'BEDI Granule',    sub: 'Video segment · WoRMS / SeaTube' },
    { profileId: 'bediCollection', platformHint: null, label: 'BEDI Collection', sub: 'Field session · benthic collection' },
  ],
  [
    { profileId: 'collection', platformHint: null, label: 'Collection record', sub: 'ISO 19115-1 · dataset / archive' },
    null,
  ],
]

const PROFILE_COLORS = {
  mission:        '#534AB7',
  oerDashboard:   '#1D9E75',
  nofo:           '#BA7517',
  bediGranule:    '#D85A30',
  bediCollection: '#D85A30',
  collection:     '#185FA5',
}

// ── Classification result card ────────────────────────────────────────────────

function ClassifyCard({ result, onLaunch }) {
  const color = PROFILE_COLORS[result.profileId] ?? '#64748b'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.75rem 1rem',
      border: `1.5px solid ${color}`,
      borderRadius: 8,
      background: 'var(--card-bg, #fff)',
      marginTop: '0.75rem',
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: color, color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '1rem', flexShrink: 0,
      }}>
        {result.label[0].toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '0.9rem', color }}>
          {result.label}
          {result.comingSoon && (
            <span style={{
              marginLeft: 8, fontSize: '0.7rem', fontWeight: 600,
              background: '#f59e0b', color: '#fff',
              padding: '1px 6px', borderRadius: 4,
            }}>Coming soon</span>
          )}
        </div>
        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginTop: 4 }}>
          {result.confidence}% confidence · {result.fieldsNote}
        </div>
        {result.platformHint && (
          <div style={{
            display: 'inline-block', marginTop: 4,
            fontSize: '0.73rem', fontWeight: 600,
            background: '#e0f2fe', color: '#0369a1',
            padding: '1px 8px', borderRadius: 9999,
          }}>
            {result.platformHint === 'surface' ? 'Surface vehicle detected' : 'Underwater system detected'}
          </div>
        )}
      </div>
      <button
        type="button"
        disabled={result.comingSoon}
        onClick={() => onLaunch(result.profileId, result.platformHint, null)}
        style={{
          padding: '0.35rem 0.9rem',
          border: 'none',
          borderRadius: 6,
          background: result.comingSoon ? '#cbd5e1' : color,
          color: '#fff',
          fontWeight: 600,
          fontSize: '0.82rem',
          cursor: result.comingSoon ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        Open wizard →
      </button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function IntakeScreen({ onLaunch }) {
  const [pasteValue, setPasteValue] = useState('')
  const [classified, setClassified] = useState(null)
  const [dragOver, setDragOver]     = useState(false)
  const [missionListCheck, setMissionListCheck] = useState(null)
  const fileRef = useRef(null)

  const handleText = useCallback((text) => {
    setPasteValue(text)
    setClassified(classifyInput(text))
  }, [])

  const handleDrop = useCallback((e) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = String(ev.target?.result ?? '')
      handleText(text.slice(0, 4000))
      if (file.name.toLowerCase().endsWith('.csv')) {
        try {
          const result = await validateMissionListCsv({ csvText: text, filename: file.name })
          setMissionListCheck(result)
        } catch (err) {
          setMissionListCheck({
            ok: false,
            rowCount: 0,
            errorCount: 1,
            warningCount: 0,
            errors: [err instanceof Error ? err.message : String(err)],
            warnings: [],
          })
        }
      } else {
        setMissionListCheck(null)
      }
    }
    reader.readAsText(file)
  }, [handleText])

  const handleFileChange = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const text = String(ev.target?.result ?? '')
      handleText(text.slice(0, 4000))
      if (file.name.toLowerCase().endsWith('.csv')) {
        try {
          const result = await validateMissionListCsv({ csvText: text, filename: file.name })
          setMissionListCheck(result)
        } catch (err) {
          setMissionListCheck({
            ok: false,
            rowCount: 0,
            errorCount: 1,
            warningCount: 0,
            errors: [err instanceof Error ? err.message : String(err)],
            warnings: [],
          })
        }
      } else {
        setMissionListCheck(null)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [handleText])

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <h2
        style={{
          fontSize: '1.35rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          marginBottom: '0.35rem',
          color: 'var(--text-color, #0f172a)',
        }}
      >
        Start from anything
      </h2>
      <p
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          lineHeight: 1.5,
          color: 'var(--text-muted)',
          marginBottom: '1.25rem',
        }}
      >
        Drop or paste any XML, JSON, PDF, or mission doc — Manta classifies it and opens the right wizard automatically.
      </p>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        aria-label="Drop or click to upload a file"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileRef.current?.click() }}
        style={{
          border: `2px dashed ${dragOver ? '#3b82f6' : 'var(--border-color, #cbd5e1)'}`,
          borderRadius: 8,
          padding: '1.25rem',
          textAlign: 'center',
          cursor: 'pointer',
          marginBottom: '0.75rem',
          background: dragOver
            ? 'var(--drop-active-bg, #eff6ff)'
            : 'var(--intake-drop-idle-bg, rgba(248, 250, 252, 0.9))',
          transition: 'border-color 0.15s, background 0.15s',
        }}
      >
        <svg width="22" height="22" fill="none" viewBox="0 0 24 24"
          stroke="currentColor" strokeWidth={2} aria-hidden="true"
          style={{ display: 'block', margin: '0 auto 6px', color: 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8 12 3 7 8"/><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12"/>
        </svg>
        <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-color, #0f172a)' }}>
          Drop file or click to browse
        </p>
        <p
          style={{
            margin: '6px 0 0',
            fontSize: '0.78rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            lineHeight: 1.4,
          }}
        >
          ISO XML · CruisePack JSON · BEDI spreadsheet · NOFO PDF · mission report
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".xml,.json,.txt,.csv,.pdf,.md"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          aria-hidden="true"
        />
      </div>

      {/* Paste area */}
      <div
        style={{
          position: 'relative',
          textAlign: 'center',
          fontSize: '0.72rem',
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--text-muted)',
          margin: '0 0 8px',
        }}
      >
        <span style={{ background: 'var(--color-background-primary, #fff)', padding: '0 10px', position: 'relative', zIndex: 1 }}>
          or paste text / XML below
        </span>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '0.5px', background: 'var(--border-color, #e2e8f0)', zIndex: 0 }} />
      </div>
      <textarea
        className="pilot-intake-textarea"
        style={{
          width: '100%', boxSizing: 'border-box',
          padding: '0.5rem 0.75rem',
          border: '1px solid var(--border-color, #e2e8f0)',
          borderRadius: 6,
          fontSize: '0.82rem',
          fontFamily: 'monospace',
          resize: 'vertical',
          background: 'var(--input-bg, #fff)',
          color: 'inherit',
        }}
        placeholder="Paste any XML, JSON, or text — e.g. <gmi:MI_Metadata…> or cruise report text or NOFO DISP…"
        value={pasteValue}
        onChange={(e) => handleText(e.target.value)}
        rows={4}
      />

      {/* Classification result */}
      {classified && <ClassifyCard result={classified} onLaunch={onLaunch} />}
      {missionListCheck ? (
        <div
          style={{
            marginTop: '0.75rem',
            border: `1px solid ${missionListCheck.ok ? '#16a34a' : '#dc2626'}`,
            borderRadius: 8,
            padding: '0.65rem 0.8rem',
            background: missionListCheck.ok ? '#f0fdf4' : '#fef2f2',
            fontSize: '0.78rem',
          }}
          role="status"
          aria-live="polite"
        >
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Mission list CSV validation: {missionListCheck.ok ? 'PASS' : 'CHECK REQUIRED'}
          </div>
          <div>
            Rows: {missionListCheck.rowCount} · Errors: {missionListCheck.errorCount} · Warnings: {missionListCheck.warningCount}
          </div>
          {!missionListCheck.ok && missionListCheck.errors?.length ? (
            <div style={{ marginTop: 6 }}>
              {missionListCheck.errors.slice(0, 4).map((msg) => (
                <div key={msg}>- {msg}</div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Manual profile grid */}
      <div style={{ marginTop: '1.5rem' }}>
        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
          Or choose a profile directly:
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {PROFILE_GRID.map((row, ri) => (
            <div key={ri} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {row.map((item, ci) => {
                if (!item) return <div key={ci} />
                const color = PROFILE_COLORS[item.profileId] ?? '#64748b'
                return (
                  <button
                    key={ci}
                    type="button"
                    disabled={item.comingSoon}
                    onClick={() => !item.comingSoon && onLaunch(item.profileId, item.platformHint, null)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                      padding: '0.6rem 0.85rem',
                      border: `1px solid var(--border-color, #e2e8f0)`,
                      borderRadius: 7,
                      background: item.comingSoon ? 'var(--disabled-bg, #f8fafc)' : 'var(--card-bg, #fff)',
                      cursor: item.comingSoon ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      opacity: item.comingSoon ? 0.65 : 1,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: '0.85rem', color: item.comingSoon ? '#64748b' : color }}>
                      {item.label}
                      {item.comingSoon && (
                        <span style={{
                          marginLeft: 6, fontSize: '0.67rem', fontWeight: 600,
                          background: '#f59e0b', color: '#fff',
                          padding: '0px 5px', borderRadius: 4,
                        }}>soon</span>
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: 'var(--text-muted)',
                        marginTop: 4,
                        lineHeight: 1.35,
                      }}
                    >
                      {item.sub}
                    </span>
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
