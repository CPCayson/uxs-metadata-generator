import React, { useState, useCallback } from "react";
import { PROFILES } from "./profileRegistry";
import MantaRayPanel from "./MantaRayPanel";
import StepPlatform from "./steps/StepPlatform";
import StepKeywords from "./steps/StepKeywords";
import StepValidation from "./steps/StepValidation";

/**
 * Shipped step UIs only (zip subset). Any other step key uses GenericStep below.
 */
const STEP_COMPONENTS = {
  platform: StepPlatform,
  keywords: StepKeywords,
  validation: StepValidation,
};

/**
 * ProfileWizard
 * -------------
 * Renders the full wizard for any profile. Manages step state,
 * readiness score, and auto-fix. Completely driven by profileRegistry.
 *
 * Props:
 *   profileId   — one of the keys in PROFILES
 *   prefill     — optional { [fieldKey]: value } from classifier
 *   onBack      — () => void — go back to intake
 */
export default function ProfileWizard({ profileId, prefill = {}, onBack }) {
  const profile = PROFILES[profileId];

  const [stepIdx, setStepIdx] = useState(0);
  const [score, setScore] = useState(30);
  const [fixed, setFixed] = useState(false);
  const [stepPctMap] = useState(() => {
    const p = PROFILES[profileId];
    return p ? { ...p.stepPct } : {};
  });
  const [pilotState, setPilotState] = useState(() => ({ ...prefill }));

  const currentStep = profile?.steps[stepIdx];

  const handleFieldChange = useCallback((updates) => {
    setPilotState((prev) => ({ ...prev, ...updates }));
    setScore((s) => Math.min(s + 2, fixed ? 85 : 65));
  }, [fixed]);

  const handleFix = useCallback(() => {
    setFixed(true);
    setScore((s) => Math.min(s + 28, 75));
  }, []);

  const goStep = useCallback((idx) => {
    if (!profile) return;
    if (idx >= 0 && idx < profile.steps.length) setStepIdx(idx);
  }, [profile]);

  const goStepByKey = useCallback((key) => {
    if (!profile) return;
    const idx = profile.steps.findIndex((s) => s.key === key);
    if (idx >= 0) setStepIdx(idx);
  }, [profile]);

  if (!profile || !currentStep) return null;

  // Score color
  const scoreColor =
    score < 50 ? "var(--color-text-danger)"
    : score < 75 ? "var(--color-text-warning)"
    : "var(--color-text-success)";

  // Render the current step form
  const StepComponent = STEP_COMPONENTS[currentStep.key] || GenericStep;

  return (
    <div className="wizard-root">
      {/* Top bar */}
      <div className="topbar">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="breadcrumb">
          New record · <strong>{profile.label}</strong>
        </span>
        <span
          className="profile-chip"
          style={{ background: profile.chipBg, color: profile.chipFg }}
        >
          {profile.chip}
        </span>
      </div>

      {/* Readiness strip */}
      <div className="score-strip">
        <span className="score-label">Readiness</span>
        <div className="score-track">
          <div
            className="score-fill"
            style={{
              width: `${score}%`,
              background: score < 50 ? "#E24B4A" : score < 75 ? "#BA7517" : "#1D9E75",
            }}
          />
        </div>
        <span className="score-num" style={{ color: scoreColor }}>{score}</span>
        <span className="score-mode">
          Lenient ·{" "}
          {fixed
            ? `${profile.issues.filter(i => i.sev === "WRN").length} warnings`
            : `${profile.issues.length} issues`}
        </span>
        <button className="fix-btn" onClick={handleFix}>⚡ Fix issues</button>
      </div>

      {/* Main layout: sidenav | form | ray panel */}
      <div className="wizard-layout">
        {/* Sidenav */}
        <nav className="wizard-sidenav">
          {profile.steps.map((step, i) => {
            const isActive  = i === stepIdx;
            const isDone    = i < stepIdx;
            return (
              <button
                key={step.key}
                className={`nav-step ${isActive ? "nav-step--active" : ""} ${isDone ? "nav-step--done" : ""}`}
                onClick={() => goStep(i)}
              >
                <span>{step.label}</span>
                <StepDot
                  pct={stepPctMap[step.key] ?? 0}
                  done={isDone}
                />
              </button>
            );
          })}
          <div className="comet-badge">
            <div className="comet-dot" />
            <span>CoMET — {score >= 70 ? "ready" : "not ready"}</span>
          </div>
        </nav>

        {/* Form pane */}
        <div className="form-pane">
          <StepComponent
            profile={profile}
            pilotState={pilotState}
            prefill={prefill}
            fixed={fixed}
            stepIdx={stepIdx}
            onFieldChange={handleFieldChange}
            onNext={() => goStep(stepIdx + 1)}
            onBack={() => goStep(stepIdx - 1)}
            onGoStep={goStepByKey}
            onFix={handleFix}
            score={score}
          />
        </div>

        {/* Manta Ray panel */}
        <MantaRayPanel
          profile={profile}
          score={score}
          fixed={fixed}
          stepPctMap={stepPctMap}
          onGoStep={goStepByKey}
          onFix={handleFix}
        />
      </div>
    </div>
  );
}

