# MANTA samples — import audit & ISO 19115-2 preview alignment

Generated: 2026-05-11T16:58:54.506Z
Samples: `MANTA End User Testing/samples` (repo-relative)

For each file: **source shape** (root XML), **import/merge** pipeline, **validation** counts after auto-fix (lenient / strict / **catalog**), **ISO-19115-2 preview sanity**, **preview→import round-trip** (`buildXmlPreview` output fed back through `importPilotPartialStateFromXml`), and **xmllint --noout** when installed.

Empty **ISO-2 preview fails** means Manta’s emitted preview matches that structural bar for that loaded state.

**Wizard coverage:** The validator runs on the **full merged state** (same as saving after visiting every step). There is no separate “click every control” pass — use **per-step issue tallies** below to see which sections still fail.

**Per-field validation:** Issues are grouped by **wizard step** using the same field-prefix ownership as the mission profile (`mission` / `platform` / `sensors` / `spatial` / `keywords` / `distribution`); paths that do not match any step prefix appear under **`other`** (e.g. catalog `ident.*` rules).

| File | Source XML shape | Import ok | Merge ok | Lenient E/W | Strict E/W | Catalog E/W | RT | xmllint | ISO-2 preview fails |
|------|------------------|-----------|----------|-------------|------------|-------------|----|---------|---------------------|
| 0299833.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/4 | 2/3 | 3/3 | yes | ok | — |
| AFSC_GA13_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/17 | 2/16 | 4/16 | yes | ok | — |
| C01531.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/23 | 3/22 | 6/22 | yes | ok | — |
| C01678.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/20 | 2/19 | 5/19 | yes | ok | — |
| EX1904_collection.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 7/84 | 9/83 | 13/83 | yes | ok | — |
| EX2306_COLLECTION.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 3/13 | 4/13 | 8/13 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 11/6 | 15/4 | 19/4 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 11/6 | 15/4 | 19/4 | yes | ok | — |
| LISTEN_GoMex_Raw_Audio.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 3/16 | 3/16 | 7/16 | yes | ok | — |
| NCRMP-Benthic-FG.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/49 | 0/49 | 3/49 | yes | ok | — |
| NCRMP-Socio-Guam.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/18 | 1/18 | 4/18 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | ISO 19115-3 (mdb / -3) | yes | yes | 9/5 | 11/4 | 15/4 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | ISO 19115-3 (mdb / -3) | yes | yes | 9/5 | 11/4 | 15/4 | yes | ok | — |
| NRS_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/21 | 2/20 | 4/20 | yes | ok | — |
| SAMPLE_Populated.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/15 | 2/15 | 2/15 | yes | ok | — |
| gov.noaa.nmfs.inport.52208.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 5/24 | 7/23 | 10/23 | yes | ok | — |
| gov.noaa.nmfs.inport.5619.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 5/18 | 7/17 | 11/17 | yes | ok | — |
| gov.noaa.nmfs.inport.5687.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 4/16 | 6/15 | 10/15 | yes | ok | — |
| gov.noaa.nmfs.inport.62654.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 6/47 | 8/46 | 12/46 | yes | ok | — |
| uxs_test.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 0/58 | 1/58 | 4/58 | yes | ok | — |

## Per-step issue counts (lenient)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:0e/3w · keywords:0e/1w |
| AFSC_GA13_Raw_Data.xml | mission:1e/1w · keywords:0e/16w |
| C01531.xml | mission:1e/3w · keywords:0e/20w |
| C01678.xml | mission:0e/3w · sensors:1e/0w · keywords:0e/17w |
| EX1904_collection.xml | mission:4e/2w · keywords:2e/82w · distribution:1e/0w |
| EX2306_COLLECTION.xml | mission:1e/1w · keywords:1e/12w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | mission:3e/4w · sensors:1e/0w · keywords:5e/2w · distribution:2e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | mission:3e/4w · sensors:1e/0w · keywords:5e/2w · distribution:2e/0w |
| LISTEN_GoMex_Raw_Audio.xml | mission:2e/2w · keywords:1e/14w |
| NCRMP-Benthic-FG.xml | mission:0e/2w · keywords:0e/47w |
| NCRMP-Socio-Guam.xml | mission:0e/1w · keywords:1e/17w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:3e/3w · keywords:5e/2w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:3e/3w · keywords:5e/2w · distribution:1e/0w |
| NRS_Raw_Data.xml | mission:1e/3w · keywords:0e/18w |
| SAMPLE_Populated.xml | mission:2e/2w · keywords:0e/13w |
| gov.noaa.nmfs.inport.52208.xml | mission:1e/3w · sensors:2e/0w · keywords:2e/21w |
| gov.noaa.nmfs.inport.5619.xml | mission:0e/3w · sensors:2e/0w · keywords:2e/15w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5687.xml | mission:0e/3w · sensors:2e/0w · keywords:2e/13w |
| gov.noaa.nmfs.inport.62654.xml | mission:1e/2w · sensors:2e/0w · keywords:2e/45w · distribution:1e/0w |
| uxs_test.xml | mission:0e/2w · keywords:0e/56w |

## Per-step issue counts (strict)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:2e/2w · keywords:0e/1w |
| AFSC_GA13_Raw_Data.xml | mission:2e/0w · keywords:0e/16w |
| C01531.xml | mission:3e/2w · keywords:0e/20w |
| C01678.xml | mission:1e/2w · sensors:1e/0w · keywords:0e/17w |
| EX1904_collection.xml | mission:6e/1w · keywords:2e/82w · distribution:1e/0w |
| EX2306_COLLECTION.xml | mission:2e/1w · keywords:1e/12w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | mission:7e/2w · sensors:1e/0w · keywords:5e/2w · distribution:2e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | mission:7e/2w · sensors:1e/0w · keywords:5e/2w · distribution:2e/0w |
| LISTEN_GoMex_Raw_Audio.xml | mission:2e/2w · keywords:1e/14w |
| NCRMP-Benthic-FG.xml | mission:0e/2w · keywords:0e/47w |
| NCRMP-Socio-Guam.xml | mission:0e/1w · keywords:1e/17w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:5e/2w · keywords:5e/2w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:5e/2w · keywords:5e/2w · distribution:1e/0w |
| NRS_Raw_Data.xml | mission:2e/2w · keywords:0e/18w |
| SAMPLE_Populated.xml | mission:2e/2w · keywords:0e/13w |
| gov.noaa.nmfs.inport.52208.xml | mission:3e/2w · sensors:2e/0w · keywords:2e/21w |
| gov.noaa.nmfs.inport.5619.xml | mission:2e/2w · sensors:2e/0w · keywords:2e/15w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5687.xml | mission:2e/2w · sensors:2e/0w · keywords:2e/13w |
| gov.noaa.nmfs.inport.62654.xml | mission:3e/1w · sensors:2e/0w · keywords:2e/45w · distribution:1e/0w |
| uxs_test.xml | mission:1e/2w · keywords:0e/56w |

## Pipeline errors

- (none)

## Lenient issue rollup (automation)

Cross-sample aggregation of **lenient** validator output — **prioritize fixes** (import vs rules):

- **Markdown:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.md`
- **JSON:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.json`
- **CSV:** `MANTA End User Testing/reports/manta-samples-lenient-patterns.csv` (patterns × sample files)

## JSON

Per-sample machine-readable (includes `lenientIssues[]`): `MANTA End User Testing/reports/manta-samples-iso2-audit.json`