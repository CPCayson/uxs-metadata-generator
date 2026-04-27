import React, { useState } from "react";
import MantaIntake from "./MantaIntake";
import ProfileWizard from "./ProfileWizard";

/**
 * MantaProfileRouter
 * ------------------
 * Top-level router. Drop this anywhere in your existing WizardShell or
 * as a new route in your React app.
 *
 * State machine:
 *   "intake"  → user sees drop zone + classifier
 *   "wizard"  → user sees full profile wizard
 *
 * Usage in your app:
 *   import MantaProfileRouter from "./profiles/MantaProfileRouter";
 *   // Then in your nav switch:
 *   case "UxS Wizard": return <MantaProfileRouter />;
 *
 * Or as a standalone route in react-router:
 *   <Route path="/new" element={<MantaProfileRouter />} />
 */
export default function MantaProfileRouter() {
  const [view, setView]         = useState("intake"); // "intake" | "wizard"
  const [profileId, setProfileId] = useState(null);
  const [prefill, setPrefill]   = useState({});

  const handleLaunch = (id, prefillData = {}) => {
    setProfileId(id);
    setPrefill(prefillData ?? {});
    setView("wizard");
  };

  const handleBack = () => {
    setView("intake");
    setProfileId(null);
    setPrefill({});
  };

  if (view === "wizard" && profileId) {
    return (
      <ProfileWizard
        profileId={profileId}
        prefill={prefill}
        onBack={handleBack}
      />
    );
  }

  return <MantaIntake onLaunch={handleLaunch} />;
}
