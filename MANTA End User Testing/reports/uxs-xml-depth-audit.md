# UxS / EUT XML — deep import audit (all samples)

Generated: 2026-05-15T11:56:28.536Z
Corpus: **manta-eut-samples** (20 files from `MANTA End User Testing/samples`)

## Summary

| Metric | Count |
|--------|------:|
| Files audited | 20 |
| Import failed | 0 |
| Merge/validate pipeline failed | 0 |
| Lenient errors (any file) | 0 |
| Strict errors (any file) | 17 |
| Catalog errors (any file) | 19 |
| ISO-2 preview sanity fail | 0 |
| **Instruments in XML, empty in form** | **0** |
| Partial sensor import | 0 |
| Science keywords loss on import | 0 |
| No science keywords (source + import) | 4 |
| No locations keywords (source + import) | 4 |
| Navy/UxS subset files | 5 (instrument gap: 0) |

## By category

- **other-eut**: 8
- **collection**: 2
- **navy-uxs**: 5
- **template-populated**: 1
- **inport**: 4

## Per file

| File | Cat | Shape | XML inst | Sensors | Sci src→imp | Lenient | Strict | Cat | Flags |
|------|-----|-------|---------:|--------:|------------:|--------:|-------:|----:|-------|
| 0299833.xml | other-eut | ISO 19115-2 gmi | 1 | 1/1 | 6→6 | 0e/3w | 2 | 3 | — |
| AFSC_GA13_Raw_Data.xml | other-eut | ISO 19115-2 gmi | 1 | 1/1 | 8→8 | 0e/7w | 2 | 4 | — |
| C01531.xml | other-eut | ISO 19115-2 gmi | 0 | 1/1 | 5→5 | 0e/18w | 2 | 5 | — |
| C01678.xml | other-eut | ISO 19115-2 gmi | 0 | 2/2 | 5→5 | 0e/14w | 1 | 4 | — |
| EX1904_collection.xml | collection | ISO 19115-2 gmi | 0 | 1/1 | 3→3 | 0e/77w | 2 | 6 | — |
| EX2306_COLLECTION.xml | collection | ISO 19115-2 gmi | 28 | 28/28 | 3→22 | 0e/52w | 1 | 5 | — |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | navy-uxs | ISO 19115-3 | 5 | 5/5 | 0→0 | 0e/1w | 3 | 7 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | navy-uxs | ISO 19115-3 | 5 | 5/5 | 0→0 | 0e/1w | 3 | 7 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| LISTEN_GoMex_Raw_Audio.xml | other-eut | ISO 19115-2 gmi | 0 | 1/1 | 8→8 | 0e/7w | 1 | 5 | — |
| NCRMP-Benthic-FG.xml | other-eut | ISO 19115-2 gmi | 2 | 2/2 | 46→46 | 0e/69w | 0 | 3 | — |
| NCRMP-Socio-Guam.xml | other-eut | ISO 19115-2 gmi | 0 | 1/1 | 10→10 | 0e/27w | 0 | 3 | — |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | navy-uxs | ISO 19115-3 | 10 | 10/10 | 0→0 | 0e/3w | 2 | 6 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | navy-uxs | ISO 19115-3 | 10 | 10/10 | 0→0 | 0e/3w | 2 | 6 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| NRS_Raw_Data.xml | other-eut | ISO 19115-2 gmi | 1 | 1/1 | 8→8 | 0e/9w | 1 | 3 | — |
| SAMPLE_Populated.xml | template-populated | ISO 19115-2 gmi | 3 | 3/3 | 2→2 | 0e/11w | 0 | 0 | — |
| gov.noaa.nmfs.inport.52208.xml | inport | ISO 19115-2 gmi | 0 | 1/1 | 12→12 | 0e/21w | 2 | 5 | — |
| gov.noaa.nmfs.inport.5619.xml | inport | ISO 19115-2 gmi | 0 | 1/1 | 11→11 | 0e/16w | 2 | 6 | — |
| gov.noaa.nmfs.inport.5687.xml | inport | ISO 19115-2 gmi | 0 | 1/1 | 8→8 | 0e/15w | 2 | 6 | — |
| gov.noaa.nmfs.inport.62654.xml | inport | ISO 19115-2 gmi | 0 | 1/1 | 33→33 | 0e/43w | 2 | 6 | — |
| uxs_test.xml | navy-uxs | ISO 19115-2 gmi | 12 | 12/12 | 41→41 | 0e/93w | 1 | 4 | — |

## Action items

### Partial sensor import
_None_

### Science keyword loss (source > import)
_None_

### Instruments in XML but empty form
_None on current main._

## Notes

- Companion: `npm run audit:manta-samples` (full pipeline + lenient rollup).
- Navy subset: EN2501, MDBC PS2418, `uxs_test`, template fixtures.
- EN2501 ISO-3: acquisition-level `MI_Instrument` (not under platform).
