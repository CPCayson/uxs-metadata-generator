import { lazy, Suspense } from 'react'
import { useFieldValidation } from '../../components/fields/useFieldValidation'

const SpatialExtentMap = lazy(() => import('./SpatialExtentMap'))

/**
 * Spatial step (same scope as classic `#spatialForm`). Bounding box and vertical extent values stay on `mission.*`
 * in pilot JSON for parity with the field map; CRS, grid, trajectory, and quality use `spatial.*`.
 *
 * @param {{
 *   mission: object,
 *   spatial: object,
 *   onMissionPatch: (p: object) => void,
 *   onSpatialPatch: (p: object) => void,
 *   touched: Record<string, boolean>,
 *   onTouched: (key: string) => void,
 *   showAllErrors: boolean,
 *   issues: Array<{ field: string, message: string, severity: string }>,
 * }} props
 */
export default function StepSpatial({
  mission,
  spatial,
  onMissionPatch,
  onSpatialPatch,
  touched,
  onTouched,
  showAllErrors,
  issues,
}) {
  const { show, invalid } = useFieldValidation({ issues, touched, showAllErrors })

  return (
    <>
      <p className="card-intro">
        <strong>Where and how the data are georeferenced</strong>: bbox and vertical range on <code>mission.*</code>;
        CRS, grid, trajectory, and quality on <code>spatial.*</code>.
      </p>

      <section className="panel">
        <h3 className="panel-title">Spatial</h3>
        <p className="hint">
          Bounding box W/E/S/N, reference system, geographic description, vertical range, grid / trajectory, data
          quality.
        </p>

        <label htmlFor="referenceSystem">Reference system</label>
        <input
          id="referenceSystem"
          className="form-control"
          value={spatial.referenceSystem || ''}
          onChange={(e) => onSpatialPatch({ referenceSystem: e.target.value })}
        />

        <label htmlFor="geographicDescription">Geographic description</label>
        <textarea
          id="geographicDescription"
          rows={2}
          className="form-control"
          value={spatial.geographicDescription || ''}
          onChange={(e) => onSpatialPatch({ geographicDescription: e.target.value })}
        />

        <Suspense
          fallback={
            <div className="spatial-map-fallback" role="status">
              Loading map…
            </div>
          }
        >
          <SpatialExtentMap west={mission.west} east={mission.east} south={mission.south} north={mission.north} />
        </Suspense>

        <div className="form-row-4">
          {['west', 'east', 'south', 'north'].map((k) => (
            <div key={k}>
              <label htmlFor={k}>{k}</label>
              <input
                id={k}
                className={`form-control${invalid('mission.bbox') ? ' form-control--invalid' : ''}`}
                value={mission[k]}
                onChange={(e) => onMissionPatch({ [k]: e.target.value })}
                onBlur={() => onTouched('mission.bbox')}
              />
            </div>
          ))}
        </div>
        {show('mission.bbox') ? <p className="field-error">{show('mission.bbox')}</p> : null}

        <div className="form-row-2">
          <div>
            <label htmlFor="vmin">Vertical min</label>
            <input
              id="vmin"
              className={`form-control${invalid('mission.vmin') ? ' form-control--invalid' : ''}`}
              value={mission.vmin}
              onChange={(e) => onMissionPatch({ vmin: e.target.value })}
              onBlur={() => onTouched('mission.vmin')}
            />
            {show('mission.vmin') ? <p className="field-error">{show('mission.vmin')}</p> : null}
          </div>
          <div>
            <label htmlFor="vmax">Vertical max</label>
            <input
              id="vmax"
              className={`form-control${invalid('mission.vmax') ? ' form-control--invalid' : ''}`}
              value={mission.vmax}
              onChange={(e) => onMissionPatch({ vmax: e.target.value })}
              onBlur={() => onTouched('mission.vmax')}
            />
            {show('mission.vmax') ? <p className="field-error">{show('mission.vmax')}</p> : null}
          </div>
        </div>
        {show('mission.vertical') ? <p className="field-error">{show('mission.vertical')}</p> : null}

        <label htmlFor="verticalCrsUrl">Vertical CRS URL</label>
        <input
          id="verticalCrsUrl"
          type="url"
          className={`form-control${invalid('spatial.verticalCrsUrl') ? ' form-control--invalid' : ''}`}
          value={spatial.verticalCrsUrl || ''}
          onChange={(e) => onSpatialPatch({ verticalCrsUrl: e.target.value })}
          onBlur={() => onTouched('spatial.verticalCrsUrl')}
        />
        {show('spatial.verticalCrsUrl') ? <p className="field-error">{show('spatial.verticalCrsUrl')}</p> : null}

        <label htmlFor="dimensions">Number of dimensions (georectified)</label>
        <input
          id="dimensions"
          className="form-control"
          placeholder="e.g. 2"
          value={spatial.dimensions || ''}
          onChange={(e) => onSpatialPatch({ dimensions: e.target.value })}
        />

        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(spatial.useGridRepresentation)}
            onChange={(e) => {
              onSpatialPatch({ useGridRepresentation: e.target.checked })
              onTouched('spatial.gridRepresentation')
            }}
          />
          <span>Use grid representation (MD_GridSpatialRepresentation)</span>
        </label>
        {show('spatial.gridRepresentation') ? (
          <p className="field-error">{show('spatial.gridRepresentation')}</p>
        ) : null}

        {spatial.useGridRepresentation ? (
          <div className="spatial-grid-panel">
            <h4 className="panel-subtitle">Grid axes</h4>
            <label htmlFor="gridCellGeometry">Cell geometry</label>
            <input
              id="gridCellGeometry"
              className="form-control"
              value={spatial.gridCellGeometry || ''}
              onChange={(e) => onSpatialPatch({ gridCellGeometry: e.target.value })}
              onBlur={() => onTouched('spatial.gridRepresentation')}
            />
            <div className="form-row-3">
              <div>
                <label htmlFor="gridColumnSize">Column size</label>
                <input
                  id="gridColumnSize"
                  className={`form-control${invalid('spatial.gridColumnSize') ? ' form-control--invalid' : ''}`}
                  value={spatial.gridColumnSize || ''}
                  onChange={(e) => onSpatialPatch({ gridColumnSize: e.target.value })}
                  onBlur={() => onTouched('spatial.gridRepresentation')}
                />
                {show('spatial.gridColumnSize') ? (
                  <p className="field-error">{show('spatial.gridColumnSize')}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="gridColumnResolution">Column resolution</label>
                <input
                  id="gridColumnResolution"
                  className="form-control"
                  value={spatial.gridColumnResolution || ''}
                  onChange={(e) => onSpatialPatch({ gridColumnResolution: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="gridRowSize">Row size</label>
                <input
                  id="gridRowSize"
                  className={`form-control${invalid('spatial.gridRowSize') ? ' form-control--invalid' : ''}`}
                  value={spatial.gridRowSize || ''}
                  onChange={(e) => onSpatialPatch({ gridRowSize: e.target.value })}
                  onBlur={() => onTouched('spatial.gridRepresentation')}
                />
                {show('spatial.gridRowSize') ? <p className="field-error">{show('spatial.gridRowSize')}</p> : null}
              </div>
            </div>
            <div className="form-row-3">
              <div>
                <label htmlFor="gridRowResolution">Row resolution</label>
                <input
                  id="gridRowResolution"
                  className="form-control"
                  value={spatial.gridRowResolution || ''}
                  onChange={(e) => onSpatialPatch({ gridRowResolution: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="gridVerticalSize">Vertical size</label>
                <input
                  id="gridVerticalSize"
                  className={`form-control${invalid('spatial.gridVerticalSize') ? ' form-control--invalid' : ''}`}
                  value={spatial.gridVerticalSize || ''}
                  onChange={(e) => onSpatialPatch({ gridVerticalSize: e.target.value })}
                />
                {show('spatial.gridVerticalSize') ? (
                  <p className="field-error">{show('spatial.gridVerticalSize')}</p>
                ) : null}
              </div>
              <div>
                <label htmlFor="gridVerticalResolution">Vertical resolution</label>
                <input
                  id="gridVerticalResolution"
                  className="form-control"
                  value={spatial.gridVerticalResolution || ''}
                  onChange={(e) => onSpatialPatch({ gridVerticalResolution: e.target.value })}
                />
              </div>
            </div>
          </div>
        ) : null}

        <label className="toggle">
          <input
            type="checkbox"
            checked={Boolean(spatial.hasTrajectory)}
            onChange={(e) => onSpatialPatch({ hasTrajectory: e.target.checked })}
          />
          <span>Trajectory representation</span>
        </label>
        <label htmlFor="trajectorySampling">Trajectory sampling</label>
        <input
          id="trajectorySampling"
          className={`form-control${invalid('spatial.trajectorySampling') ? ' form-control--invalid' : ''}`}
          value={spatial.trajectorySampling || ''}
          onChange={(e) => onSpatialPatch({ trajectorySampling: e.target.value })}
          onBlur={() => onTouched('spatial.trajectorySampling')}
        />
        {show('spatial.trajectorySampling') ? (
          <p className="field-error">{show('spatial.trajectorySampling')}</p>
        ) : null}

        <h4 className="panel-subtitle">Positional accuracy &amp; error (spatial)</h4>
        <div className="form-row-2">
          <div>
            <label htmlFor="accuracyStandard">Accuracy standard</label>
            <input
              id="accuracyStandard"
              className="form-control"
              value={spatial.accuracyStandard || ''}
              onChange={(e) => onSpatialPatch({ accuracyStandard: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="accuracyValue">Accuracy value</label>
            <input
              id="accuracyValue"
              className={`form-control${invalid('spatial.accuracyValue') ? ' form-control--invalid' : ''}`}
              value={spatial.accuracyValue || ''}
              onChange={(e) => onSpatialPatch({ accuracyValue: e.target.value })}
              onBlur={() => onTouched('spatial.accuracyValue')}
            />
            {show('spatial.accuracyValue') ? <p className="field-error">{show('spatial.accuracyValue')}</p> : null}
          </div>
        </div>
        <div className="form-row-2">
          <div>
            <label htmlFor="errorLevel">Error level</label>
            <input
              id="errorLevel"
              className="form-control"
              value={spatial.errorLevel || ''}
              onChange={(e) => onSpatialPatch({ errorLevel: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="errorValue">Error value</label>
            <input
              id="errorValue"
              className={`form-control${invalid('spatial.errorValue') ? ' form-control--invalid' : ''}`}
              value={spatial.errorValue || ''}
              onChange={(e) => onSpatialPatch({ errorValue: e.target.value })}
              onBlur={() => onTouched('spatial.errorValue')}
            />
            {show('spatial.errorValue') ? <p className="field-error">{show('spatial.errorValue')}</p> : null}
          </div>
        </div>

        <h4 className="panel-subtitle">Lineage (data quality)</h4>
        <label htmlFor="lineageStatement">Lineage statement</label>
        <textarea
          id="lineageStatement"
          rows={3}
          className="form-control"
          value={spatial.lineageStatement || ''}
          onChange={(e) => onSpatialPatch({ lineageStatement: e.target.value })}
        />
        <label htmlFor="lineageProcessSteps">Process steps (one paragraph per step, blank line between)</label>
        <textarea
          id="lineageProcessSteps"
          rows={4}
          className="form-control"
          value={spatial.lineageProcessSteps || ''}
          onChange={(e) => onSpatialPatch({ lineageProcessSteps: e.target.value })}
        />
      </section>
    </>
  )
}
