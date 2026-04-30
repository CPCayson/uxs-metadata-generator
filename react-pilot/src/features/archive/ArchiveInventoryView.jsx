/**
 * ArchiveInventoryView — seam component for next implementation slice.
 * Keeps route-level UX in place while inventory query + record launch APIs
 * are wired in follow-up work.
 */
export default function ArchiveInventoryView({ onOpenRecord }) {
  return (
    <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Archive Inventory</h2>
        <p className="card-intro">
          Search and relaunch archived records. This view is staged for the next build and already reserves the route/API seam.
        </p>
        <div style={{ display: 'grid', gap: '0.5rem', maxWidth: 520 }}>
          <label htmlFor="archive-inventory-search">Record search</label>
          <input
            id="archive-inventory-search"
            className="form-control"
            placeholder="Search by UUID, title, file ID, accession…"
            disabled
          />
          <div className="hint" style={{ marginTop: 0 }}>
            Inventory query endpoint and table wiring are next. Launch handler seam is ready through `onOpenRecord`.
          </div>
          {typeof onOpenRecord === 'function' ? (
            <button
              type="button"
              className="button button-secondary"
              onClick={() => onOpenRecord({ source: 'archive-seam' })}
            >
              Test launch seam
            </button>
          ) : null}
        </div>
      </section>
    </div>
  )
}
