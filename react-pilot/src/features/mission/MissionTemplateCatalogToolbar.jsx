import { useState } from 'react'
import FieldHintTooltip from '../../components/FieldHintTooltip.jsx'

/**
 * Compact mission-step template picker — lives in the lab step header (not a full-width panel).
 *
 * @param {{
 *   hostBridgeReady?: boolean,
 *   templateCatalogRows?: Array<{ key: string, name: string, category?: string }>,
 *   templateCatalogLoading?: boolean,
 *   templateCatalogError?: string,
 *   onRefreshTemplateCatalog?: () => void,
 *   onApplySheetTemplate?: (key: string) => void,
 *   templateApplyDisabled?: boolean,
 * }} props
 */
export default function MissionTemplateCatalogToolbar({
  hostBridgeReady = false,
  templateCatalogRows = [],
  templateCatalogLoading = false,
  templateCatalogError = '',
  onRefreshTemplateCatalog,
  onApplySheetTemplate,
  templateApplyDisabled = false,
}) {
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('')

  return (
    <div
      className="mission-template-toolbar"
      role="group"
      aria-label="Mission template from catalog"
    >
      <span className="mission-template-toolbar__label">Template</span>
      <select
        className="form-control form-select mission-template-toolbar__select"
        value={selectedTemplateKey}
        disabled={!hostBridgeReady || templateCatalogLoading}
        onChange={(e) => setSelectedTemplateKey(e.target.value)}
        title={templateCatalogError || undefined}
        aria-invalid={templateCatalogError ? true : undefined}
      >
        <option value="">Select…</option>
        {templateCatalogRows.map(({ key, name, category }) => {
          const cat = String(category || '').trim()
          const label = cat ? `${name} (${cat})` : name
          return (
            <option key={key} value={key}>
              {label}
            </option>
          )
        })}
      </select>
      <button
        type="button"
        className="button button-secondary button-tiny mission-template-toolbar__btn"
        disabled={!hostBridgeReady || templateCatalogLoading}
        onClick={() => onRefreshTemplateCatalog?.()}
        title="Reload template list from catalog"
        aria-label="Refresh template catalog"
      >
        {templateCatalogLoading ? '…' : '↻'}
      </button>
      <button
        type="button"
        className="button button-tiny mission-template-toolbar__btn mission-template-toolbar__apply"
        disabled={templateApplyDisabled || templateCatalogLoading || !selectedTemplateKey}
        onClick={() => onApplySheetTemplate?.(selectedTemplateKey)}
      >
        Apply
      </button>
      <FieldHintTooltip ariaLabel="About mission templates">
        <>
          Load a named template from Postgres via <code>/api/db</code>. The list loads when you open Mission; use ↻ after
          catalog edits.
          {!hostBridgeReady && import.meta.env.DEV && typeof window !== 'undefined' && window.location.port === '5173' ? (
            <>
              {' '}
              Plain Vite (5173) has no <code>/api/db</code> — use <code>npm run dev</code> on port 8888.
            </>
          ) : null}
        </>
      </FieldHintTooltip>
    </div>
  )
}
