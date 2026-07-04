---
id: aj3pjv9fn4cdxopidbft7uj
title: 2026 07 04 Json Assertions
desc: ''
updated: 1783149845965
created: 1783149845965
---

## Goals

- Let manifests prove contract-level facts about JSON and JSON-LD artifacts without pushing those checks into application code.
- Make absence proofs ("this text must not leak", "this key must not appear") first-class for JSON artifacts, matching Accord's absence-proof identity on the RDF side.
- Keep the assertion surface small, deterministic, and artifact-scoped: values are read from the checked git ref, never the working tree.
- Choose one query addressing scheme consciously (JSONPath subset versus JSON Pointer) instead of growing one ad hoc.

## Summary

This task lands product bet 1 from [[ac.product-ideas.runner-neutral-test-spec]], plus the JSON half of bet 5 (negative expectations). During the Stagecraft Plan B and temporal rungs, checks like "evidence pointers resolve", "no participant-aim text leaks", and "recommendedActantIntent appears iff disposition is reviseBeforeUse" had to live in Stagecraft C++ and SHACL because Accord only speaks file presence, text/byte/RDF comparison, and SPARQL ASK. Those are contract-level facts about artifacts in the transition, so Accord should be able to assert them.

The shape mirrors the existing `SparqlAskAssertion` pattern: a JSON assertion attaches to a file expectation (or targets an artifact path), addresses into the parsed JSON document, and states an expectation. A first slice needs only a few assertion kinds:

- `exists` — the addressed location matches at least one value
- `notExists` — the addressed location matches nothing (the absence proof)
- `equals` — the addressed location matches a given scalar value
- `count` — the addressed location matches exactly n values

The conditional shape "A appears iff B" from Stagecraft is deliberately out of the first slice; in a case-scoped manifest it decomposes into an `exists`/`equals` pair or a `notExists` in the appropriate case, and a real conditional vocabulary should wait for repeated demand.

## Discussion

### Addressing scheme

Two credible options:

1. JSONPath (RFC 9535). Expressive enough for "any element in this array has this key" and leak scans. Needs either a Deno-compatible dependency spike or a documented in-repo subset — and the SPARQL evaluator history says an accidental subset is the trap to avoid. If an in-repo subset is chosen, document exactly what is accepted and add rejection tests for everything else.
2. JSON Pointer (RFC 6901). Trivial to implement and fully deterministic, but no wildcards, so "no participant-aim text anywhere in this document" is not expressible per-element. Probably too weak alone for the leak-scan use case.

Recommended posture: spike a small RFC 9535 implementation for Deno first; if nothing is clean, implement a declared JSONPath subset (root, dot/bracket child, wildcard, recursive descent, array index) in-repo with explicit rejection of everything else.

### Leak scans

"No participant-aim text leaks" is a scan, not a single-location lookup. The first slice can support it as `notExists` over a recursive-descent path plus an `equals`/contains-style match on string values. If substring matching is added, it must be a distinct assertion kind (for example `containsString`), not an overload of `equals`.

### Duplicate keys

[[ac.task.2026.2026-04-03-shacl-validation]] records the JSON-LD duplicate-key silent-overwrite hazard. The JSON assertion loader should decide explicitly whether duplicate keys in an asserted artifact are an error. Failing closed (report a parse-stage error) is the safer default for evidence purposes and should be the starting position.

### What this is not

Accord is not becoming a JSON Schema validator or a general test framework. Structural validity of application JSON belongs to the application. Accord asserts specific contract-level facts named in a manifest.

## Acceptance Criteria

- A manifest can attach a JSON assertion to an artifact path and prove `exists`, `notExists`, `equals`, and `count` facts against the artifact content at the checked ref.
- At least one black-box manifest proves an absence fact (`notExists`) as a positive passing assertion.
- Asserted artifacts are read from the git ref under check, never the working tree.
- Malformed JSON, unsupported path syntax, and duplicate-key artifacts (if fail-closed is confirmed) each produce stable, distinguishable report codes rather than raw stack traces.
- The supported path syntax is documented exactly, with rejection tests for unsupported constructs if a subset is implemented in-repo.
- Existing checker behavior and report formats for file, text, RDF, and ASK evaluation are unchanged.
- New vocabulary is covered by `accord-ontology.ttl` and `accord-shacl.ttl` shapes so `accord validate` can enforce authoring rules once it lands.

## Open Issues

- JSONPath dependency versus in-repo subset: what does the Deno spike show?
- Should JSON assertions attach to `FileExpectation` nodes like `hasAskAssertion` does for RDF expectations, or stand alongside `RdfExpectation` as a sibling `JsonExpectation` targeting a path? The manifest model should follow whichever reads better next to the existing vocabulary.
- Is `containsString` (or a match-kind discriminator) needed in slice one for the leak-scan case, or can Stagecraft's first uses land with exact-value matching?
- Do `.jsonld` artifacts get JSON assertions against their raw JSON form, their expanded form, or both? Raw-form-only is the simple, defensible first answer.
- How should numeric equality behave (JSON number versus string, integer versus float)?

## Decisions

- JSON assertions are checker vocabulary and evaluation, not a new command; they run inside `accord check` like other expectations.
- Absence (`notExists`) is a first-class assertion kind, not an inversion flag on `exists`.
- Artifact content comes from the checked git ref only.
- No JSON Schema validation, no remote loading, no working-tree reads.
- Conditional (iff) assertions are out of scope for the first slice.

## Contract Changes

- New ontology terms for JSON assertions (class, attachment property, path property, assertion-kind properties) in `accord-ontology.ttl`.
- New SHACL shapes for the vocabulary in `accord-shacl.ttl`.
- New checker report codes for JSON assertion pass, fail, parse error, and unsupported-path error.
- Documented supported path syntax as part of the checker contract.

## Testing

- Unit tests per assertion kind, including absence over wildcard/recursive paths and mismatch reporting.
- Unit tests for parse errors, duplicate-key behavior, and unsupported path syntax rejection.
- Black-box manifests covering a passing absence proof, a failing absence proof, and an `equals`/`count` mix.
- If a dependency is adopted, a pinned-version note and coverage that exercises the constructs Accord commits to.
- Run `deno task fmt:check`, `deno task check`, and `deno task test`.

## Non-Goals

- JSON Schema or structural validation of application documents.
- Conditional/iff assertion vocabulary.
- Mutation, patching, or generation of JSON artifacts.
- Replacing RDF assertions for data that should be asserted as RDF.
- Domain-specific Stagecraft helpers.

## Implementation Plan

- [ ] Spike RFC 9535 JSONPath options under Deno; record the dependency-versus-subset decision and its rationale here.
- [ ] Design the manifest vocabulary alongside the existing `FileExpectation`/`RdfExpectation` pattern and extend [[ac.spec.2026.2026-04-03-accord-cli]] first.
- [ ] Add ontology terms and SHACL shapes.
- [ ] Implement artifact loading from the checked ref with explicit duplicate-key policy.
- [ ] Implement the four assertion kinds with distinguishable report codes.
- [ ] Add unit and black-box coverage, including the Stagecraft-shaped leak-scan absence proof.
- [ ] Update [[ac.user-guide]], README, and [[ac.dev.general-guidance]] with the supported path syntax.
