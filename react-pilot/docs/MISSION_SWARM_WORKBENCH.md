# Mission profile — Swarm ↔ workbench matrix

This doc ties **SWARM-A … SWARM-F** ([SWARM_IMPLEMENTATION_BOARD.md](./SWARM_IMPLEMENTATION_BOARD.md)) to the **mission** entity profile and the **React pilot** shell/lens/validator UX. Use it for parallel agent splits and demo QA.

**Source of truth — mission steps and field ownership:** [`src/profiles/mission/missionProfile.js`](../src/profiles/mission/missionProfile.js) (`missionSteps`, `ownedFieldPrefixes`).

---

## SWARM lanes × mission (today vs north star)

| Lane | Role | Mission in the **current** pilot | Mission after **SWARM-F** |
|------|------|-----------------------------------|---------------------------|
| **A** | Schema guardrails | CSV/schemas under `schemas/`; mission validation still driven by profile rule sets + `ValidationEngine`. | Row schemas validated before compile. |
| **B** | Compiler / merge | Mission rules live in code (`missionValidationRules`); not yet replaced by `compiled_rules/` bundles for mission-only. | Compiled bundles keyed by record type include **mission**. |
| **C** | Condition engine | Rules evaluated inside engine; limited explain metadata vs SWARM spec. | Rich `matched` / `reason` on each evaluation. |
| **D** | Ingestion + mapping QA | Issues keyed by dot-paths (`mission.*` … `distribution.*`). | Every blocking rule has field maps to canonical keys. |
| **E** | Golden regression | Partial coverage via `verify:pilot` / fixtures; mission NOAA template in tests. | Dedicated golden cases with expected issue IDs for mission. |
| **F** | Workbench integration | Lens + validator use **`validationEngine.run({ profile, state, mode })`**; autofix via `manta:pilot-auto-fix-request`. | Same UI surface + compiled rules, lane verdicts, autofix audit export. |

---

## Wizard steps × workbench features (checklist)

Columns: **V** = validator issues for paths in step; **L** = lens inline glass (STEP scope); **S** = lens section bar hotspot; **W** = fix walk (`buildFixGuideQueue`); **X** = XML preview / SECTION_XML_TERMS alignment.

| Step | `id` | `ownedFieldPrefixes` | V | L | S | W | X |
|------|------|----------------------|---|---|---|---|---|
| 1 | `mission` | `mission.`, `mission` | ✓ | ✓ | ✓ | ✓ | identification / citation |
| 2 | `platform` | `platform.` | ✓ | ✓ | ✓ | ✓ | platform / acquisition |
| 3 | `sensors` | `sensors`, `sensors[` | ✓ | ✓ | ✓ | ✓ | instrument |
| 4 | `spatial` | `spatial.` | ✓ | ✓ | ✓ | ✓ | extent / bbox |
| 5 | `keywords` | `keywords`, `keywords.` | ✓ | ✓ | ✓ | ✓ | MD_Keywords / anchors |
| 6 | `distribution` | `distribution.` | ✓ | ✓ | ✓ | ✓ | distribution / online resource |

**Shared (all steps):**

- **ReadinessStrip** + readiness bundles on profile (`readinessBundles`); mode changes → `manta:set-validation-mode`.
- **Lens HUD:** score, tags, STEP/ALL scope, ERR/WRN filter, **Fix Issues →**, collapse strip.
- **Issues tray:** chips **Why?** / **Safe defaults** (`getLensChipsForIssue`).
- **Whole-record auto-fix:** `manta:pilot-auto-fix-request` (not step-scoped).
- **Ask / definitions:** `getFieldDefinition`, ASK tab — any field path.

Routing without hardcoded switches: **`WorkflowEngine`** uses `ownedFieldPrefixes` → `manta:goto-step` during fix walk.

---

## Parallel assignment — mission-focused slices

Map onto [Suggested Parallel Assignment](./SWARM_IMPLEMENTATION_BOARD.md#suggested-parallel-assignment):

| Agent lane | Mission-heavy deliverables |
|------------|----------------------------|
| **1 (A+B)** | Compile pipeline outputs bundles that include **`mission`** record type; schema validates mission-bound CSV rows. |
| **2 (C)** | Condition fixtures using **mission** `pilotState` shapes (bbox, keywords, URLs). |
| **3 (D)** | Field-map QA for paths under **`mission.` … `distribution.`** only first; extend to collection/granule later. |
| **4 (E+F)** | Golden mission JSON/XML fixtures + hook **`compiled_rules`** into same validation entry point the lens uses today. |

---

## Scripted demo (mission / UxS)

1. Load **mission** profile wizard → enable **Lens** → set inline scope to **STEP**.
2. Introduce one invalid **spatial** value → confirm **glass** + **section bar** + **validator** agree on path under `spatial.*`.
3. Start **Fix walk** → confirm navigation fires **`manta:goto-step`** to **4. Spatial** and XML/form highlight stays in sync.
4. Toggle lenient → strict → confirm issue set and score update.
5. **North star:** SWARM-F shows lane verdict + rule trace next to the same issue row without changing step IDs.

---

## Related code paths

| Concern | Entry |
|---------|--------|
| Lens HUD + fix walk | [`src/shell/AssistantShell.jsx`](../src/shell/AssistantShell.jsx) |
| Wizard shell + auto-fix + field set | [`src/shell/WizardShell.jsx`](../src/shell/WizardShell.jsx) |
| Fix queue | [`src/lib/lensFixGuide.js`](../src/lib/lensFixGuide.js) |
| Tray chips | [`src/lib/lensIssueChips.js`](../src/lib/lensIssueChips.js) |
