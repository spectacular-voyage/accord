---
id: 4pmyinrd4ly6zfvlatbi36u
title: 2026 07 04 Scenario Runner
desc: ''
updated: 1783149845965
created: 1783149845965
---

## Goals

- Make scenario-index execution first-class: one command runs every step listed in a `scenario-index.jsonld` in order, instead of requiring a manual `accord check` invocation per manifest.
- Preserve per-step evidence grouping in both text and JSON reports so a fixture-ladder consumer like Stagecraft can see each rung pair, its file expectations, and its `hasAskAssertion` results together.
- Keep `accord check` behavior unchanged and keep the runner deterministic and local-only.
- Reuse the existing `src/scenario` loader and vocabulary rather than inventing a second scenario format.

## Summary

This task lands product bets 2 and 6 from [[ac.product-ideas.runner-neutral-test-spec]]. The scenario-index groundwork already exists: `accord:ScenarioIndex`, `accord:ScenarioStep`, and `accord:StateLane` are in `accord-ontology.ttl`, and `src/scenario/load_jsonld.ts` already loads a scenario index with `hasStep` entries carrying `manifestPath`, `caseId`, and lane bindings. What is missing is the runner: nothing in `src/cli` executes the steps.

The working command shape is:

```sh
accord check-scenario conformance/scenario-index.jsonld [--fixture-repo-path <path>] [--format <text|json>]
```

The runner resolves each step's manifest path relative to the scenario index document, selects the step's case, and runs the existing check pipeline per step. Output must stay grouped by step, not flattened into one anonymous pass/fail pool. The Stagecraft temporal-vocabulary rung showed that whole-index pass/fail is not enough: consumers want to see each rung pair with its path expectations and semantic assertions paired.

## Discussion

### Report shape

The per-step report should group, for each step:

- the step id and the transition it covers (manifest, case, fromRef, toRef)
- file expectation results
- RDF/ASK assertion results
- unexpected changes
- the step verdict

The JSON format should be a stable envelope: scenario-level metadata, an ordered `steps` array reusing the existing single-check report structure per step, and a scenario-level verdict. Do not redesign the existing single-check report; wrap it.

### Failure semantics

The default should be run-all-steps, report every step, and exit non-zero if any step fails. Fail-fast is a plausible later flag, but partial evidence is worse than complete evidence for ladder debugging. A step whose manifest fails to load is a step failure with a stable error report, not a crash of the whole run.

### Relationship to the black-box harness

`testdata/scenarios/black-box.json` is a test-harness driver, not the product scenario-index format. This task must not conflate them. The runner consumes JSON-LD scenario indexes through the existing fail-closed local-only document-loading policy.

### Drift checks

The temporal rung also wants post-merge drift evidence: proving the final ref differs from the expected branch only under allowed conformance paths. That is a natural second slice for this command surface, but it is not required for the first slice. Record it here so it does not get lost.

## Acceptance Criteria

- `accord check-scenario <scenario-index.jsonld>` runs all steps in listed order against the resolved fixture repository.
- Text output groups results per step; JSON output nests per-step reports in an ordered array with a scenario-level verdict.
- Exit status is non-zero when any step fails; all steps still execute and report.
- A step with a missing or unloadable manifest produces a stable per-step error, and remaining steps still run.
- Relative `manifestPath` values resolve against the scenario index document location.
- `defaultFixtureRepo` from the index is honored, with `--fixture-repo-path` as CLI override.
- `accord check` behavior and reports are unchanged.
- Existing black-box suite stays green; new black-box coverage exercises the runner end to end.

## Open Issues

- How should `hasLaneBinding` / `fromLaneState` / `toLaneState` participate in the first slice: honored, or explicitly ignored-with-warning until a consumer needs them?
- Should the first slice include step filtering such as `--step <id>`, or is whole-index execution enough initially?
- Should scenario indexes get SHACL shapes in `accord-shacl.ttl` so [[ac.completed.2026.2026-04-03-shacl-validation]] can validate them, and if so, in that task or this one?
- Is a scenario-level summary line (n passed / n failed / n errored) part of the text contract from day one?

## Decisions

- Expose the runner as a separate `accord check-scenario` command; do not overload `accord check`.
- Reuse the existing `src/scenario` loader and the existing vocabulary; no new scenario format.
- Default to run-all-steps with non-zero exit on any failure; no fail-fast in the first slice.
- Wrap the existing per-check report structure rather than redesigning it.
- Keep execution deterministic and local-only under the existing document-loading policy.
- Lane bindings are ignored-with-warning for execution in this first slice. They are loaded as topology metadata and surfaced in scenario reports, but they do not override the selected manifest case's `fromRef` / `toRef` because there is not yet a stable rule for choosing an executable lane when a step binds multiple lanes.
- Whole-index execution is enough for this slice; step filtering is deferred until a real consumer needs partial scenario runs.
- Scenario index SHACL shapes were already present in `accord-shacl.ttl`; this slice keeps them and adds a validate CLI regression fixture for a conformant scenario index rather than changing `accord validate` report shape.
- The text report includes a scenario-level step summary line from day one.

## Contract Changes

- New CLI command `accord check-scenario <scenario-index-path> [--fixture-repo-path <path>] [--format <text|json>]`.
- New scenario-level text and JSON report formats, defined as wrappers around the existing check report.
- No ontology changes needed; the scenario vocabulary already exists.
- No SHACL changes needed; scenario index shapes already exist in `accord-shacl.ttl`.

## Testing

- Unit tests for step ordering, manifest path resolution, fixture-repo resolution and override, and error isolation per step.
- Black-box coverage running a multi-step scenario index in `testdata/` with at least one passing step, one failing step, and one erroring step.
- JSON report snapshot coverage for the scenario envelope.
- Confirm the existing `accord check` black-box suite is untouched.
- Run `deno task fmt:check`, `deno task check`, and `deno task test`.

## Verification

- Added `tests/check_scenario_test.ts` for step ordering, manifest path resolution, `defaultFixtureRepo`, CLI override, lane-binding warnings, and per-step error isolation.
- Added black-box CLI coverage for `testdata/check-scenario-mixed.jsonld`, which reports one passing step, one missing-manifest error step, and one failing step in the ordered scenario JSON envelope.
- Added a validate CLI regression for the existing scenario index SHACL shapes.
- Ran `deno task fmt:check`, `deno task check`, and `deno task test`; all passed.
- Ran `deno task lint`; it currently fails on an existing `require-await` lint in `src/shacl/validate_manifest.ts`, outside the scenario-runner changes.

## Non-Goals

- Drift checking against allowed-path sets (recorded above as a likely second slice).
- Fail-fast execution modes or parallel step execution.
- Scenario authoring helpers or scaffolding (owned by [[ac.completed.2026.2026-07-04-draft-manifest]] for single manifests).
- Turning Accord into a general test framework or watch-mode runner.

## Implementation Plan

- [x] Define the scenario-level text and JSON report shapes as wrappers around the existing check report, and extend [[ac.spec.2026.2026-04-03-accord-cli]] first.
- [x] Add `check-scenario` parsing to `src/cli/parse_args.ts` and routing in `src/cli/router.ts`.
- [x] Implement the runner: load index via `src/scenario`, resolve manifests relative to the index, run the existing check pipeline per step, isolate per-step errors.
- [x] Decide and document lane-binding handling for the first slice.
- [x] Add unit and black-box tests including the mixed pass/fail/error scenario.
- [x] Update [[ac.user-guide]] and README command usage.
