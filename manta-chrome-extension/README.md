# Manta Pilot Bridge (Chrome extension)

Minimal **Manifest V3** extension to:

- Open your **React pilot** (default `http://127.0.0.1:5173`) in a new tab  
- Optionally show a **floating “M” capture button** (bottom-right) on normal `http` / `https` pages  
- Capture the current **selection**, visible page text, XML/source text, or a local dropped file into Manta
- Still copy the current text selection when you only want clipboard handoff

## Load unpacked (developer mode)

1. Open Chrome → `chrome://extensions`  
2. Turn on **Developer mode** (top right)  
3. **Load unpacked** → select this folder: `manta-chrome-extension`  
4. Pin the extension from the puzzle icon if you want toolbar access  

## Try it

1. Run the pilot: `cd react-pilot && npm run dev -- --host 127.0.0.1` (`http://127.0.0.1:5173`)  
2. Open any website, click the extension icon → **Capture selection → Manta**, **Capture page → Manta**, or **Capture XML/source → Manta**
3. Drop a local XML / JSON / CSV / TXT file into the popup to send it to the pilot
4. Or enable **Show floating launcher** → reload the page → click the cyan **M** button to capture that page

## How capture works

- XML-looking captures open the pilot's XML import drawer.
- Raw page or selection text opens the scanner dialog and runs the Manta heuristic.
- Scanner envelope JSON opens the scanner dialog directly.
- Captures are stored briefly in `chrome.storage.local`, delivered to the pilot tab, then removed.

## GFE / locked browsers

- Your org may block arbitrary extensions or `localhost`; use an **allowlisted** deployed pilot URL in the popup instead of localhost.  
- Capture needs a normal web page tab (not `chrome://`).
- Reload the unpacked extension after editing extension files.

## Permissions

- **storage** — save pilot URL and FAB toggle  
- **tabs**, **activeTab**, **scripting** — open pilot tab, read selection  
- **host_permissions** `http://*/*`, `https://*/*` — inject the optional FAB on web pages  

Narrow `host_permissions` in `manifest.json` if your security team prefers (e.g. only your pilot origin + one intranet pattern).
