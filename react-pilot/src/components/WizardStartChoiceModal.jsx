/**
 * First-run gate: start from defaults (quiet validation) or import ISO XML (must parse).
 */

import { useState, useRef } from 'react'
import { emitPilotAuditEvent } from '../lib/pilotAuditEvents.js'
import { parseProfileXmlImport } from '../lib/parseProfileXmlImport.js'

/**
 * @param {{
 *   profile: import('../core/registry/types.js').EntityProfile,
 *   onStartFresh: () => void,
 *   onPilotImportMerged: (merged: object, meta?: { importWarnings?: string[] }) => void,
 *   onStatus?: (msg: string) => void,
 *   onImportSampleRecorded?: (detail: { rawXml: string, filename?: string, warnings?: string[] }) => void,
 * }} props
 */
export default function WizardStartChoiceModal({
  profile,
  onStartFresh,
  onPilotImportMerged,
  onStatus,
  onImportSampleRecorded,
}) {
  const [phase, setPhase] = useState(/** @type {'pick' | 'import'} */ ('pick'))
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  const metaRef = useRef(/** @type {Record<string, unknown>} */ ({}))
  const fileRef = useRef(/** @type {HTMLInputElement | null} */ (null))

  const canImport = Array.isArray(profile.importParsers) && profile.importParsers.length > 0

  function handleFresh() {
    onStartFresh()
  }

  function applyXml() {
    if (!canImport) return
    const raw = String(importText || '').trim()
    if (!raw) {
      setImportError('Paste XML or choose a file first.')
      return
    }
    setImportError('')
    setImportBusy(true)
    try {
      const out = parseProfileXmlImport(profile, raw, metaRef.current || {})
      if (!out.ok) {
        setImportError(out.error || 'Could not parse this XML for this profile.')
        onStatus?.(out.error || 'Import failed.')
        return
      }
      emitPilotAuditEvent({
        profileId: profile.id,
        action: 'pilotImport',
        result: 'ok',
        sourceType: out.provenance?.sourceType ?? 'unknown',
        originalFilename: metaRef.current?.originalFilename || null,
      })
      onImportSampleRecorded?.({
        rawXml: raw,
        filename: typeof metaRef.current?.originalFilename === 'string' ? metaRef.current.originalFilename : undefined,
        warnings: out.warnings,
      })
      onPilotImportMerged(out.merged, { importWarnings: out.warnings })
    } finally {
      setImportBusy(false)
    }
  }

  function onFilePick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setImportError('')
    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xml')) {
      setImportError('Choose a .xml file here, or use the header “Import” tool for zip bundles.')
      return
    }
    metaRef.current = { originalFilename: file.name }
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : ''
      setImportText(text)
      onStatus?.(`Loaded ${file.name} (${text.length} chars).`)
    }
    reader.onerror = () => setImportError('Could not read that file.')
    reader.readAsText(file, 'UTF-8')
  }

  return (
    <div
      className="wizard-start-choice-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div
        className="wizard-start-choice-panel"
        style={{
          borderRadius: 12,
          boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
          width: '100%',
          maxWidth: 520,
          padding: '1.25rem 1.35rem',
        }}
      >
        <h2 className="wizard-start-choice__title">
          How do you want to start?
        </h2>
        <p className="wizard-start-choice__lede">
          <strong className="wizard-start-choice__profile-label">{profile.label ?? profile.id}</strong>
          {phase === 'pick'
            ? ' — pick a blank workflow (field errors stay hidden until you edit) or load metadata from an ISO XML file (must parse successfully).'
            : ' — paste XML or choose a single .xml file. For zip archives, use Import in the header after closing this dialog.'}
        </p>

        {phase === 'pick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              type="button"
              onClick={handleFresh}
              style={{
                padding: '0.65rem 1rem',
                borderRadius: 8,
                border: '1px solid rgba(34, 211, 238, 0.35)',
                background: 'rgba(34, 211, 238, 0.12)',
                color: '#e0f2fe',
                fontWeight: 700,
                fontSize: '0.88rem',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              Start fresh
              <span style={{ display: 'block', fontWeight: 500, fontSize: '0.72rem', marginTop: 4, opacity: 0.9 }}>
                Continue with defaults — empty fields will not show validation errors until you change them.
              </span>
            </button>

            {canImport ? (
              <button
                type="button"
                onClick={() => { setPhase('import'); setImportError('') }}
                style={{
                  padding: '0.65rem 1rem',
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.45)',
                  background: 'rgba(245, 158, 11, 0.1)',
                  color: '#fde68a',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  textAlign: 'left',
                }}
              >
                Import ISO XML…
                <span style={{ display: 'block', fontWeight: 500, fontSize: '0.72rem', marginTop: 4, opacity: 0.9 }}>
                  Load fields from XML — the file must parse; you can review conflicts next.
                </span>
              </button>
            ) : null}
          </div>
        )}

        {phase === 'import' && canImport && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 6,
                  border: '1px solid rgba(148, 163, 184, 0.4)',
                  background: 'rgba(15, 23, 42, 0.85)',
                  color: '#e2e8f0',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                }}
              >
                Choose .xml file
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".xml,application/xml,text/xml"
                style={{ display: 'none' }}
                onChange={onFilePick}
              />
              <button
                type="button"
                onClick={() => { setPhase('pick'); setImportError('') }}
                style={{
                  padding: '0.4rem 0.75rem',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: 'rgba(148, 163, 184, 0.95)',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  marginLeft: 'auto',
                }}
              >
                ← Back
              </button>
            </div>
            <textarea
              className="form-control wizard-start-choice__textarea"
              value={importText}
              onChange={(e) => { setImportText(e.target.value); setImportError('') }}
              placeholder="Paste ISO 19115 XML here…"
              spellCheck={false}
              style={{
                width: '100%',
                minHeight: 160,
                fontSize: '0.72rem',
                fontFamily: 'ui-monospace, monospace',
                resize: 'vertical',
              }}
            />
            {importError ? (
              <p style={{ margin: 0, fontSize: '0.78rem', color: '#fca5a5', fontWeight: 600 }} role="alert">
                {importError}
              </p>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                disabled={importBusy}
                onClick={applyXml}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: 6,
                  border: 'none',
                  background: importBusy ? '#64748b' : 'var(--fx-ocean, #006994)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.82rem',
                  cursor: importBusy ? 'wait' : 'pointer',
                }}
              >
                {importBusy ? 'Parsing…' : 'Parse & load'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
