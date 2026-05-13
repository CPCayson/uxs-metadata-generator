# MANTA samples — import audit & ISO 19115-2 preview alignment

Generated: 2026-05-12T18:30:38.186Z
Samples: `MANTA End User Testing/samples` (repo-relative)

For each file: **source shape** (root XML), **import/merge** pipeline, **validation** counts after auto-fix (lenient / strict / **catalog**), **ISO-19115-2 preview sanity**, **preview→import round-trip** (`buildXmlPreview` output fed back through `importPilotPartialStateFromXml`), and **xmllint --noout** when installed.

Empty **ISO-2 preview fails** means Manta’s emitted preview matches that structural bar for that loaded state.

**Wizard coverage:** The validator runs on the **full merged state** (same as saving after visiting every step). There is no separate “click every control” pass — use **per-step issue tallies** below to see which sections still fail.

**Per-field validation:** Issues are grouped by **wizard step** using the same field-prefix ownership as the mission profile (`mission` / `platform` / `sensors` / `spatial` / `keywords` / `distribution`); paths that do not match any step prefix appear under **`other`** (e.g. catalog `ident.*` rules).

| File | Source XML shape | Import ok | Merge ok | Lenient E/W | Strict E/W | Catalog E/W | RT | xmllint | ISO-2 preview fails |
|------|------------------|-----------|----------|-------------|------------|-------------|----|---------|---------------------|
| 0299833.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/5 | 4/3 | 5/3 | yes | ok | — |
| AFSC_GA13_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/8 | 4/6 | 6/6 | yes | ok | — |
| C01531.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/20 | 5/18 | 8/18 | yes | ok | — |
| C01678.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/16 | 4/14 | 7/14 | yes | ok | — |
| EX1904_collection.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 3/78 | 5/77 | 9/77 | yes | ok | — |
| EX2306_COLLECTION.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/54 | 4/53 | 8/53 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 4/4 | 8/2 | 12/2 | yes | ok | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | ISO 19115-3 (mdb / -3) | yes | yes | 4/4 | 8/2 | 12/2 | yes | ok | — |
| LISTEN_GoMex_Raw_Audio.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/9 | 4/8 | 8/8 | yes | ok | — |
| NCRMP-Benthic-FG.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/70 | 2/69 | 5/69 | yes | ok | — |
| NCRMP-Socio-Guam.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/29 | 2/28 | 5/28 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | ISO 19115-3 (mdb / -3) | yes | yes | 3/5 | 6/3 | 10/3 | yes | ok | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | ISO 19115-3 (mdb / -3) | yes | yes | 3/5 | 6/3 | 10/3 | yes | ok | — |
| NRS_Raw_Data.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/11 | 3/9 | 5/9 | yes | ok | — |
| SAMPLE_Populated.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/12 | 2/12 | 2/12 | yes | ok | — |
| gov.noaa.nmfs.inport.52208.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/23 | 4/21 | 7/21 | yes | ok | — |
| gov.noaa.nmfs.inport.5619.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/18 | 4/16 | 8/16 | yes | ok | — |
| gov.noaa.nmfs.inport.5687.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/17 | 4/15 | 8/15 | yes | ok | — |
| gov.noaa.nmfs.inport.62654.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 2/45 | 5/43 | 9/43 | yes | ok | — |
| uxs_test.xml | ISO 19115-2 style (gmi:MI_Metadata) | yes | yes | 1/95 | 3/94 | 6/94 | yes | ok | — |

