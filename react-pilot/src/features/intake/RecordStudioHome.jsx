/**
 * Record Studio — default SaaS surface: intake + optional embedded archive, libraries, reports.
 */
import { useState } from 'react'

import IntakeScreen from './IntakeScreen.jsx'
import ArchiveInventoryView from '../archive/ArchiveInventoryView.jsx'
import LibrariesView from '../libraries/LibrariesView.jsx'
import RecordStudioReports from '../dashboard/RecordStudioReports.jsx'

const ACCENT = '#534AB7'

function toggleTileStyle(active) {
  return {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '0.6rem 0.85rem',
    border: `1px solid ${active ? ACCENT : 'var(--border-color, #e2e8f0)'}`,
    borderRadius: 7,
    background: active ? 'rgba(83, 74, 183, 0.06)' : 'var(--card-bg, #fff)',
    cursor: 'pointer',
    textAlign: 'left',
    boxShadow: active ? `inset 0 0 0 1px ${ACCENT}33` : 'none',
    minWidth: 0,
  }
}

export default function RecordStudioHome({ onLaunch, onOpenArchiveRecord, hostBridge }) {
  const [showArchive, setShowArchive] = useState(false)
  const [showLibrary, setShowLibrary] = useState(false)
  const [showReports, setShowReports] = useState(false)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <IntakeScreen onLaunch={onLaunch} />

      <div>
        <div
          style={{
            position: 'relative',
            textAlign: 'center',
            fontSize: '0.72rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: 'var(--text-muted)',
            margin: '0 0 10px',
          }}
        >
          <span
            style={{
              background: 'var(--color-background-primary, #fff)',
              padding: '0 10px',
              position: 'relative',
              zIndex: 1,
            }}
          >
            Also in this workspace
          </span>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '0.5px',
              background: 'var(--border-color, #e2e8f0)',
              zIndex: 0,
            }}
          />
        </div>

        <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.55rem' }}>
          Show panels
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          <button
            type="button"
            aria-expanded={showArchive}
            onClick={() => setShowArchive((v) => !v)}
            style={toggleTileStyle(showArchive)}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: showArchive ? ACCENT : 'var(--text-color, #0f172a)' }}>
              Demo records
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
              Bundled XML fixtures
            </span>
          </button>
          <button
            type="button"
            aria-expanded={showLibrary}
            onClick={() => setShowLibrary((v) => !v)}
            style={toggleTileStyle(showLibrary)}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: showLibrary ? ACCENT : 'var(--text-color, #0f172a)' }}>
              Libraries
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
              Templates · platforms · sensors
            </span>
          </button>
          <button
            type="button"
            aria-expanded={showReports}
            onClick={() => setShowReports((v) => !v)}
            style={toggleTileStyle(showReports)}
          >
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: showReports ? ACCENT : 'var(--text-color, #0f172a)' }}>
              Reports
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
              Catalog strip · batch lanes
            </span>
          </button>
        </div>
      </div>

      {showArchive ? (
        <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '1.25rem' }}>
          <ArchiveInventoryView onOpenRecord={onOpenArchiveRecord} />
        </div>
      ) : null}

      {showLibrary ? (
        <div style={{ borderTop: '1px solid var(--border-color, #e2e8f0)', paddingTop: '1.25rem' }}>
          <LibrariesView hostBridge={hostBridge} onLaunch={onLaunch} />
        </div>
      ) : null}

      {showReports ? (
        <div
          style={{
            borderTop: '1px solid var(--border-color, #e2e8f0)',
            paddingTop: '1.25rem',
          }}
        >
          <RecordStudioReports />
        </div>
      ) : null}
    </div>
  )
}
