/**
 * Header voice / command bar shell. Extends with STT or commands as needed.
 * @param {{ profileId?: string }} _props
 */
export default function MantaVoiceBar() {
  return (
    <div className="manta-voice-bar" role="status" aria-live="polite">
      <span className="manta-voice-bar__mark">Manta</span>
      <span className="manta-voice-bar__status">Voice commands coming soon.</span>
    </div>
  )
}
