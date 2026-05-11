import OneStopCatalogStrip from './OneStopCatalogStrip.jsx'
import { BatchLanesPanel } from './BatchLanesPanel.jsx'

/**
 * Compact reports strip for embedding in Record Studio (catalog strip + batch lanes).
 * Full Command Center remains on the dashboard route for the wide layout.
 */
export default function RecordStudioReports() {
  return (
    <section aria-label="Reports and audit lanes" style={{ display: 'grid', gap: '1rem' }}>
      <OneStopCatalogStrip />
      <BatchLanesPanel />
    </section>
  )
}
