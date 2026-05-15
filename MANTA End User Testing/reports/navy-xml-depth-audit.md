# Navy / UxS XML — deep import audit

Generated: 2026-05-15T09:45:18.138Z
Corpus: **navy-uxs-subset** (20 files from `MANTA End User Testing/samples`)

## Summary

| Metric | Count |
|--------|------:|
| Files audited | 20 |
| Import failed | 0 |
| Merge/validate pipeline failed | 0 |
| Lenient errors (any file) | 6 |
| Strict errors (any file) | 16 |
| Catalog errors (any file) | 16 |
| ISO-2 preview sanity fail | 0 |
| **Instruments in XML, empty in form** | **0** |
| Partial sensor import | 4 |
| Science keywords loss on import | 10 |
| No science keywords (source + import) | 9 |
| No locations keywords (source + import) | 5 |
| Navy/UxS subset files | 13 (instrument gap: 0) |

## By category

- **navy-uxs**: 13
- **other-eut**: 2
- **uxs-acquisition**: 3
- **collection**: 1
- **template-populated**: 1

## Per file

| File | Cat | Shape | XML inst | Sensors | Sci src→imp | Lenient | Strict | Cat | Flags |
|------|-----|-------|---------:|--------:|------------:|--------:|-------:|----:|-------|
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250723T0032Z.xml | navy-uxs | ISO 19115-3 | 5 | 5/5 | 0→0 | 0e/1w | 3 | 7 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| ISO3_EN2501_REMUS620_401_KRAKEN_SAS_20250727T0247Z.xml | navy-uxs | ISO 19115-3 | 5 | 5/5 | 0→0 | 0e/1w | 3 | 7 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV01.xml | navy-uxs | ISO 19115-3 | 10 | 10/10 | 0→0 | 0e/3w | 2 | 6 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| NOAA_MDBC_UxSAcquisition_Metadata_PS2418_AUV03.xml | navy-uxs | ISO 19115-3 | 10 | 10/10 | 0→0 | 0e/3w | 2 | 6 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import |
| uxs_test.xml | navy-uxs | ISO 19115-2 gmi | 12 | 12/12 | 46→41 | 0e/93w | 1 | 4 | science-keywords-loss-on-import |
| 9f21ce1a-1e11-4461-bc84-81939f73cfc2.xml | other-eut | ISO 19115-2 gmi | 0 | 1/1 | 10→7 | 0e/20w | 1 | 2 | science-keywords-loss-on-import |
| PS2418L0-AUV01-norbit-mb-20240505.xml | navy-uxs | ISO 19115-2 gmi | 0 | 1/1 | 0→0 | 2e/3w | 5 | 10 | no-science-keywords-source-or-import, lenient-errors |
| PS2418L0-UUV01-norbit-mb-20240505-r2.xml | navy-uxs | ISO 19115-2 gmi | 2 | 1/1 | 1→0 | 0e/3w | 1 | 2 | partial-sensor-import, science-keywords-loss-on-import, science-keywords-dropped-to-zero |
| PS2418L0-UUV01-norbit-mb-20240505.xml | navy-uxs | ISO 19115-2 gmi | 2 | 1/1 | 1→0 | 0e/3w | 1 | 2 | partial-sensor-import, science-keywords-loss-on-import, science-keywords-dropped-to-zero |
| navy-uxs-gmi-template-2026-r2.xml | navy-uxs | ISO 19115-2 gmi | 3 | 3/3 | 7→1 | 0e/5w | 0 | 0 | science-keywords-loss-on-import |
| navy-uxs-gmi-template-2026.xml | navy-uxs | ISO 19115-2 gmi | 3 | 2/2 | 7→1 | 0e/9w | 0 | 0 | partial-sensor-import, science-keywords-loss-on-import |
| navy-uxs-swarm-clean.xml | navy-uxs | ISO 19115-2 gmi | 3 | 3/3 | 8→1 | 0e/3w | 0 | 0 | science-keywords-loss-on-import |
| sample-mission.xml | other-eut | ISO 19115-2 gmi | 0 | 0/1 | 0→0 | 19e/2w | 22 | 27 | no-science-keywords-source-or-import, no-locations-keywords-source-or-import, all-sensor-rows-inactive, lenient-errors |
| uxs-md-dataset-preview-a.xml | uxs-acquisition | ISO 19139 gmd | 0 | 1/1 | 0→0 | 14e/3w | 17 | 22 | no-science-keywords-source-or-import, lenient-errors |
| uxs-md-dataset-preview-b.xml | uxs-acquisition | ISO 19139 gmd | 1 | 1/1 | 0→0 | 19e/2w | 22 | 27 | no-science-keywords-source-or-import, lenient-errors |
| uxs-ncei-template-preview.xml | uxs-acquisition | ISO 19139 gmd | 2 | 1/1 | 1→0 | 2e/2w | 2 | 2 | partial-sensor-import, science-keywords-loss-on-import, science-keywords-dropped-to-zero, lenient-errors |
| EX1904_collection.xml | collection | ISO 19115-2 gmi | 0 | 1/1 | 6→3 | 0e/77w | 2 | 6 | science-keywords-loss-on-import |
| PS2418L0-UUV01-BAD.xml | navy-uxs | ISO 19115-2 gmi | 0 | 1/1 | 0→0 | 5e/5w | 8 | 13 | no-science-keywords-source-or-import, lenient-errors |
| PS2418L0-UUV01-GOOD.xml | navy-uxs | ISO 19115-2 gmi | 1 | 1/1 | 2→2 | 0e/2w | 1 | 5 | — |
| SAMPLE_Populated.xml | template-populated | ISO 19115-2 gmi | 3 | 3/3 | 11→2 | 0e/11w | 0 | 0 | science-keywords-loss-on-import |

## Action items

### Partial sensor import
- PS2418L0-UUV01-norbit-mb-20240505-r2.xml (2 XML → 1 filled)
- PS2418L0-UUV01-norbit-mb-20240505.xml (2 XML → 1 filled)
- navy-uxs-gmi-template-2026.xml (3 XML → 2 filled)
- uxs-ncei-template-preview.xml (2 XML → 1 filled)

### Science keyword loss (source > import)
- **uxs_test.xml** — 46 → 41 (Δ -5)
- **9f21ce1a-1e11-4461-bc84-81939f73cfc2.xml** — 10 → 7 (Δ -3)
- **PS2418L0-UUV01-norbit-mb-20240505-r2.xml** — 1 → 0 (Δ -1)
- **PS2418L0-UUV01-norbit-mb-20240505.xml** — 1 → 0 (Δ -1)
- **navy-uxs-gmi-template-2026-r2.xml** — 7 → 1 (Δ -6)
- **navy-uxs-gmi-template-2026.xml** — 7 → 1 (Δ -6)
- **navy-uxs-swarm-clean.xml** — 8 → 1 (Δ -7)
- **uxs-ncei-template-preview.xml** — 1 → 0 (Δ -1)
- **EX1904_collection.xml** — 6 → 3 (Δ -3)
- **SAMPLE_Populated.xml** — 11 → 2 (Δ -9)

### Instruments in XML but empty form
_None on current main._

## Notes

- Companion: `npm run audit:manta-samples` (full pipeline + lenient rollup).
- Navy subset: EN2501, MDBC PS2418, `uxs_test`, template fixtures.
- EN2501 ISO-3: acquisition-level `MI_Instrument` (not under platform).
