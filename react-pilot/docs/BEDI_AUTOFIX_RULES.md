# BEDI Autofix Rules

This document consolidates recurring BEDI collection/granule remediation rules that were previously handled manually during template population and review cycles.

## Goal

Normalize "broken but close" BEDI XML into consistent, validator-ready records by applying deterministic fixes first, then surfacing only true content gaps for human review.

## Rule Buckets

- Template hygiene
- Identifier and linkage integrity
- Title/abstract normalization
- DocuComp and component integrity
- XML/schema safety normalization

## Deterministic Rules (safe to auto-apply)

### 1) Template hygiene

- Remove unresolved placeholders (`{{...}}`) from required publish fields; raise blocking error if unresolved placeholders remain in required fields after attempted cleanup.
- Normalize malformed brace artifacts (examples: `{TOKEN}}`, `{{https://...}}` in `xlink:href`).
- Strip known template-only comments/snippets from final publish output.

### 2) Identifier and linkage integrity

- Ensure each record has exactly one `fileIdentifier`.
- Generate stable UUIDs (v5) from deterministic source keys where required by cohort process.
- Enforce `parentIdentifier` on granules/segments and ensure it maps to the collection UUID table.
- Persist and reuse collection UUID mapping (`collection UUID -> BEDI cruise ID`) to avoid drift between runs.

### 3) Title and abstract normalization

- Collection `alternateTitle` includes cruise ID suffix when required by agreed naming convention.
- Granule title format follows production pattern (cohort-approved naming template).
- Granule abstract format follows production pattern (cohort-approved text template).
- Collapse repeated whitespace and normalize punctuation spacing in generated title/abstract fields.

### 4) DocuComp and component integrity

- Validate all `docucomp` `xlink:href` references are syntactically valid URLs.
- Resolve/check component references before publish gating.
- Block publish if any required component resolves to invalid XML or unresolved/invalid content.
- Treat component failure as record failure, even if parent XML passes basic schema validation.

### 5) XML/schema safety normalization

- Apply `gco:nilReason` patterns where source values are legitimately absent and schema requires element presence.
- Normalize numeric/date/time literal formatting to schema-safe representations.
- Ensure cardinality requirements for critical nodes (contacts, identifiers, required legal constraints) are not violated.

## Validation Gates

A BEDI record should only be marked "ready" when all gates pass:

1. Local/template hygiene checks
2. XML well-formedness + schema checks
3. CoMET validate/link/rubric checks (where applicable)
4. MetaServer validation (where required)
5. OneStop parity checks
6. DocuComp/component integrity checks

## Non-deterministic Rules (require human confirmation)

- Semantic keyword curation (especially cruise-specific scientific keywords)
- Cohort-specific title language nuances beyond agreed templates
- Domain-specific contact/role interpretation when source data is ambiguous
- Policy-sensitive legal/use/access statements

## Implementation Notes

- Keep these rules mirrored in both:
  - human-readable docs (this file), and
  - machine-readable validation spec (JSON/YAML) used by the app.
- Every deterministic rule should have:
  - a stable rule ID,
  - severity (`error`/`warning`),
  - autofix capability flag,
  - test coverage with before/after fixtures.

