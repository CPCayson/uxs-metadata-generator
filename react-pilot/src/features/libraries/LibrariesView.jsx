import { useEffect, useMemo, useState } from 'react'

const TABS = [
  { id: 'templates', label: 'Templates' },
  { id: 'platforms', label: 'Platforms' },
  { id: 'sensors', label: 'Sensors' },
]

const EMPTY_TEMPLATE = {
  name: '',
  category: 'react-pilot',
  notes: '',
  cometUuid: '',
  cometUrl: '',
  externalRef: '',
  dataJson: '{\n  "pilot": {}\n}',
}

const EMPTY_PLATFORM = {
  id: '',
  name: '',
  type: '',
  manufacturer: '',
  model: '',
  comments: '',
  cometUuid: '',
  cometUrl: '',
  externalRef: '',
}

const EMPTY_SENSOR = {
  sensorId: '',
  type: '',
  modelId: '',
  variable: '',
  firmware: '',
  cometUuid: '',
  cometUrl: '',
  externalRef: '',
}

function safeJsonParse(text, fallback) {
  try {
    return JSON.parse(text)
  } catch {
    return fallback
  }
}

function shellCardStyle() {
  return {
    border: '1px solid var(--border-color)',
    borderRadius: 10,
    padding: '1rem',
    background: 'var(--card-bg)',
    boxShadow: 'var(--shadow-sm)',
  }
}

