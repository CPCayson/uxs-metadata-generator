import React, { useState, useCallback } from "react";
import { PROFILES, classifyInput } from "./profileRegistry";

/**
 * MantaIntake
 * -----------
 * Drop zone + paste area. Classifies any XML / JSON / doc text in real time
 * and spins up the correct profile wizard. Falls back to manual profile
 * selection grid.
 *
 * Props:
 *   onLaunch(profileId, prefillData?) — called when user confirms a profile
 */
export default function MantaIntake({ onLaunch }) {
  const [pasteValue, setPasteValue]   = useState("");
  const [classified, setClassified]   = useState(null); // { profileId, confidence, label, fieldsNote }
  const [dragOver, setDragOver]       = useState(false);

  const handlePaste = useCallback((e) => {
    const text = e.target.value;
    setPasteValue(text);
    setClassified(classifyInput(text));
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      setPasteValue(text.slice(0, 2000));
      setClassified(classifyInput(text));
    };
    reader.readAsText(file);
  }, []);

  const launch = (profileId, prefill = null) => {
    onLaunch(profileId, prefill);
  };

  const profile = classified ? PROFILES[classified.profileId] : null;

  return (
    <div className="intake-wrap">
      <div className="intake-card">
        {/* Header */}
        <div className="intake-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <path d="M14 2v6h6"/>
            <path d="m10 13-2 2 2 2"/><path d="m14 17 2-2-2-2"/>
          </svg>
        </div>
        <h2 className="intake-title">Start from anything</h2>
        <p className="intake-sub">
          Drop or paste any XML, JSON, PDF, or mission doc — Manta classifies it
          and opens the right wizard automatically. UxS, OER PED, NOFO, BEDI granule,
          or Collection.
        </p>

        {/* Drop zone */}
        <div
          className={`drop-zone ${dragOver ? "drop-zone--active" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById("manta-file-input")?.click()}
        >
          <input
            id="manta-file-input"
            type="file"
            accept=".xml,.json,.txt,.pdf,.md,.csv"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                const text = ev.target.result;
                setPasteValue(text.slice(0, 2000));
                setClassified(classifyInput(text));
              };
              reader.readAsText(file);
            }}
          />
          <UploadIcon />
          <p className="drop-text">Drop file or click to browse</p>
          <p className="drop-hint">
            ISO XML · CruisePack JSON · BEDI spreadsheet · NOFO PDF ·
            mission report · SeaTube export
          </p>
        </div>

        <OrDivider />

        {/* Paste area */}
        <textarea
          className="paste-area"
          placeholder="Paste any XML, JSON, or text — e.g. <gmi:MI_Metadata…> or cruise report text or NOFO DISP…"
          value={pasteValue}
          onChange={handlePaste}
          rows={4}
        />

        {/* Classification result */}
        {classified && profile && (
          <div className="classify-box" style={{ borderColor: profile.color }}>
            <div
              className="classify-ic"
              style={{ background: profile.color }}
            >
              {profile.id[0].toUpperCase()}
            </div>
            <div className="classify-info">
              <div className="classify-name" style={{ color: profile.chipFg }}>
                {classified.label}
              </div>
              <div className="classify-conf">
                {classified.confidence}% confidence · {classified.fieldsNote}
              </div>
            </div>
            <button
              className="classify-btn"
              style={{ background: profile.color }}
              onClick={() => launch(classified.profileId)}
            >
              Open wizard →
            </button>
          </div>
        )}

        {classified && !profile && (
          <div className="classify-box classify-box--unknown">
            <div className="classify-ic classify-ic--unknown">?</div>
            <div className="classify-info">
              <div className="classify-name">Unknown — paste more or upload file</div>
              <div className="classify-conf">Cannot classify with current input</div>
            </div>
          </div>
        )}

        {/* Manual profile grid */}
        <div className="profile-section">
          <p className="profile-section-label">Or choose a profile directly:</p>
          <div className="profile-grid">
            {Object.values(PROFILES).map((p) => (
              <button
                key={p.id}
                className="profile-btn"
                onClick={() => launch(p.id)}
              >
                <span style={{ color: p.color, fontWeight: 500 }}>{p.label}</span>
                <span className="profile-btn-sub">{p.chip}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "block", margin: "0 auto 6px", color: "var(--color-text-tertiary)" }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
      <path d="M17 8 12 3 7 8"/><path d="M12 3v12"/>
    </svg>
  );
}

function OrDivider() {
  return (
    <div style={{
      position: "relative", textAlign: "center",
      fontSize: 11, color: "var(--color-text-tertiary)", margin: "8px 0",
    }}>
      <span style={{ background: "var(--color-background-primary)", padding: "0 8px", position: "relative", zIndex: 1 }}>
        or paste text / XML below
      </span>
      <div style={{
        position: "absolute", top: "50%", left: 0, right: 0,
        height: "0.5px", background: "var(--color-border-tertiary)", zIndex: 0,
      }} />
    </div>
  );
}
