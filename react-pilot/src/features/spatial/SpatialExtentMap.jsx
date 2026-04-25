import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/** Format a longitude/latitude value as a mono HUD readout. */
function fmtCoord(v, axis) {
  const n = Number.parseFloat(String(v ?? '').trim())
  if (!Number.isFinite(n)) return '––.––'
  const abs = Math.abs(n).toFixed(2)
  const dir = axis === 'lng' ? (n >= 0 ? 'E' : 'W') : n >= 0 ? 'N' : 'S'
  return `${abs.padStart(5, '0')}°${dir}`
}

/** @param {string} west @param {string} east @param {string} south @param {string} north */
function bboxBounds(west, east, south, north) {
  const w = Number.parseFloat(String(west ?? '').trim())
  const e = Number.parseFloat(String(east ?? '').trim())
  const s = Number.parseFloat(String(south ?? '').trim())
  const n = Number.parseFloat(String(north ?? '').trim())
  if (![w, e, s, n].every((x) => Number.isFinite(x))) return null
  const southN = Math.min(s, n)
  const northN = Math.max(s, n)
  const westN = Math.min(w, e)
  const eastN = Math.max(w, e)
  return L.latLngBounds(L.latLng(southN, westN), L.latLng(northN, eastN))
}

/**
 * Cyberpunk-styled map preview for the spatial step bounding box.
 * Uses CartoDB Dark Matter tiles + neon cyan rectangle + HUD overlay chrome.
 *
 * @param {{ west: string, east: string, south: string, north: string }} props
 */
export default function SpatialExtentMap({ west, east, south, north }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const rectRef = useRef(null)
  const glowRectRef = useRef(null)
  const [zoom, setZoom] = useState(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: true,
    }).setView([20, 0], 2)

    // CartoDB Dark Matter — free, keyless, pitch-black basemap.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &middot; ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map)

    mapRef.current = map
    setZoom(map.getZoom())
    const onZoom = () => setZoom(map.getZoom())
    map.on('zoomend', onZoom)

    return () => {
      map.off('zoomend', onZoom)
      map.remove()
      mapRef.current = null
      rectRef.current = null
      glowRectRef.current = null
    }
  }, [])

  // Derive display status from existing state — avoids calling setState inside an effect.
  // `zoom` is set to a number once the map initialises; props drive boundsReady.
  const boundsReady = [west, east, south, north].every(
    (v) => Number.isFinite(Number.parseFloat(String(v ?? '').trim())),
  )
  const status = zoom === null ? 'acquiring' : boundsReady ? 'locked' : 'awaiting bounds'

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (rectRef.current) {
      map.removeLayer(rectRef.current)
      rectRef.current = null
    }
    if (glowRectRef.current) {
      map.removeLayer(glowRectRef.current)
      glowRectRef.current = null
    }

    const bounds = bboxBounds(west, east, south, north)
    if (!bounds) return

    // Soft outer glow (wider, translucent).
    const glow = L.rectangle(bounds, {
      color: '#22d3ee',
      weight: 10,
      opacity: 0.18,
      fillColor: '#22d3ee',
      fillOpacity: 0.04,
      interactive: false,
      className: 'fx-map-bbox-glow',
    }).addTo(map)
    glowRectRef.current = glow

    // Crisp neon outline with dashed pattern for "scanning" feel.
    const rect = L.rectangle(bounds, {
      color: '#22d3ee',
      weight: 2,
      opacity: 0.95,
      dashArray: '6 4',
      fillColor: '#a855f7',
      fillOpacity: 0.08,
      className: 'fx-map-bbox',
    }).addTo(map)
    rectRef.current = rect

    map.fitBounds(bounds.pad(0.08))
  }, [west, east, south, north])

  useEffect(() => {
    function onMapCmd(/** @type {CustomEvent} */ e) {
      const action = e?.detail?.action
      const map = mapRef.current
      if (!map || !action) return
      if (action === 'zoomIn') {
        map.zoomIn(1)
        return
      }
      if (action === 'zoomOut') {
        map.zoomOut(1)
        return
      }
      if (action === 'fit') {
        const b = bboxBounds(west, east, south, north)
        if (b) map.fitBounds(b.pad(0.08))
        else map.setView([20, 0], 2)
      }
    }
    window.addEventListener('manta:map-command', onMapCmd)
    return () => window.removeEventListener('manta:map-command', onMapCmd)
  }, [west, east, south, north])

  return (
    <div className="spatial-extent-map-wrap fx-map-wrap">
      <div className="fx-map-frame">
        <div
          ref={containerRef}
          className="spatial-extent-map fx-map"
          role="img"
          aria-label="Bounding box on map"
        />
        <div className="fx-map-hud" aria-hidden="true">
          <span className="fx-map-corner fx-map-corner--tl" />
          <span className="fx-map-corner fx-map-corner--tr" />
          <span className="fx-map-corner fx-map-corner--bl" />
          <span className="fx-map-corner fx-map-corner--br" />
          <span className="fx-map-crosshair" />
          <span className="fx-map-scan" />
        </div>
        <div className="fx-map-readout" aria-hidden="true">
          <span className={`fx-map-readout-dot fx-map-readout-dot--${status === 'locked' ? 'ok' : 'idle'}`} />
          <span className="fx-map-readout-label">BBOX</span>
          <span className="fx-map-readout-val">
            {fmtCoord(north, 'lat')} / {fmtCoord(east, 'lng')}
          </span>
          <span className="fx-map-readout-sep">·</span>
          <span className="fx-map-readout-val">
            {fmtCoord(south, 'lat')} / {fmtCoord(west, 'lng')}
          </span>
          <span className="fx-map-readout-sep">·</span>
          <span className="fx-map-readout-label">Z</span>
          <span className="fx-map-readout-val">{zoom ?? '—'}</span>
          <span className="fx-map-readout-sep">·</span>
          <span className="fx-map-readout-status">{status}</span>
        </div>
      </div>
      <p className="hint spatial-extent-map-hint">
        Preview from W/E/S/N on a dark-matter basemap. Edit the coordinates above to change the extent.
      </p>
    </div>
  )
}
