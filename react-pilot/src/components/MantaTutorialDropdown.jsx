import { useState } from 'react'

/**
 * Tutorial / sample content entry in the app header.
 */
export default function MantaTutorialDropdown() {
  const [open, setOpen] = useState(false)
  return (
    <div className="manta-tutorial-dd">
      <button
        type="button"
        className="manta-tutorial-dd__btn"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        Tutorial
        <span className="manta-tutorial-dd__chev" aria-hidden>▾</span>
      </button>
      {open ? (
        <div className="manta-tutorial-dd__panel" role="region" aria-label="Tutorial">
          <p className="manta-tutorial-dd__hint">
            Use the wizard steps and the Manta Ray panel (bottom-right) for validation, lens mode, and scanner tools.
          </p>
        </div>
      ) : null}
    </div>
  )
}
