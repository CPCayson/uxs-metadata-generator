# Swarm Implementation Board

This board operationalizes the metadata workbench swarm into parallel lanes with concrete outputs.

## SWARM-A — Schema Guardrails

- [ ] Add row schemas in `schemas/`:
  - `validation-rule-row.schema.json`
  - `field-map-row.schema.json`
  - `rule-set-priority-row.schema.json`
  - `rule-conflict-row.schema.json`
- [ ] Validate normalized CSV rows before compile.
- [ ] Enforce strict enum and required-column checks.

Deliverable: schema validation passes for all rule CSV files.

## SWARM-B — Compiler / Merge

- [ ] Load `rule_set_priority.csv`.
- [ ] Compile by record type (`mission`, `collection`, `granule`).
- [ ] Resolve conflicts via priority + specificity + severity + requirement strength.
- [ ] Apply manual overrides from `rule_conflict_resolution.csv`.
- [ ] Emit compiled bundles to `compiled_rules/`.

Deliverable: deterministic compile output with trace metadata.

## SWARM-C — Condition Engine

- [ ] Support condition operators:
  - `and`, `or`, `not`
  - `eq`, `neq`, `in`
  - `exists`, `missing`
  - `matches`
  - `gt`, `gte`, `lt`, `lte`
- [ ] Return explain metadata (`matched`, `reason`).

Deliverable: condition fixtures pass.

## SWARM-D — Ingestion + Mapping QA

- [ ] Normalize source fields into canonical `field_key`.
- [ ] Enforce: each `block|required` rule has at least one `field_map`.
- [ ] Report unresolved field mappings.

Deliverable: zero unresolved critical mapping gaps (or explicit waivers).

## SWARM-E — Golden Regression Harness

- [ ] Define golden cases with expected issues.
- [ ] Assert expected severities and issue IDs.
- [ ] Fail CI on unexpected drift.

Deliverable: stable golden suite for BEDI/UxS/OER.

## SWARM-F — Workbench Integration

- [ ] Load compiled rules in validation pipeline.
- [ ] Render lane-level verdicts and unified status.
- [ ] Emit autofix audit trace export.

Deliverable: one-flow workbench with explainable PASS/CHECK/BLOCK.

## Suggested Parallel Assignment

- Agent 1: SWARM-A + SWARM-B
- Agent 2: SWARM-C
- Agent 3: SWARM-D
- Agent 4: SWARM-E + SWARM-F hookup

