# Manta — mission wizard end-user form tests

**Rules**

1. **Every wizard form** (steps **1–6** below) must be exercised: open step → controls render → edit → validation responds → XML preview reflects changes.
2. **Every XML file** in `samples/` must be run through **Import XML** on this profile, then **steps 1→6** reviewed with that imported state (no skipping files). Spot-checking one fixture is not sufficient.

**Profile:** UxS **Mission / Dataset** (`mission` profile). Wizard steps: **1 Mission → 2 Platform → 3 Sensors → 4 Spatial → 5 Keywords → 6 Distribution**.

**Corpus vs tiebreaker:** **`samples/*.xml`** is the **required import corpus** (every file tested). **`output-from-manta/`** holds captured previews for regression compares.  

**Settling metadata disagreements:** Use **`reference/ncei-collection-metadata/`** (NCEI AB-GUID PDF + `ncei_template-clean.xml`) when reviewers disagree on correct ISO shape, NCEI contact/citation patterns, or collection-level expectations—see `reference/ncei-collection-metadata/README.md`.

**ISO 19115-2 lineup (automated):** From `react-pilot/` run `npm run audit:manta-samples`. That imports every `samples/*.xml`, merges, runs validation (lenient + strict counts), and checks **Manta preview XML** against the same ISO-19115-2 structural bar as `verify-pilot` (`gmi:MI_Metadata`, bbox `gco:Decimal`, etc.). Results: `reports/manta-samples-iso2-audit.md` + `.json`. Use this before manual UI upload passes to see **where validation fails** per file; UI testing still required for form behavior.

---

## Per-sample XML — import pass (required)

For **each** row: **Import** the file → confirm parse completes (note blocking errors/toasts) → walk **Forms 1–6** (sections populate sensibly for that record) → note anomalies.

| `samples/` file | Hint | Pass |
|-----------------|------|------|
| `0299833.xml` | NODC-style ISO (gmi); fileIdentifier `gov.noaa.nodc:0299833` | ☐ |
| `AFSC_GA13_Raw_Data.xml` | NCEI PAD AFSC GA13 raw data record | ☐ |
| `C01531.xml` | NCDC catalog-style identifier | ☐ |
| `C01678.xml` | NCDC catalog-style identifier (larger record) | ☐ |
| `EX1904_collection.xml` | OER collection (`hierarchyLevel` collection); expect partial mapping to mission wizard | ☐ |
| `EX2306_COLLECTION.xml` | Large collection export; stress parse + UI | ☐ |
| `gov.noaa.nmfs.inport.52208.xml` | NMFS InPort ISO export | ☐ |
| `gov.noaa.nmfs.inport.5619.xml` | NMFS InPort ISO export | ☐ |
| `gov.noaa.nmfs.inport.5687.xml` | NMFS InPort ISO export | ☐ |
| `gov.noaa.nmfs.inport.62654.xml` | NMFS InPort ISO export | ☐ |
| `ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml` | ISO 19115-3 (`MD_Metadata`); schema path differs from default preview | ☐ |
| `ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml` | Same lineage, alternate timestamp export | ☐ |
| `LISTEN_GoMex_Raw_Audio.xml` | GOMAP / LISTEN GoMex audio dataset style | ☐ |
| `NCRMP-Benthic-FG.xml` | NCRMP benthic survey footprint | ☐ |
| `NCRMP-Socio-Guam.xml` | NCRMP socio Guam record | ☐ |
| `NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml` | Navy UXS / MDBC PS2418 UxS acquisition (mdb namespace) | ☐ |
| `NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml` | Same campaign, AUV03 variant | ☐ |
| `NRS_Raw_Data.xml` | NRS raw data style ISO | ☐ |
| `SAMPLE_Populated.xml` | Pack sample populated XML | ☐ |
| `uxs_test.xml` | Large UxS-oriented test record | ☐ |

**Sample XML count:** 20 — all rows above must be ☑ before sign-off. If you add or remove files under `samples/`, update this table and the count.

---

## Form 1 — Mission (`step` id: `mission`)

| # | Check | Pass |
|---|--------|------|
| 1.1 | Navigate to **1. Mission**; panel loads with **UxS collection context**, **Identification**, citation/contact sections | ☐ |
| 1.2 | **Import** a fixture (e.g. MDBC PS2418); **file ID**, title, abstract, dates, contacts populate sensibly | ☐ |
| 1.3 | Edit **fileIdentifier**, **title**, **abstract**; blur/tab away — state holds when switching steps | ☐ |
| 1.4 | Toggle or fill **temporal** fields (start/end, interval unit/value if shown) — no console errors | ☐ |
| 1.5 | **Validation:** leave required mission field empty or invalid — issue appears for `mission.*` scope | ☐ |
| 1.6 | **XML preview** shows updated mission blocks (identification, extent hooks, contacts as applicable) | ☐ |

