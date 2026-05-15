import React from 'react';
import { ChevronRight, CheckCircle, AlertTriangle, XCircle, Sparkles } from 'lucide-react';
import PreviewVerificationTierStrip from './PreviewVerificationTierStrip.jsx';

/**
 * MantaCommandCenter — The 'One-Stop Shop' metadata pipeline.
 * Categorizes issues by step, shows readiness score, and provides jump-to-field navigation.
 */
export default function MantaCommandCenter({
  issues = [],
  stepGroups = [],
  score = 0,
  validationPrimed = false,
  allClear = false,
  formClear = false,
  errors = [],
  previewVerification = {},
  onJumpToIssue,
  onMagicFixAll,
  onPushToComet,
  pushBusy = false,
}) {
  return (
    <div className="cmd-center-hub">

      {/* Tier pills + Score Ring */}
      <div className="cmd-center-hub__header">
        <PreviewVerificationTierStrip variant="cmd-center" />
        <div className="cmd-center-hub__score">
          <div className="cmd-center-score-ring">
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="2" />
              <circle
                cx="16" cy="16" r="14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${(score / 100) * 88} 88`}
                strokeLinecap="round"
                className={score >= 80 ? 'text-teal-400' : score >= 50 ? 'text-amber-400' : 'text-red-400'}
                style={{ transition: 'stroke-dasharray 0.8s ease-out', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
            <span className="cmd-center-score-num">{score}</span>
          </div>
        </div>
      </div>

      {/* Issue List */}
      <div className="cmd-center-hub__issues">
        {!validationPrimed ? (
          <div className="cmd-center-hub__empty">
            <Sparkles size={16} className="text-slate-500" />
            <p className="cmd-center-hub__idle">Validation starts after you import or edit a field.</p>
          </div>
        ) : allClear ? (
          <div className="cmd-center-hub__empty">
            <CheckCircle size={16} className="text-teal-400" />
            <p className="cmd-center-hub__all-clear">✓ All checks pass — ready to publish</p>
          </div>
        ) : (
          stepGroups.map(({ step, idx, issues: stepIssues }) => (
            <div key={step.id} className="cmd-center-step-group">
              <div className="cmd-center-step-label">
                <span className="cmd-center-step-num">0{idx + 1}</span>
                {step.label.toUpperCase()}
              </div>
              {stepIssues.map((iss, i) => (
                <div
                  key={`${iss.field}-${i}`}
                  className={`cmd-center-issue-card ${iss.severity === 'e' ? 'cmd-center-issue-card--err' : 'cmd-center-issue-card--warn'}`}
                  onClick={() => onJumpToIssue(iss.field)}
                >
                  <span className="cmd-center-issue-card__icon" aria-hidden>
                    {iss.severity === 'e' ? <XCircle size={12} /> : <AlertTriangle size={12} />}
                  </span>
                  <div className="cmd-center-issue-card__body">
                    <div className="cmd-center-issue-card__field">{iss.field}</div>
                    <div className="cmd-center-issue-card__msg">{iss.message}</div>
                  </div>
                  <button
                    type="button"
                    className="cmd-center-issue-card__jump"
                    aria-label="Jump to field"
                  >
                    <ChevronRight size={14} />
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Action Footer */}
      <div className="cmd-center-hub__cta">
        {issues.length > 0 && (
          <button 
            className="cmd-center-export-btn"
            onClick={onMagicFixAll}
            title="Auto-fix common errors"
          >
            <Sparkles size={14} />
            <span>Magic Fix</span>
          </button>
        )}
        <button
          type="button"
          className={`cmd-center-cta-btn ${allClear ? 'cmd-center-cta-btn--ready' : 'cmd-center-cta-btn--blocked'}`}
          onClick={allClear ? onPushToComet : undefined}
          disabled={pushBusy}
        >
          {pushBusy
            ? 'Pushing…'
            : allClear
              ? '↑ Push to CoMET'
              : !formClear
                ? `Resolve ${errors.length} error${errors.length !== 1 ? 's' : ''}`
                : !previewVerification.previewXmlReady
                  ? 'Fix XML verification'
                  : '↑ Push to CoMET'}
        </button>
      </div>
    </div>
  );
}
