import React from 'react';
import { Sparkles, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

/**
 * MantaBarFloatingDock — A sleek, translucent floating HUD (The "Manta Bar").
 * Positioned at the bottom center of the viewport.
 */
export default function MantaBarFloatingDock({
  score = 0,
  t1Status = 'pending', // 'ok' | 'err' | 'pending'
  t2Status = 'pending',
  t3Status = 'pending',
  issueCount = 0,
  onMagicFix,
  onOpenLens,
  active = false,
}) {
  const getStatusColor = (status) => {
    switch (status) {
      case 'ok': return 'bg-teal-500/20 text-teal-400 border-teal-500/30';
      case 'err': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'warn': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      default: return 'bg-slate-800/50 text-slate-500 border-slate-700/50';
    }
  };

  const getScoreColor = (s) => {
    if (s >= 80) return 'text-teal-400';
    if (s >= 50) return 'text-amber-400';
    return 'text-red-400';
  };

  if (!active) return null;

  return (
    <div className="manta-bar-floating-dock-container">
      <div className="manta-bar-floating-dock">
        {/* Readiness Score */}
        <div className="manta-bar-floating-dock__score" onClick={onOpenLens}>
          <div className="manta-bar-floating-dock__score-ring">
            <svg width="40" height="40" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
              <circle
                cx="20" cy="20" r="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeDasharray={`${(score / 100) * 113} 113`}
                strokeLinecap="round"
                className={getScoreColor(score)}
                style={{ transition: 'stroke-dasharray 1s ease-out', transform: 'rotate(-90deg)', transformOrigin: 'center' }}
              />
            </svg>
            <span className={`manta-bar-floating-dock__score-num ${getScoreColor(score)}`}>{score}</span>
          </div>
          <div className="manta-bar-floating-dock__label-stack">
            <span className="manta-bar-floating-dock__label-top">READINESS</span>
            <span className="manta-bar-floating-dock__label-sub">CONFIDENCE</span>
          </div>
        </div>

        <div className="manta-bar-floating-dock__divider" />

        {/* 3-Tier Pills */}
        <div className="manta-bar-floating-dock__pills">
          <div className={`manta-bar-floating-dock__pill ${getStatusColor(t1Status)}`}>
            <span className="manta-bar-floating-dock__pill-tag">T1</span>
            <span className="manta-bar-floating-dock__pill-label">WF</span>
          </div>
          <div className={`manta-bar-floating-dock__pill ${getStatusColor(t2Status)}`}>
            <span className="manta-bar-floating-dock__pill-tag">T2</span>
            <span className="manta-bar-floating-dock__pill-label">STRICT</span>
          </div>
          <div className={`manta-bar-floating-dock__pill ${getStatusColor(t3Status)}`}>
            <span className="manta-bar-floating-dock__pill-tag">T3</span>
            <span className="manta-bar-floating-dock__pill-label">COMET</span>
          </div>
        </div>

        <div className="manta-bar-floating-dock__divider" />

        {/* Action Buttons */}
        <div className="manta-bar-floating-dock__actions">
          {issueCount > 0 && (
            <button
              className="manta-bar-floating-dock__btn manta-bar-floating-dock__btn--magic"
              onClick={onMagicFix}
            >
              <Sparkles size={16} />
              <span>Magic Fix All</span>
            </button>
          )}
          <button
            className="manta-bar-floating-dock__btn manta-bar-floating-dock__btn--lens"
            onClick={onOpenLens}
          >
            <span>⬡ LENS</span>
          </button>
        </div>
      </div>
    </div>
  );
}