---

## Form 2 — Platform (`platform`)

| # | Check | Pass |
|---|--------|------|
| 2.1 | Navigate to **2. Platform**; platform fields visible | ☐ |
| 2.2 | After import, **platform ID**, name/type/description/manufacturer** reflect XML | ☐ |
| 2.3 | Edit platform fields; return to Mission and back — values persist | ☐ |
| 2.4 | If host supports it: **save/load platform library** (`/api/db`) — optional row | ☐ |
| 2.5 | **Validation:** platform-required rules fire when applicable | ☐ |
| 2.6 | **XML preview** includes platform / instrument carrier blocks as generated | ☐ |

---

## Form 3 — Sensors (`sensors`)

| # | Check | Pass |
|---|--------|------|
| 3.1 | Navigate to **3. Sensors**; at least one sensor row renders | ☐ |
| 3.2 | Import populates sensor **type**, **model**, **variable** where present in XML | ☐ |
| 3.3 | Add or duplicate row (if UI allows); edit **sensor ID**, firmware/mode fields — save state | ☐ |
| 3.4 | Remove extra test row — count and preview update | ☐ |
| 3.5 | **Validation:** sensor row errors address `sensors[…]` paths | ☐ |
| 3.6 | **XML preview** reflects sensor acquisition / instrument sections | ☐ |

---

## Form 4 — Spatial (`spatial`)

| # | Check | Pass |
|---|--------|------|
| 4.1 | Navigate to **4. Spatial**; bbox / vertical / lineage UI loads | ☐ |
| 4.2 | Import fills **W/E/S/N** (and vertical fields if present) | ☐ |
| 4.3 | Change bbox numbers — map or numeric controls stay in sync if applicable | ☐ |
| 4.4 | Edit **lineage** / **quality** text areas — content retained | ☐ |
| 4.5 | **Validation:** bbox numeric / ordering rules; spatial strict messages | ☐ |
| 4.6 | **XML preview** geographic description / bounding polygon elements update | ☐ |

---

## Form 5 — Keywords (`keywords`)

| # | Check | Pass |
|---|--------|------|
| 5.1 | Navigate to **5. Keywords**; GCMD facets (science, platform, instrument, etc.) visible | ☐ |
| 5.2 | Import loads keyword chips / labels where parsed | ☐ |
| 5.3 | Add or edit a keyword chip — merge behavior matches expectation (no duplicate UUID confusion) | ☐ |
| 5.4 | **Validation:** keyword UUID / facet warnings when in lenient/catalog modes | ☐ |
| 5.5 | **XML preview** shows `gmx:Anchor` or equivalent for anchored keywords | ☐ |

---

## Form 6 — Distribution (`distribution`)

| # | Check | Pass |
|---|--------|------|
| 6.1 | Navigate to **6. Distribution**; format, license, URLs, fees, maintenance fields visible | ☐ |
| 6.2 | Import fills **landing**, **download**, distributor contacts where XML provides them | ☐ |
| 6.3 | Edit **license**, **fees**, **ordering** text — preview updates | ☐ |
| 6.4 | **Validation:** http(s) URL rules, metadata standard/version consistency | ☐ |
| 6.5 | **XML preview** distribution / transfer / constraints sections coherent | ☐ |
| 6.6 | Optional host checks: **GeoJSON / DCAT** export actions when `/api/db` enabled | ☐ |

---

## Cross-form checks (after all six pass)

| # | Check | Pass |
|---|--------|------|
| X.1 | **Step order:** 1→6 forward and 6→1 backward without losing edits | ☐ |
| X.2 | **Modes:** switch lenient / strict / catalog — issue counts change logically | ☐ |
| X.3 | **Import replaced state:** second import replaces prior values without stale merge | ☐ |
| X.4 | **Automated gate:** `cd react-pilot && npm run verify:pilot` passes on release candidate | ☐ |

---

## Sign-off

| Tester | Date | Environment (URL / build) |
|--------|------|-----------------------------|
| | | |

**All six forms + cross-form:** ☐ Yes  

**All 20 `samples/*.xml` import passes:** ☐ Yes  

**Notes:**
