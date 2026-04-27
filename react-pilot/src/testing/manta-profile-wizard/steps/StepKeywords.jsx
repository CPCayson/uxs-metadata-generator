import React, { useState } from "react";
import { StepNavBar } from "../ProfileWizard";

/**
 * StepKeywords — shared across all profiles
 * ------------------------------------------
 * GCMD science keyword authoring. Pre-seeds suggestions from the profile
 * registry. Each suggestion has a confidence score derived from the
 * classifier's match analysis.
 *
 * In production this would call the GCMD CMR KMS API:
 *   GET https://gcmd.earthdata.nasa.gov/kms/keywords?format=json&page_num=1&page_size=20&keyword=<query>
 * For now suggestions come from the profile registry (already tuned per profile).
 */
export default function StepKeywords({
  profile,
  pilotState,
  stepIdx,
  onFieldChange,
  onNext,
  onBack,
}) {
  const [tags, setTags] = useState(pilotState.keywords ?? []);
  const [input, setInput] = useState("");
  const [addedSet, setAddedSet] = useState(new Set());

  const hasPrev = stepIdx > 0;
  const hasNext = stepIdx < profile.steps.length - 1;
  const prevLabel = hasPrev ? profile.steps[stepIdx - 1].label : "";
  const nextLabel = hasNext ? profile.steps[stepIdx + 1].label : "";

  const addTag = (kw) => {
    if (!kw.trim() || tags.includes(kw.trim())) return;
    const next = [...tags, kw.trim()];
    setTags(next);
    onFieldChange({ keywords: next });
  };

  const removeTag = (kw) => {
    const next = tags.filter((t) => t !== kw);
    setTags(next);
    onFieldChange({ keywords: next });
  };

  const addSuggested = (kw, i) => {
    addTag(kw);
    setAddedSet((prev) => new Set(prev).add(i));
  };

  const handleInputAdd = () => {
    addTag(input);
    setInput("");
  };

  // Data types collected — profile-aware defaults
  const DATA_TYPES = profile.id === "uxs"
    ? ["CTD / hydrographic", "Multibeam sonar", "Sub-bottom profiler",
       "Video / imagery", "Navigation / track", "Water column sonar"]
    : profile.id === "bedi"
    ? ["Still images", "Video segments", "Annotation metadata",
       "Species occurrence", "Depth + coordinates", "WAF links"]
    : profile.id === "oer"
    ? ["Multibeam", "CTD", "ROV video", "Physical samples",
       "Navigation", "GIS layers", "Documents"]
    : ["CTD", "Oceanographic", "Biological", "Chemical", "Physical", "Remote sensing"];

  const [checkedTypes, setCheckedTypes] = useState(
    new Set(DATA_TYPES.slice(0, 2))
  );

  return (
    <div>
      <h3 className="step-title">GCMD science keywords</h3>
      <p className="step-subtitle">
        Manta suggests keywords tuned for {profile.label} — click to add, or search GCMD vocabulary
      </p>

      {/* Manual search */}
      <div className="field-row">
        <label className="field-label">Search / add keyword</label>
        <div className="lookup-row">
          <input
            type="text"
            value={input}
            placeholder="Search GCMD keyword…"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleInputAdd()}
          />
          <button className="lookup-btn" onClick={handleInputAdd}>Add</button>
          <button
            className="lookup-btn"
            onClick={() =>
              window.sendPrompt?.(
                `Search GCMD CMR KMS vocabulary for: ${input || "ocean " + profile.label}`
              )
            }
          >
            GCMD ↗
          </button>
        </div>
      </div>

      {/* Tag cloud */}
      {tags.length > 0 && (
        <div className="tag-row" style={{ marginBottom: 12 }}>
          {tags.map((t) => (
            <span key={t} className="keyword-tag">
              {t.split(">").pop().trim()}
              <span
                className="tag-remove"
                onClick={() => removeTag(t)}
                title="Remove"
              >
                ×
              </span>
            </span>
          ))}
        </div>
      )}

      {/* Suggestions */}
      <p className="field-label" style={{ marginBottom: 6 }}>
        Suggested from your {profile.label} content:
      </p>
      <div className="gcmd-suggestion-list">
        {profile.gcmd.map((g, i) => {
          const added = addedSet.has(i);
          return (
            <div
              key={i}
              className={`gcmd-suggestion-row ${added ? "gcmd-suggestion-row--added" : ""}`}
              onClick={() => !added && addSuggested(g.kw, i)}
            >
              <svg
                width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke={added ? "#085041" : "#1D9E75"}
                strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ flexShrink: 0 }}
              >
                {added
                  ? <path d="M20 6 9 17l-5-5" />
                  : <><circle cx="12" cy="12" r="10" /><path d="M12 8v8M8 12h8" /></>}
              </svg>
              <span className="gcmd-kw-text">{g.kw}</span>
              <span className={`gcmd-conf-badge ${added ? "gcmd-conf-badge--added" : ""}`}>
                {added ? "Added" : `${g.conf}%`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Data types */}
      <div className="field-row" style={{ marginTop: 14 }}>
        <label className="field-label">Data types collected</label>
        <div className="checkbox-grid">
          {DATA_TYPES.map((t) => (
            <label key={t} className="checkbox-label">
              <input
                type="checkbox"
                checked={checkedTypes.has(t)}
                onChange={(e) => {
                  const next = new Set(checkedTypes);
                  e.target.checked ? next.add(t) : next.delete(t);
                  setCheckedTypes(next);
                  onFieldChange({ dataTypes: [...next] });
                }}
              />
              {t}
            </label>
          ))}
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
