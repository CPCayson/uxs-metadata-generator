# MANTA samples — import audit & ISO 19115-2 preview alignment

Generated: 2026-05-15T15:10:57.655Z
Samples: `MANTA End User Testing/samples` (repo-relative)

For each file: **source shape** (root XML), **import/merge** pipeline, **validation** counts after auto-fix (lenient / strict / **catalog**), **ISO-19115-2 preview sanity**, **preview→import round-trip** (`buildXmlPreview` output fed back through `importPilotPartialStateFromXml`), and **xmllint --noout** when installed.

Empty **ISO-2 preview fails** means Manta’s emitted preview matches that structural bar for that loaded state.

**Wizard coverage:** The validator runs on the **full merged state** (same as saving after visiting every step). There is no separate “click every control” pass — use **per-step issue tallies** below to see which sections still fail.

**Per-field validation:** Issues are grouped by **wizard step** using the same field-prefix ownership as the mission profile (`mission` / `platform` / `sensors` / `spatial` / `keywords` / `distribution`); paths that do not match any step prefix appear under **`other`** (e.g. catalog `ident.*` rules).

| File | Source XML shape | Import ok | Merge ok | Lenient E/W | Strict E/W | Catalog E/W | RT | xmllint | ISO-2 preview fails |
|------|------------------|-----------|----------|-------------|------------|-------------|----|---------|---------------------|
| 0299833.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/2 | 1/2 | 2/2 | yes | ok | — |
| AFSC_GA13_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/6 | 1/6 | 3/6 | yes | ok | — |
| C01531.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/17 | 1/17 | 4/17 | yes | ok | — |
| C01678.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/13 | 0/13 | 3/13 | yes | ok | — |
| EX1904_collection.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/76 | 1/76 | 5/76 | yes | ok | — |
| EX2306_COLLECTION.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/52 | 1/52 | 5/52 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 0/0 | 2/0 | 6/0 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 0/0 | 2/0 | 6/0 | yes | ok | — |
| LISTEN_GoMex_Raw_Audio.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/7 | 1/7 | 5/7 | yes | ok | — |
| NCRMP-Benthic-FG.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/69 | 0/69 | 3/69 | yes | ok | — |
| NCRMP-Socio-Guam.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/27 | 0/27 | 3/27 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | ISO 19115-3 (mdb / -3) | yes | yes | 0/2 | 1/2 | 5/2 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | ISO 19115-3 (mdb / -3) | yes | yes | 0/2 | 1/2 | 5/2 | yes | ok | — |
| NRS_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/8 | 0/8 | 2/8 | yes | ok | — |
| SAMPLE_Populated.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/11 | 0/11 | 0/11 | yes | ok | — |
| gov.noaa.nmfs.inport.52208.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/21 | 2/20 | 5/20 | yes | ok | — |
| gov.noaa.nmfs.inport.5619.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/16 | 2/15 | 6/15 | yes | ok | — |
| gov.noaa.nmfs.inport.5687.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/15 | 2/14 | 6/14 | yes | ok | — |
| gov.noaa.nmfs.inport.62654.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/43 | 2/42 | 6/42 | yes | ok | — |
| uxs_test.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/93 | 1/93 | 4/93 | yes | ok | — |

## Per-step issue counts (lenient)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:0e/1w · keywords:0e/1w |
| AFSC_GA13_Raw_Data.xml | keywords:0e/6w |
| C01531.xml | mission:0e/1w · keywords:0e/16w |
| C01678.xml | mission:0e/1w · keywords:0e/12w |
| EX1904_collection.xml | keywords:0e/76w |
| EX2306_COLLECTION.xml | keywords:0e/52w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | — |
| LISTEN_GoMex_Raw_Audio.xml | mission:0e/1w · keywords:0e/6w |
| NCRMP-Benthic-FG.xml | mission:0e/1w · keywords:0e/68w |
| NCRMP-Socio-Guam.xml | keywords:0e/27w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:0e/1w · keywords:0e/1w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:0e/1w · keywords:0e/1w |
| NRS_Raw_Data.xml | keywords:0e/8w |
| SAMPLE_Populated.xml | mission:0e/1w · keywords:0e/10w |
| gov.noaa.nmfs.inport.52208.xml | mission:0e/2w · keywords:0e/19w |
| gov.noaa.nmfs.inport.5619.xml | mission:0e/2w · keywords:0e/14w |
| gov.noaa.nmfs.inport.5687.xml | mission:0e/2w · keywords:0e/13w |
| gov.noaa.nmfs.inport.62654.xml | mission:0e/1w · keywords:0e/42w |
| uxs_test.xml | mission:0e/1w · keywords:0e/92w |

## Per-step issue counts (strict)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:1e/1w · keywords:0e/1w |
| AFSC_GA13_Raw_Data.xml | mission:1e/0w · keywords:0e/6w |
| C01531.xml | mission:1e/1w · keywords:0e/16w |
| C01678.xml | mission:0e/1w · keywords:0e/12w |
| EX1904_collection.xml | mission:1e/0w · keywords:0e/76w |
| EX2306_COLLECTION.xml | mission:1e/0w · keywords:0e/52w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | mission:2e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | mission:2e/0w |
| LISTEN_GoMex_Raw_Audio.xml | mission:1e/1w · keywords:0e/6w |
| NCRMP-Benthic-FG.xml | mission:0e/1w · keywords:0e/68w |
| NCRMP-Socio-Guam.xml | keywords:0e/27w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:1e/1w · keywords:0e/1w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:1e/1w · keywords:0e/1w |
| NRS_Raw_Data.xml | keywords:0e/8w |
| SAMPLE_Populated.xml | mission:0e/1w · keywords:0e/10w |
| gov.noaa.nmfs.inport.52208.xml | mission:2e/1w · keywords:0e/19w |
| gov.noaa.nmfs.inport.5619.xml | mission:2e/1w · keywords:0e/14w |
| gov.noaa.nmfs.inport.5687.xml | mission:2e/1w · keywords:0e/13w |
| gov.noaa.nmfs.inport.62654.xml | mission:2e/0w · keywords:0e/42w |
| uxs_test.xml | mission:1e/1w · keywords:0e/92w |

## Pipeline errors

- (none)

## Lenient issue rollup (automation)

Cross-sample aggregation of **lenient** validator output — **prioritize fixes** (import vs rules):

- **Markdown:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.md`
- **JSON:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.json`
- **CSV:** `MANTA End User Testing/reports/manta-samples-lenient-patterns.csv` (patterns × sample files)

## JSON

Per-sample machine-readable (includes `lenientIssues[]`, `strictIssues[]`, `catalogIssues[]`): `MANTA End User Testing/reports/manta-samples-iso2-audit.json`