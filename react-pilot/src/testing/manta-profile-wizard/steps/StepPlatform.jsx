import React, { useState } from "react";
import { ScannerBar, LookupRow, StepNavBar } from "../ProfileWizard";

/**
 * StepPlatform — UxS profile
 * ---------------------------
 * Platform identification: hull ID, WMO code, platform type, operator org (ROR).
 * Pre-fills from classifier prefill data (e.g. filename pattern extraction).
 *
 * Uses the shared pilotState pattern — calls onFieldChange with a patch object
 * on every meaningful change. The parent ProfileWizard merges it into pilotState.
 */
export default function StepPlatform({
  profile,
  pilotState,
  stepIdx,
  onFieldChange,
  onNext,
  onBack,
}) {
  // Pull prefill from classifier or existing pilotState
  const pre = profile.prefill?.platform ?? {};

  const [platformName, setPlatformName] = useState(
    pilotState.platformName ?? pre.platformName ?? ""
  );
  const [platformType, setPlatformType] = useState(
    pilotState.platformType ?? pre.platformType ?? ""
  );
  const [hullId, setHullId] = useState(
    pilotState.hullId ?? pre.hullId ?? ""
  );
  const [wmoCode, setWmoCode] = useState(pilotState.wmoCode ?? "");
  const [orgName, setOrgName] = useState(pilotState.orgName ?? "");
  const [manufacturer, setManufacturer] = useState(pilotState.manufacturer ?? "");
  const [serial, setSerial] = useState(pilotState.serial ?? "");

  const isPrefilled = (val, preVal) => val && val === preVal;

  const sync = (patch) => {
    onFieldChange(patch);
  };

  const hasPrev = stepIdx > 0;
  const prevLabel = hasPrev ? profile.steps[stepIdx - 1].label : "";

  const PLATFORM_TYPES = [
    "AUV — autonomous underwater vehicle",
    "UUV — unmanned underwater vehicle",
    "USV — surface vehicle",
    "UAS — aerial system",
    "Glider",
    "Saildrone",
    "Wave glider",
    "Seafloor lander",
    "Other UxS",
  ];

  return (
    <div>
      <h3 className="step-title">Platform identification</h3>
      <p className="step-subtitle">
        Identify the uncrewed system — hull ID, WMO/OceanOPS registration, and
        platform type
      </p>

      <ScannerBar stepLabel="Platform" profileLabel={profile.label} />

      {/* Row: Platform name + type */}
      <div className="field-row field-row--half">
        <div>
          <label className="field-label">
            Platform name
            <span className="required">*</span>
            {isPrefilled(platformName, pre.platformName) && (
              <span className="prefill-badge">✓ prefilled</span>
            )}
          </label>
          <input
            type="text"
            className={isPrefilled(platformName, pre.platformName) ? "input--prefilled" : ""}
            value={platformName}
            placeholder="e.g. Sentry AUV"
            onChange={(e) => {
              setPlatformName(e.target.value);
              sync({ platformName: e.target.value });
            }}
          />
          {isPrefilled(platformName, pre.platformName) && (
            <p className="field-hint">✓ Extracted from filename</p>
          )}
        </div>
        <div>
          <label className="field-label">
            Platform type
            <span className="required">*</span>
          </label>
          <select
            className={platformType ? "input--prefilled" : ""}
            value={platformType}
            onChange={(e) => {
              setPlatformType(e.target.value);
              sync({ platformType: e.target.value });
            }}
          >
            <option value="">— select —</option>
            {PLATFORM_TYPES.map((t) => (
              <option key={t} value={t.split(" — ")[0]}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Row: Hull ID + WMO code */}
      <div className="field-row field-row--half">
        <div>
          <label className="field-label">
            Hull / operator ID
            {isPrefilled(hullId, pre.hullId) && (
              <span className="prefill-badge">✓ prefilled</span>
            )}
          </label>
          <input
            type="text"
            className={isPrefilled(hullId, pre.hullId) ? "input--prefilled" : ""}
            value={hullId}
            placeholder="e.g. SD1043 · REMUS-6000-04"
            onChange={(e) => {
              setHullId(e.target.value);
              sync({ hullId: e.target.value });
            }}
          />
          <p className="field-hint">Operator-assigned identifier</p>
        </div>
        <div>
          <label className="field-label">WMO platform code</label>
          <LookupRow
            btnLabel="OceanOPS"
            onLookup={() =>
              window.sendPrompt?.(
                `Look up WMO platform code in OceanOPS for platform: ${platformName || "this UxS"}`
              )
            }
          >
            <input
              type="text"
              value={wmoCode}
              placeholder="e.g. 3901234"
              onChange={(e) => {
                setWmoCode(e.target.value);
                sync({ wmoCode: e.target.value });
              }}
            />
          </LookupRow>
          <p className="field-hint">Register at OceanOPS if absent</p>
        </div>
      </div>

      {/* Operator org with ROR lookup */}
      <div className="field-row">
        <label className="field-label">
          Operator / owner organization
          <span className="required">*</span>
        </label>
        <LookupRow
          btnLabel="ROR"
          onLookup={() =>
            window.sendPrompt?.(
              `Look up ROR organization ID for: ${orgName || "the UxS platform operator"}`
            )
          }
        >
          <input
            type="text"
            value={orgName}
            placeholder="Search organization name…"
            onChange={(e) => {
              setOrgName(e.target.value);
              sync({ orgName: e.target.value });
            }}
          />
        </LookupRow>
        <p className="field-hint">
          ROR ID will be auto-resolved — do not enter free text for submission
        </p>
      </div>

      {/* Manufacturer + serial */}
      <div className="field-row field-row--half">
        <div>
          <label className="field-label">Manufacturer</label>
          <input
            type="text"
            value={manufacturer}
            placeholder="e.g. WHOI · Teledyne · Saildrone Inc."
            onChange={(e) => {
              setManufacturer(e.target.value);
              sync({ manufacturer: e.target.value });
            }}
          />
        </div>
        <div>
          <label className="field-label">Serial number</label>
          <input
            type="text"
            value={serial}
            placeholder="Manufacturer serial"
            onChange={(e) => {
              setSerial(e.target.value);
              sync({ serial: e.target.value });
            }}
          />
        </div>
      </div>

      <StepNavBar
        hasPrev={hasPrev}
        hasNext
        prevLabel={prevLabel}
        nextLabel="Mission"
        onPrev={onBack}
        onNext={onNext}
      />
    </div>
  );
}
