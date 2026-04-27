import MantaProfileRouter from './manta-profile-wizard/MantaProfileRouter'
import './mantaProfileWizardTest.css'

/**
 * Isolated harness for the drop-in Manta profile wizard (intake + registry-driven steps).
 * Select profile "[TEST] Manta profile wizard" in the header to open it.
 */
export default function MantaProfileWizardTest() {
  return (
    <div className="manta-profile-wizard-test-root">
      <div className="manta-profile-wizard-test-banner" role="note">
        Test harness — Manta profile wizard prototype. Not connected to pilot / CoMET state.
        Scanner actions call <code>window.sendPrompt</code> when defined.
      </div>
      <MantaProfileRouter />
    </div>
  )
}
