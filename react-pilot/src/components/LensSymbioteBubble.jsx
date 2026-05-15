import React, { useState, useEffect } from 'react';
import { Sparkles, Info, AlertCircle, X } from 'lucide-react';

/**
 * LensSymbioteBubble — A glowing teal "Lens Bubble" that appears next to the cursor/active field.
 */
export default function LensSymbioteBubble({
  active = false,
  field = '',
  issues = [],
  suggestions = [],
  onMagicFix,
  onClose,
  anchorRect = null, // The DOMRect of the focused field
}) {
  const [style, setStyle] = useState({ opacity: 0, transform: 'scale(0.9) translateY(10px)' });

  useEffect(() => {
    if (active && anchorRect) {
      // Calculate position: right of the field, or centered below if no room
      const top = anchorRect.top + window.scrollY;
      const left = anchorRect.right + 12;
      
      setStyle({
        opacity: 1,
        transform: 'scale(1) translateY(0)',
        top: `${top}px`,
        left: `${left}px`,
      });
    } else {
      setStyle({ opacity: 0, transform: 'scale(0.9) translateY(10px)' });
    }
  }, [active, anchorRect]);

  if (!active || issues.length === 0) return null;

  const mainIssue = issues[0];

  return (
    <div 
      className="manta-lens-bubble"
      style={{
        position: 'absolute',
        zIndex: 2000,
        pointerEvents: 'auto',
        ...style,
        transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
      }}
    >
      <div className="manta-lens-bubble__content">
        <div className="manta-lens-bubble__header">
          <div className="manta-lens-bubble__brand">
            <div className="manta-lens-bubble__icon-ring">
              <Sparkles size={12} className="text-teal-400" />
            </div>
            <span>MANTA LENS</span>
          </div>
          <button onClick={onClose} className="manta-lens-bubble__close">
            <X size={14} />
          </button>
        </div>

        <div className="manta-lens-bubble__body">
          <div className="manta-lens-bubble__insight">
            <Info size={14} className="text-teal-400 shrink-0" />
            <p>{mainIssue.message}</p>
          </div>

          {suggestions.length > 0 && (
            <div className="manta-lens-bubble__suggestion">
              <Sparkles size={14} className="text-purple-400 shrink-0" />
              <p>{suggestions[0]}</p>
            </div>
          )}
        </div>

        <div className="manta-lens-bubble__footer">
          <button 
            className="manta-lens-bubble__btn-fix"
            onClick={() => onMagicFix(field)}
          >
            <Sparkles size={14} />
            <span>Magic Fix</span>
          </button>
        </div>
      </div>
      <div className="manta-lens-bubble__arrow" />
    </div>
  );
}