## Per-step issue counts (lenient)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:0e/4w · keywords:0e/1w · distribution:1e/0w |
| AFSC_GA13_Raw_Data.xml | mission:0e/2w · keywords:0e/6w · distribution:1e/0w |
| C01531.xml | mission:1e/4w · keywords:0e/16w · distribution:1e/0w |
| C01678.xml | mission:0e/4w · sensors:1e/0w · keywords:0e/12w · distribution:1e/0w |
| EX1904_collection.xml | mission:3e/2w · keywords:0e/76w |
| EX2306_COLLECTION.xml | mission:1e/2w · keywords:0e/52w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | mission:2e/4w · sensors:1e/0w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | mission:2e/4w · sensors:1e/0w · distribution:1e/0w |
| LISTEN_GoMex_Raw_Audio.xml | mission:1e/3w · keywords:0e/6w · distribution:1e/0w |
| NCRMP-Benthic-FG.xml | mission:0e/2w · keywords:0e/68w · distribution:1e/0w |
| NCRMP-Socio-Guam.xml | mission:0e/2w · keywords:0e/27w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:2e/4w · keywords:0e/1w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:2e/4w · keywords:0e/1w · distribution:1e/0w |
| NRS_Raw_Data.xml | mission:0e/3w · keywords:0e/8w · distribution:1e/0w |
| SAMPLE_Populated.xml | mission:2e/2w · keywords:0e/10w |
| gov.noaa.nmfs.inport.52208.xml | mission:0e/4w · keywords:0e/19w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5619.xml | mission:0e/4w · keywords:0e/14w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5687.xml | mission:0e/4w · keywords:0e/13w · distribution:1e/0w |
| gov.noaa.nmfs.inport.62654.xml | mission:1e/3w · keywords:0e/42w · distribution:1e/0w |
| uxs_test.xml | mission:0e/3w · keywords:0e/92w · distribution:1e/0w |

## Per-step issue counts (strict)

| File | By step (errors/warnings) |
|------|---------------------------|
| 0299833.xml | mission:3e/2w · keywords:0e/1w · distribution:1e/0w |
| AFSC_GA13_Raw_Data.xml | mission:3e/0w · keywords:0e/6w · distribution:1e/0w |
| C01531.xml | mission:4e/2w · keywords:0e/16w · distribution:1e/0w |
| C01678.xml | mission:2e/2w · sensors:1e/0w · keywords:0e/12w · distribution:1e/0w |
| EX1904_collection.xml | mission:5e/1w · keywords:0e/76w |
| EX2306_COLLECTION.xml | mission:3e/1w · keywords:0e/52w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | mission:6e/2w · sensors:1e/0w · distribution:1e/0w |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | mission:6e/2w · sensors:1e/0w · distribution:1e/0w |
| LISTEN_GoMex_Raw_Audio.xml | mission:3e/2w · keywords:0e/6w · distribution:1e/0w |
| NCRMP-Benthic-FG.xml | mission:1e/1w · keywords:0e/68w · distribution:1e/0w |
| NCRMP-Socio-Guam.xml | mission:1e/1w · keywords:0e/27w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | mission:5e/2w · keywords:0e/1w · distribution:1e/0w |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | mission:5e/2w · keywords:0e/1w · distribution:1e/0w |
| NRS_Raw_Data.xml | mission:2e/1w · keywords:0e/8w · distribution:1e/0w |
| SAMPLE_Populated.xml | mission:2e/2w · keywords:0e/10w |
| gov.noaa.nmfs.inport.52208.xml | mission:3e/2w · keywords:0e/19w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5619.xml | mission:3e/2w · keywords:0e/14w · distribution:1e/0w |
| gov.noaa.nmfs.inport.5687.xml | mission:3e/2w · keywords:0e/13w · distribution:1e/0w |
| gov.noaa.nmfs.inport.62654.xml | mission:4e/1w · keywords:0e/42w · distribution:1e/0w |
| uxs_test.xml | mission:2e/2w · keywords:0e/92w · distribution:1e/0w |

## Pipeline errors

- (none)

## Lenient issue rollup (automation)

Cross-sample aggregation of **lenient** validator output — **prioritize fixes** (import vs rules):

- **Markdown:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.md`
- **JSON:** `MANTA End User Testing/reports/manta-samples-lenient-rollup.json`
- **CSV:** `MANTA End User Testing/reports/manta-samples-lenient-patterns.csv` (patterns × sample files)

## JSON

Per-sample machine-readable (includes `lenientIssues[]`): `MANTA End User Testing/reports/manta-samples-iso2-audit.json`