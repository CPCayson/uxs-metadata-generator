import React, { useState } from "react";

/**
 * MantaRayPanel
 * -------------
 * The right-hand assistant panel. Four tabs: Validate, GCMD, Ask, CoMET.
 * Completely profile-driven — no hardcoded profile logic here.
 *
 * Props:
 *   profile     — full profile object from profileRegistry
 *   score       — current readiness score (0–100)
 *   fixed       — whether auto-fix has run
 *   stepPctMap  — { stepKey: number } live completion map
 *   onGoStep    — (stepKey: string) => void
 *   onFix       — () => void
 */
export default function MantaRayPanel({
  profile,
  score,
  fixed,
  stepPctMap = {},
  onGoStep,
  onFix,
}) {
  const [tab, setTab] = useState("validate");
  const [askQ, setAskQ] = useState("");

  const visibleIssues = fixed
    ? profile.issues.filter((i) => i.sev === "WRN")
    : profile.issues;

  const scoreColor =
    score < 50
      ? "var(--color-text-danger)"
      : score < 75
      ? "var(--color-text-warning)"
      : "var(--color-text-success)";

  return (
    <div className="ray-panel">
      {/* Header */}
      <div className="ray-header">
        <div className="ray-avatar">M</div>
        <div>
          <div className="ray-name">Manta Ray</div>
          <div className="ray-profile-label">{profile.rayProfile}</div>
        </div>
        <div className="ray-score" style={{ color: scoreColor }}>{score}</div>
      </div>

      {/* Tabs */}
      <div className="ray-tabs">
        {["validate", "gcmd", "ask", "comet"].map((t) => (
          <button
            key={t}
            className={`ray-tab ${tab === t ? "ray-tab--active" : ""}`}
            onClick={() => setTab(t)}
          >
            {t === "gcmd" ? "GCMD" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab: Validate */}
      {tab === "validate" && (
        <div className="ray-body">
          <p className="ray-section-label">Step readiness</p>
          <div className="step-bars">
            {profile.steps
              .filter((s) => s.key !== "validation" && s.key !== "xml")
              .map((s) => {
                const pct = stepPctMap[s.key] ?? profile.stepPct[s.key] ?? 0;
                const adjustedPct = fixed && pct < 50 ? Math.min(pct + 35, 100) : pct;
                const barColor =
                  adjustedPct >= 80
                    ? "#1D9E75"
                    : adjustedPct >= 40
                    ? "#BA7517"
                    : "#E24B4A";
                return (
                  <div
                    key={s.key}
                    className="step-bar-row"
                    role="button"
                    tabIndex={0}
                    onClick={() => onGoStep(s.key)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onGoStep(s.key);
                      }
                    }}
                  >
                    <span className="step-bar-name">{s.label.slice(0, 8)}</span>
                    <div className="step-bar-track">
                      <div
                        className="step-bar-fill"
                        style={{ width: `${adjustedPct}%`, background: barColor }}
                      />
                    </div>
                    <span className="step-bar-val">
                      {adjustedPct >= 80 ? "✓" : `${adjustedPct}%`}
                    </span>
                  </div>
                );
              })}
          </div>

          <p className="ray-section-label">Issues</p>
          <div className="issue-list">
            {visibleIssues.slice(0, 4).map((issue, i) => (
              <div key={i} className="issue-card">
                <span className={`issue-badge ${issue.sev === "ERR" ? "issue-badge--err" : "issue-badge--wrn"}`}>
                  {issue.sev}
                </span>
                <span className="issue-text">{issue.text}</span>
                <span className="issue-loc">{issue.loc}</span>
              </div>
            ))}
          </div>

          <button className="btn-primary btn--full" onClick={onFix}>
            ⚡ Fix issues →
          </button>
        </div>
      )}

      {/* Tab: GCMD */}
      {tab === "gcmd" && (
        <div className="ray-body">
          <p className="ray-section-label">Suggested keywords</p>
          <p className="ray-hint" style={{ marginBottom: 8 }}>
            Based on {profile.label} content — click to add
          </p>
          <div className="gcmd-list">
            {profile.gcmd.map((g, i) => (
              <GcmdRow key={i} kw={g.kw} conf={g.conf} />
            ))}
          </div>
          <button
            className="btn-secondary btn--full btn--sm"
            style={{ marginTop: 6 }}
            onClick={() =>
              window.sendPrompt?.(
                `Search GCMD for more keywords for a ${profile.label} record`
              )
            }
          >
            Search more GCMD ↗
          </button>
        </div>
      )}

      {/* Tab: Ask */}
      {tab === "ask" && (
        <div className="ray-body">
          <p className="ray-section-label">Ask Manta Ray</p>
          <div className="ask-answer ask-answer--intro">
            I can explain any field, suggest values, or find controlled vocabulary
            terms for this {profile.label} record.
          </div>
          <textarea
            className="ask-input"
            placeholder={`e.g. What should the abstract include for a ${profile.label}?`}
            value={askQ}
            onChange={(e) => setAskQ(e.target.value)}
            rows={3}
          />
          <button
            className="btn-primary btn--full btn--sm"
            style={{ marginTop: 6 }}
            onClick={() =>
              window.sendPrompt?.(
                `Manta Ray for ${profile.label}: ${askQ || "What should the abstract include?"}`
              )
            }
          >
            Ask ↗
          </button>
        </div>
      )}

      {/* Tab: CoMET */}
      {tab === "comet" && (
        <div className="ray-body">
          <p className="ray-section-label">CoMET actions</p>
          {!profile.comet.push && (
            <div className="comet-warning">{profile.comet.reason}</div>
          )}
          <div className="comet-actions">
            <button
              className="btn-secondary btn--sm"
              onClick={() =>
                window.sendPrompt?.(`Pull latest ISO from CoMET for this ${profile.label} record`)
              }
            >
              Pull from CoMET
            </button>
            <button
              className="btn-secondary btn--sm"
              onClick={() =>
                window.sendPrompt?.(`Run CoMET preflight check on this ${profile.label} record`)
              }
            >
              Run preflight
            </button>
            <button
              className={`btn--sm ${score >= 70 ? "btn-primary" : "btn-secondary btn--disabled"}`}
              disabled={score < 70}
              onClick={() =>
                score >= 70 &&
                window.sendPrompt?.(`Push this ${profile.label} draft to CoMET`)
              }
            >
              Push draft →
            </button>
            <button
              className="btn-secondary btn--sm"
              onClick={() =>
                window.sendPrompt?.(`Open this record in CoMET`)
              }
            >
              Open in CoMET ↗
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function GcmdRow({ kw, conf }) {
  const [added, setAdded] = useState(false);
  return (
    <div
      className={`gcmd-row ${added ? "gcmd-row--added" : ""}`}
      onClick={() => setAdded(true)}
    >
      <svg
        width="12" height="12" viewBox="0 0 24 24" fill="none"
        stroke={added ? "#085041" : "#1D9E75"}
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        {added
          ? <path d="M20 6 9 17l-5-5" />
          : <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>}
      </svg>
      <span className="gcmd-kw" style={{ color: added ? "#085041" : undefined }}>
        {kw}
      </span>
      <span className="gcmd-conf">{added ? "Added" : `${conf}%`}</span>
    </div>
  );
}
