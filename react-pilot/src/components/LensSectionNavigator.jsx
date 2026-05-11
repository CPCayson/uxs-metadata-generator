/**
 * Wizard section navigator — density bars for Mission, Platform, Sensors, …
 * Split-float: mounts in the left floating rail while the lens helps the form.
 *
 * @module components/LensSectionNavigator
 */

import { SectionBar } from './LensScannerWorkspacePanel.jsx'

/**
 * @param {{
 *   sectionBars: Array<{ id: string, label: string, pct: number, errors: number, warnings: number }>,
 *   lensTarget: string,
 *   lensHlField: string | null,
 *   setLensHlField: (v: string | null | ((p: string | null) => string | null)) => void,
 *   setLensSearch: (s: string) => void,
 * }} props
 */
export default function LensSectionNavigator({
  sectionBars,
  lensTarget,
  lensHlField,
  setLensHlField,
  setLensSearch,
}) {
  if (!sectionBars.length) {
    return (
      <p className="manta-navigator-rail__empty">
        Section summaries appear after validation runs.
      </p>
    )
  }

  return (
    <nav className="manta-navigator-rail" aria-label="Wizard sections">
      <p className="manta-navigator-rail__intro">
        Open a section. Bars show how each part of the record is doing.
      </p>
      <ol className="manta-navigator-rail__list">
        {sectionBars.map((sec, i) => (
          <li key={sec.id} className="manta-navigator-rail__row">
            <span className="manta-navigator-rail__idx" aria-hidden="true">
              {i + 1}
            </span>
            <div className="manta-navigator-rail__bar">
              <SectionBar
                label={sec.label}
                pct={sec.pct}
                errors={sec.errors}
                warnings={sec.warnings}
                active={lensHlField === sec.id}
                onClick={() => {
                  setLensSearch('')
                  if (lensTarget === 'form') {
                    setLensHlField((prev) => (prev === sec.id ? null : sec.id))
                    try {
                      window.dispatchEvent(
                        new CustomEvent('manta:goto-step', { detail: { stepId: sec.id } }),
                      )
                    } catch {
                      /* */
                    }
                    return
                  }
                  setLensHlField((prev) => (prev === sec.id ? null : sec.id))
                }}
              />
            </div>
          </li>
        ))}
      </ol>
    </nav>
  )
}