/** Dot indicator for sidenav step */
function StepDot({ pct, done }) {
  const color = done
    ? "var(--color-text-success)"
    : pct >= 80
    ? "#1D9E75"
    : pct >= 40
    ? "#BA7517"
    : "#E24B4A";
  return (
    <div
      style={{
        width: 6, height: 6, borderRadius: "50%",
        background: color, flexShrink: 0,
      }}
    />
  );
}

/**
 * GenericStep — fallback for any step that doesn't have a dedicated component yet.
 * Renders scanner bar + basic title/description/date fields.
 */
function GenericStep({ profile, stepIdx, onNext, onBack }) {
  const step = profile.steps[stepIdx];
  const hasPrev = stepIdx > 0;
  const hasNext = stepIdx < profile.steps.length - 1;
  const prevLabel = hasPrev ? profile.steps[stepIdx - 1].label : "";
  const nextLabel = hasNext ? profile.steps[stepIdx + 1].label : "";

  return (
    <div>
      <h3 className="step-title">{step.label}</h3>
      <p className="step-subtitle">{profile.label} · {step.label.toLowerCase()} fields</p>

      <ScannerBar
        stepLabel={step.label}
        profileLabel={profile.label}
      />

      <div className="field-row">
        <label className="field-label">
          {step.label} title / identifier
          <span className="required">*</span>
        </label>
        <input type="text" placeholder={`Enter ${step.label.toLowerCase()} identifier…`} />
      </div>

      <div className="field-row">
        <label className="field-label">Description</label>
        <textarea
          rows={3}
          placeholder={`Describe this ${step.label.toLowerCase()}…`}
        />
      </div>

      <div className="field-row field-row--half">
        <div>
          <label className="field-label">Start date</label>
          <input type="date" />
        </div>
        <div>
          <label className="field-label">End date</label>
          <input type="date" />
        </div>
      </div>

      <StepNavBar
        hasPrev={hasPrev}
        hasNext={hasNext}
        prevLabel={prevLabel}
        nextLabel={nextLabel}
        onPrev={onBack}
        onNext={onNext}
      />
    </div>
  );
}

/**
 * Shared sub-components — export these so step files can import them
 */
export function ScannerBar({ stepLabel, profileLabel }) {
  return (
    <div
      className="scanner-bar"
      onClick={() =>
        window.sendPrompt?.(
          `Run Manta Lens Scanner to prefill ${stepLabel} fields for this ${profileLabel} record`
        )
      }
    >
      <div className="scanner-icon">⚡</div>
      <div>
        <div className="scanner-text">Lens scanner — prefill {stepLabel.toLowerCase()} fields</div>
        <div className="scanner-hint">Extract from uploaded doc · paste URL · drop file</div>
      </div>
    </div>
  );
}

export function LookupRow({ children, btnLabel, onLookup }) {
  return (
    <div className="lookup-row">
      {children}
      <button className="lookup-btn" onClick={onLookup}>{btnLabel} ↗</button>
    </div>
  );
}

export function StepNavBar({ hasPrev, hasNext, prevLabel, nextLabel, onPrev, onNext }) {
  return (
    <div className="step-nav-bar">
      {hasPrev && (
        <button className="btn-secondary" onClick={onPrev}>
          ← {prevLabel}
        </button>
      )}
      {hasNext && (
        <button className="btn-primary" onClick={onNext}>
          {nextLabel} →
        </button>
      )}
      <button
        className="btn-ghost"
        style={{ marginLeft: "auto" }}
        onClick={() => window.sendPrompt?.("Save this record as a draft in Manta")}
      >
        Save draft
      </button>
    </div>
  );
}