export default function LibrariesView({ hostBridge, onLaunch }) {
  const [tab, setTab] = useState('templates')
  const [status, setStatus] = useState('Ready')

  const [templates, setTemplates] = useState([])
  const [templatesBusy, setTemplatesBusy] = useState(false)
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE)

  const [platforms, setPlatforms] = useState([])
  const [platformsBusy, setPlatformsBusy] = useState(false)
  const [platformForm, setPlatformForm] = useState(EMPTY_PLATFORM)

  const [sensors, setSensors] = useState([])
  const [sensorsBusy, setSensorsBusy] = useState(false)
  const [sensorForm, setSensorForm] = useState(EMPTY_SENSOR)

  const hostReady = Boolean(hostBridge?.isAvailable?.())

  async function refreshTemplates() {
    if (!hostReady) return
    setTemplatesBusy(true)
    setStatus('Loading templates…')
    try {
      const res = await hostBridge.listTemplates()
      const rows = Array.isArray(res?.rows) ? res.rows : []
      setTemplates(rows)
      setStatus(`Loaded ${rows.length} template(s).`)
    } catch (err) {
      setStatus(`Templates load failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTemplatesBusy(false)
    }
  }

  async function refreshPlatforms() {
    if (!hostReady) return
    setPlatformsBusy(true)
    setStatus('Loading platforms…')
    try {
      const res = await hostBridge.listPlatforms()
      const rows = Array.isArray(res?.rows) ? res.rows : []
      setPlatforms(rows)
      setStatus(`Loaded ${rows.length} platform row(s).`)
    } catch (err) {
      setStatus(`Platforms load failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPlatformsBusy(false)
    }
  }

  async function refreshSensors() {
    if (!hostReady) return
    setSensorsBusy(true)
    setStatus('Loading sensors…')
    try {
      const res = await hostBridge.listSensors()
      const rows = Array.isArray(res?.rows) ? res.rows : []
      setSensors(rows)
      setStatus(`Loaded ${rows.length} sensor row(s).`)
    } catch (err) {
      setStatus(`Sensors load failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSensorsBusy(false)
    }
  }

  useEffect(() => {
    if (!hostReady) return
    void refreshTemplates()
    void refreshPlatforms()
    void refreshSensors()
  }, [hostReady])

  const templateOptions = useMemo(
    () =>
      templates
        .map((row) => String(row?.name || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [templates],
  )

  const templateRows = useMemo(
    () =>
      templates
        .map((row) => ({
          name: String(row?.name || '').trim(),
          category: String(row?.category || '').trim(),
          cometUuid: String(row?.data?.metadata?.cometUuid || row?.cometUuid || '').trim(),
          cometUrl: String(row?.data?.metadata?.cometUrl || row?.cometUrl || '').trim(),
          externalRef: String(row?.data?.metadata?.externalRef || row?.externalRef || '').trim(),
        }))
        .filter((row) => row.name),
    [templates],
  )

  const platformRows = useMemo(
    () =>
      platforms.map((row) => ({
        id: String(row?.id || row?.platformId || '').trim(),
        name: String(row?.name || row?.platformName || '').trim(),
        type: String(row?.type || row?.platformType || '').trim(),
        manufacturer: String(row?.manufacturer || '').trim(),
        model: String(row?.model || '').trim(),
        cometUuid: String(row?.cometUuid || '').trim(),
        cometUrl: String(row?.cometUrl || '').trim(),
        externalRef: String(row?.externalRef || '').trim(),
        raw: row,
      })),
    [platforms],
  )

  const sensorRows = useMemo(
    () =>
      sensors.map((row) => ({
        sensorId: String(row?.sensorId || row?.id || '').trim(),
        type: String(row?.type || row?.sensorType || '').trim(),
        modelId: String(row?.modelId || row?.model || '').trim(),
        variable: String(row?.variable || '').trim(),
        firmware: String(row?.firmware || '').trim(),
        cometUuid: String(row?.cometUuid || '').trim(),
        cometUrl: String(row?.cometUrl || '').trim(),
        externalRef: String(row?.externalRef || '').trim(),
        raw: row,
      })),
    [sensors],
  )

  async function loadTemplateByName(name) {
    const n = String(name || '').trim()
    if (!n) return
    setStatus(`Loading template "${n}"…`)
    try {
      const tpl = await hostBridge.loadTemplate(n)
      const data = tpl?.data && typeof tpl.data === 'object' ? tpl.data : {}
      const metadata = data?.metadata && typeof data.metadata === 'object' ? data.metadata : {}
      setTemplateForm({
        name: n,
        category: String(tpl?.category || 'react-pilot'),
        notes: String(metadata?.notes || ''),
        cometUuid: String(metadata?.cometUuid || ''),
        cometUrl: String(metadata?.cometUrl || ''),
        externalRef: String(metadata?.externalRef || ''),
        dataJson: JSON.stringify(data, null, 2),
      })
      setStatus(`Loaded template "${n}".`)
    } catch (err) {
      setStatus(`Template load failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  async function saveTemplate() {
    const name = templateForm.name.trim()
    if (!name) {
      setStatus('Template name is required.')
      return
    }
    const parsedData = safeJsonParse(templateForm.dataJson, null)
    if (!parsedData || typeof parsedData !== 'object') {
      setStatus('Template JSON is invalid.')
      return
    }
    setTemplatesBusy(true)
    setStatus(`Saving template "${name}"…`)
    try {
      const data = {
        ...parsedData,
        metadata: {
          ...(parsedData.metadata && typeof parsedData.metadata === 'object' ? parsedData.metadata : {}),
          notes: templateForm.notes.trim(),
          cometUuid: templateForm.cometUuid.trim(),
          cometUrl: templateForm.cometUrl.trim(),
          externalRef: templateForm.externalRef.trim(),
        },
      }
      await hostBridge.saveTemplate({
        name,
        category: templateForm.category.trim() || 'react-pilot',
        data,
      })
      await refreshTemplates()
      setStatus(`Template saved: ${name}`)
    } catch (err) {
      setStatus(`Template save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setTemplatesBusy(false)
    }
  }

  async function savePlatform() {
    const id = platformForm.id.trim()
    if (!id) {
      setStatus('Platform ID is required.')
      return
    }
    setPlatformsBusy(true)
    setStatus(`Saving platform "${id}"…`)
    try {
      await hostBridge.savePlatform({
        id,
        name: platformForm.name.trim() || id,
        type: platformForm.type.trim(),
        manufacturer: platformForm.manufacturer.trim(),
        model: platformForm.model.trim(),
        comments: platformForm.comments.trim(),
        cometUuid: platformForm.cometUuid.trim(),
        cometUrl: platformForm.cometUrl.trim(),
        externalRef: platformForm.externalRef.trim(),
      })
      await refreshPlatforms()
      setStatus(`Platform saved: ${id}`)
    } catch (err) {
      setStatus(`Platform save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setPlatformsBusy(false)
    }
  }

  async function saveSensor() {
    const sensorId = sensorForm.sensorId.trim()
    if (!sensorId) {
      setStatus('Sensor ID is required.')
      return
    }
    setSensorsBusy(true)
    setStatus(`Saving sensor "${sensorId}"…`)
    try {
      await hostBridge.saveSensor({
        sensorId,
        type: sensorForm.type.trim(),
        modelId: sensorForm.modelId.trim(),
        variable: sensorForm.variable.trim(),
        firmware: sensorForm.firmware.trim(),
        cometUuid: sensorForm.cometUuid.trim(),
        cometUrl: sensorForm.cometUrl.trim(),
        externalRef: sensorForm.externalRef.trim(),
      })
      await refreshSensors()
      setStatus(`Sensor saved: ${sensorId}`)
    } catch (err) {
      setStatus(`Sensor save failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSensorsBusy(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem', display: 'grid', gap: '1rem' }}>
      <div style={shellCardStyle()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, color: 'var(--primary-color)', fontSize: '1.1rem' }}>Libraries</h2>
            <p style={{ margin: '0.35rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              Internal `/api/db` catalogs with optional CoMET-linked metadata fields.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refreshTemplates()} disabled={!hostReady || templatesBusy}>
              Refresh templates
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refreshPlatforms()} disabled={!hostReady || platformsBusy}>
              Refresh platforms
            </button>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={() => void refreshSensors()} disabled={!hostReady || sensorsBusy}>
              Refresh sensors
            </button>
            {typeof onLaunch === 'function' ? (
              <button type="button" className="btn btn-sm btn-outline-primary" onClick={() => onLaunch('mission', 'underwater')}>
                Open mission wizard
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`button button-secondary${tab === t.id ? ' active' : ''}`}
            style={{
              marginTop: 0,
              borderColor: tab === t.id ? 'var(--primary-color)' : undefined,
              boxShadow: tab === t.id ? '0 0 0 2px color-mix(in srgb, var(--primary-light) 24%, transparent)' : 'none',
            }}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hostReady ? (
        <div style={shellCardStyle()}>
          <p style={{ margin: 0, color: 'var(--text-muted)' }}>
            Host bridge is not connected. Run this app behind `/api/db` (for example via `netlify dev`) to use Libraries.
          </p>
        </div>
      ) : null}

      {tab === 'templates' ? (
        <section style={{ ...shellCardStyle(), display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Template Library</h3>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Name
              <input className="form-control" value={templateForm.name} onChange={(e) => setTemplateForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Category
              <input className="form-control" value={templateForm.category} onChange={(e) => setTemplateForm((p) => ({ ...p, category: e.target.value }))} />
            </label>
            <label>
              CoMET UUID (optional)
              <input className="form-control" value={templateForm.cometUuid} onChange={(e) => setTemplateForm((p) => ({ ...p, cometUuid: e.target.value }))} />
            </label>
            <label>
              CoMET URL (optional)
              <input className="form-control" value={templateForm.cometUrl} onChange={(e) => setTemplateForm((p) => ({ ...p, cometUrl: e.target.value }))} />
            </label>
          </div>
          <label>
            External Reference (optional)
            <input className="form-control" value={templateForm.externalRef} onChange={(e) => setTemplateForm((p) => ({ ...p, externalRef: e.target.value }))} />
          </label>
          <label>
            Notes
            <textarea className="form-control" rows={2} value={templateForm.notes} onChange={(e) => setTemplateForm((p) => ({ ...p, notes: e.target.value }))} />
          </label>
          <label>
            Template Data (JSON)
            <textarea className="form-control" rows={9} value={templateForm.dataJson} onChange={(e) => setTemplateForm((p) => ({ ...p, dataJson: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" className="button" onClick={() => void saveTemplate()} disabled={templatesBusy}>Save template</button>
            <select className="form-select" style={{ maxWidth: 280 }} onChange={(e) => void loadTemplateByName(e.target.value)} defaultValue="">
              <option value="">Load existing template…</option>
              {templateOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>
            Current templates: {templates.length}
          </p>
          {templateRows.length ? (
            <div className="xml-preview-box xml-preview-box--scroll">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>CoMET UUID</th>
                    <th>External ref</th>
                  </tr>
                </thead>
                <tbody>
                  {templateRows.map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td>{row.category || '—'}</td>
                      <td>{row.cometUuid || (row.cometUrl ? 'linked URL' : '—')}</td>
                      <td>{row.externalRef || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'platforms' ? (
        <section style={{ ...shellCardStyle(), display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Platform Library</h3>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Platform ID *
              <input className="form-control" value={platformForm.id} onChange={(e) => setPlatformForm((p) => ({ ...p, id: e.target.value }))} />
            </label>
            <label>
              Name
              <input className="form-control" value={platformForm.name} onChange={(e) => setPlatformForm((p) => ({ ...p, name: e.target.value }))} />
            </label>
            <label>
              Type
              <input className="form-control" value={platformForm.type} onChange={(e) => setPlatformForm((p) => ({ ...p, type: e.target.value }))} />
            </label>
            <label>
              Manufacturer
              <input className="form-control" value={platformForm.manufacturer} onChange={(e) => setPlatformForm((p) => ({ ...p, manufacturer: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Model
              <input className="form-control" value={platformForm.model} onChange={(e) => setPlatformForm((p) => ({ ...p, model: e.target.value }))} />
            </label>
            <label>
              CoMET UUID (optional)
              <input className="form-control" value={platformForm.cometUuid} onChange={(e) => setPlatformForm((p) => ({ ...p, cometUuid: e.target.value }))} />
            </label>
            <label>
              CoMET URL (optional)
              <input className="form-control" value={platformForm.cometUrl} onChange={(e) => setPlatformForm((p) => ({ ...p, cometUrl: e.target.value }))} />
            </label>
            <label>
              External Reference (optional)
              <input className="form-control" value={platformForm.externalRef} onChange={(e) => setPlatformForm((p) => ({ ...p, externalRef: e.target.value }))} />
            </label>
          </div>
          <label>
            Comments
            <textarea className="form-control" rows={2} value={platformForm.comments} onChange={(e) => setPlatformForm((p) => ({ ...p, comments: e.target.value }))} />
          </label>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" className="button" onClick={() => void savePlatform()} disabled={platformsBusy}>Save platform</button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>Current platforms: {platforms.length}</p>
          {platformRows.length ? (
            <div className="xml-preview-box xml-preview-box--scroll">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Type</th>
                    <th>CoMET</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {platformRows.map((row, idx) => (
                    <tr key={`${row.id || 'platform'}-${idx}`}>
                      <td>{row.id || '—'}</td>
                      <td>{row.name || '—'}</td>
                      <td>{row.type || '—'}</td>
                      <td>{row.cometUuid || (row.cometUrl ? 'linked URL' : '—')}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            setPlatformForm({
                              id: row.id,
                              name: row.name,
                              type: row.type,
                              manufacturer: row.manufacturer,
                              model: row.model,
                              comments: String(row.raw?.comments || ''),
                              cometUuid: row.cometUuid,
                              cometUrl: row.cometUrl,
                              externalRef: row.externalRef,
                            })
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {tab === 'sensors' ? (
        <section style={{ ...shellCardStyle(), display: 'grid', gap: '0.75rem' }}>
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Sensor Library</h3>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Sensor ID *
              <input className="form-control" value={sensorForm.sensorId} onChange={(e) => setSensorForm((p) => ({ ...p, sensorId: e.target.value }))} />
            </label>
            <label>
              Type
              <input className="form-control" value={sensorForm.type} onChange={(e) => setSensorForm((p) => ({ ...p, type: e.target.value }))} />
            </label>
            <label>
              Model ID
              <input className="form-control" value={sensorForm.modelId} onChange={(e) => setSensorForm((p) => ({ ...p, modelId: e.target.value }))} />
            </label>
            <label>
              Variable
              <input className="form-control" value={sensorForm.variable} onChange={(e) => setSensorForm((p) => ({ ...p, variable: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'grid', gap: '0.5rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <label>
              Firmware
              <input className="form-control" value={sensorForm.firmware} onChange={(e) => setSensorForm((p) => ({ ...p, firmware: e.target.value }))} />
            </label>
            <label>
              CoMET UUID (optional)
              <input className="form-control" value={sensorForm.cometUuid} onChange={(e) => setSensorForm((p) => ({ ...p, cometUuid: e.target.value }))} />
            </label>
            <label>
              CoMET URL (optional)
              <input className="form-control" value={sensorForm.cometUrl} onChange={(e) => setSensorForm((p) => ({ ...p, cometUrl: e.target.value }))} />
            </label>
            <label>
              External Reference (optional)
              <input className="form-control" value={sensorForm.externalRef} onChange={(e) => setSensorForm((p) => ({ ...p, externalRef: e.target.value }))} />
            </label>
          </div>
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
            <button type="button" className="button" onClick={() => void saveSensor()} disabled={sensorsBusy}>Save sensor</button>
          </div>
          <p className="hint" style={{ marginTop: 0 }}>Current sensors: {sensors.length}</p>
          {sensorRows.length ? (
            <div className="xml-preview-box xml-preview-box--scroll">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Type</th>
                    <th>Model</th>
                    <th>Variable</th>
                    <th>CoMET</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {sensorRows.map((row, idx) => (
                    <tr key={`${row.sensorId || 'sensor'}-${idx}`}>
                      <td>{row.sensorId || '—'}</td>
                      <td>{row.type || '—'}</td>
                      <td>{row.modelId || '—'}</td>
                      <td>{row.variable || '—'}</td>
                      <td>{row.cometUuid || (row.cometUrl ? 'linked URL' : '—')}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() =>
                            setSensorForm({
                              sensorId: row.sensorId,
                              type: row.type,
                              modelId: row.modelId,
                              variable: row.variable,
                              firmware: row.firmware,
                              cometUuid: row.cometUuid,
                              cometUrl: row.cometUrl,
                              externalRef: row.externalRef,
                            })
                          }
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      <div style={shellCardStyle()}>
        <p className="status-message" role="status" aria-live="polite">{status}</p>
      </div>
    </div>
  )
}
