#!/usr/bin/env bash
# Opens Chrome to the extensions page and prints the folder to "Load unpacked".
set -euo pipefail
EXT_DIR="$(cd "$(dirname "$0")" && pwd)"
echo ""
echo "━━━━━━━━ Manta Pilot Bridge — Chrome setup ━━━━━━━━"
echo ""
echo "1) In the Chrome tab that just opened, turn ON \"Developer mode\" (top right)."
echo "2) Click \"Load unpacked\"."
echo "3) Select this folder (copy path below):"
echo ""
echo "   $EXT_DIR"
echo ""
echo "4) Click the extension pin if you want it on the toolbar."
echo "5) Start the pilot: cd ../react-pilot && npm run dev  →  then set Pilot URL to http://localhost:5173"
echo ""
if [[ "$(uname)" == "Darwin" ]]; then
  if open -a "Google Chrome" "chrome://extensions/" 2>/dev/null; then
    echo "(Opened Google Chrome → Extensions.)"
  elif open -a "Chromium" "chrome://extensions/" 2>/dev/null; then
    echo "(Opened Chromium → Extensions.)"
  elif open -a "Arc" "chrome://extensions/" 2>/dev/null; then
    echo "(Opened Arc → Extensions — Chromium-based, should work.)"
  else
    echo "Could not open Chrome automatically. Open this URL manually: chrome://extensions"
  fi
else
  xdg-open "chrome://extensions" 2>/dev/null || sensible-browser "chrome://extensions" 2>/dev/null || true
  echo "If nothing opened, visit: chrome://extensions"
fi
echo ""
