# Navy template: import vs preview vs original

- **Source:** `../MANTA End User Testing/samples/uxs_test.xml`
- **Generated:** 2026-05-11T16:20:36.777Z

## Counts

| Metric | Value |
|--------|------:|
| Semantic probes (original XML) | 20 |
| **Not inserted into pilotState** (non-placeholder original text, empty after import) | **0** |
| **Original vs preview XML** (same probe gap after round-trip preview) | **0** |
| Original file size (chars) | 153558 |
| Preview-from-import size (chars) | 94594 |
| Text leaves collected (original / preview) | 548 / 361 |
| Multiset diff rows (path+text count deltas) | 793 |
| Only in original (excess multiset rows) | 490 |
| Only in preview (excess multiset rows) | 303 |


## xmllint --noout

| File | OK | stderr (if any) |
|------|:--:|-----------------|
| Original copy | yes | `` |
| Preview from import | yes | `` |

## Files to compare

- Original copy: `reports/navy-import-preview-compare/uxs_test-original.xml`
- Preview from import: `reports/navy-import-preview-compare/uxs_test-preview-from-import.xml`
- `diff -u` output: `reports/navy-import-preview-compare/uxs_test-diff-u.txt`
- Leaf multiset diff JSON: `reports/navy-import-preview-compare/uxs_test-leaf-multiset-diff.json` (first 8000 rows in `multisetDiffSample`)
- Leaves only in original: `reports/navy-import-preview-compare/uxs_test-only-in-original-leaves.txt`
- Leaves only in preview: `reports/navy-import-preview-compare/uxs_test-only-in-preview-leaves.txt`

Run locally: `diff -u "/Users/connorcayson/Downloads/uSX/react-pilot/reports/navy-import-preview-compare/uxs_test-original.xml" "/Users/connorcayson/Downloads/uSX/react-pilot/reports/navy-import-preview-compare/uxs_test-preview-from-import.xml" | less`

## Not inserted after import (0)

_None — all sampled probes had some value in merged state, or original was placeholder._

## Original vs rebuilt preview XML (0)

_Same probe list aligned for preview rebuild._

## Full text-leaf inventory

Every **element that has no element children** contributes one row `path TAB text` (placeholders `{{…}}` omitted). Multiset diff counts duplicate identical path+text pairs. Preview omits large branches of the Navy template, so **only-in-original** is usually large.

_See `reports/navy-import-preview-compare/uxs_test-only-in-original-leaves.txt` / `reports/navy-import-preview-compare/uxs_test-only-in-preview-leaves.txt` for sorted multiset deltas._

**Note:** Semantic probe rows above remain the quickest “did import drop title/bbox?” check. `sensorInstrumentBlocks` in probes counts `gmi:MI_Instrument` nodes under acquisition; **Imported** uses `sensors.length`.
