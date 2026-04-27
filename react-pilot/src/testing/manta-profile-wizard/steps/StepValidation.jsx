import React from "react";
import { StepNavBar } from "../ProfileWizard";

/**
 * StepValidation — shared across all profiles
 * --------------------------------------------
 * Reads profile.issues and renders lenient/strict/catalog mode picker,
 * live issue list with go-to-step links, and auto-fix button.
 *
 * In production: ValidationEngine runs against pilotState and emits
 * a list of { sev, text, field, step, fixable } — exactly the shape in
 * profileRegistry.issues. Replace profile.issues with that live output.
 */
export default function StepValidation({
  profile,
  stepIdx,
  fixed,
  score,
  onBack,
  onNext,
  onGoStep,
  onFix,
}) {
  const hasPrev = stepIdx > 0;
  const hasNext = stepIdx < profile.steps.length - 1;
  const prevLabel = hasPrev ? profile.steps[stepIdx - 1].label : "";
  const nextLabel = hasNext ? profile.steps[stepIdx + 1].label : "";

  const visibleIssues = fixed
    ? profile.issues.filter((i) => i.sev === "WRN")
    : profile.issues;

  const errCount = visibleIssues.filter((i) => i.sev === "ERR").length;
  const wrnCount = visibleIssues.filter((i) => i.sev === "WRN").length;

  return (
    <div>
      <h3 className="step-title">Validation — lenient mode</h3>
      <p className="step-subtitle">
        {fixed
          ? `Auto-fix applied · ${wrnCount} warning${wrnCount !== 1 ? "s" : ""} remain`
          : `${errCount} error${errCount !== 1 ? "s" : ""} · ${wrnCount} warning${wrnCount !== 1 ? "s" : ""} · switch to Strict or Catalog for full check`}
      </p>

      {/* Mode switcher */}
      <div className="mode-row">
        <button className="mode-btn mode-btn--active">Lenient</button>
        <button
          className="mode-btn"
          onClick={() =>
            window.sendPrompt?.(
              `Switch to Strict validation mode for this ${profile.label} record`
            )
          }
        >
          Strict
        </button>
        <button
          className="mode-btn"
          onClick={() =>
            window.sendPrompt?.(
              `Switch to Catalog validation mode for this ${profile.label} record`
            )
          }
        >
          Catalog
        </button>
        <button
          className="mode-btn"
          style={{ marginLeft: "auto" }}
          onClick={() =>
            window.sendPrompt?.(
              `Explain the difference between Lenient, Strict, and Catalog validation modes in Manta`
            )
          }
        >
          Mode help ↗
        </button>
      </div>

      {/* Issue list */}
      <div className="val-issue-list">
        {visibleIssues.map((issue, i) => (
          <div key={i} className="val-issue">
            <div
              className="val-dot"
              style={{
                background:
                  issue.sev === "ERR"
                    ? "var(--color-text-danger)"
                    : "var(--color-text-warning)",
              }}
            />
            <div className="val-body">
              <div className="val-text">{issue.text}</div>
              <div className="val-loc">{issue.loc}</div>
            </div>
            <button
              className="val-go"
              onClick={() => onGoStep(issue.step)}
            >
              Go →
            </button>
          </div>
        ))}
      </div>

      {visibleIssues.length === 0 && (
        <div className="val-all-clear">
          All checks passed in lenient mode — switch to Strict for deeper validation.
        </div>
      )}

      {/* Fix button */}
      {!fixed && (
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button className="btn-primary" onClick={onFix}>
            ⚡ Auto-fix {profile.issues.filter((i) => i.fixable).length} safe issues
          </button>
        </div>
      )}

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
