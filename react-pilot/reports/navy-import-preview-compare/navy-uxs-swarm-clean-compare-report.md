# Navy template: import vs preview vs original

- **Source:** `fixtures/mission/navy-uxs-swarm-clean.xml`
- **Generated:** 2026-05-11T16:02:25.023Z

## Counts

| Metric | Value |
|--------|------:|
| Semantic probes (original XML) | 20 |
| **Not inserted into pilotState** (non-placeholder original text, empty after import) | **0** |
| **Original vs preview XML** (same probe gap after round-trip preview) | **0** |
| Original file size (chars) | 57589 |
| Preview-from-import size (chars) | 29330 |

## Files to compare

- Original copy: `reports/navy-import-preview-compare/navy-uxs-swarm-clean-original.xml`
- Preview from import: `reports/navy-import-preview-compare/navy-uxs-swarm-clean-preview-from-import.xml`
- `diff -u` output: `reports/navy-import-preview-compare/navy-uxs-swarm-clean-diff-u.txt`

Run locally: `diff -u "/Users/connorcayson/Downloads/uSX/react-pilot/reports/navy-import-preview-compare/navy-uxs-swarm-clean-original.xml" "/Users/connorcayson/Downloads/uSX/react-pilot/reports/navy-import-preview-compare/navy-uxs-swarm-clean-preview-from-import.xml" | less`

## Not inserted after import (0)

_None — all sampled probes had some value in merged state, or original was placeholder._

## Original vs rebuilt preview XML (0)

_Same probe list aligned for preview rebuild._

_Probe definitions are best-effort DOM snapshots (title, abstract, bbox, keywords count, etc.), not every ISO leaf._
