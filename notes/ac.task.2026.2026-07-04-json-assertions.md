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

## Resolved Questions

- JSONPath dependency versus in-repo subset: the spike found viable dependencies, but the shipped implementation uses a declared in-repo subset so filters, slices, unions, and other broader constructs cannot become accidental contract.
- Attachment model: JSON assertions stand beside RDF expectations as `JsonExpectation` nodes that target `FileExpectation` nodes.
- `containsString`: out of scope for slice one; exact scalar equality plus `notExists` cover the first Stagecraft-shaped leak-scan fixtures.
- `.jsonld` artifacts: JSON assertions operate against the raw JSON form, not expanded JSON-LD/RDF.
- Numeric equality: `equals` uses strict JavaScript/JSON scalar equality after parsing. JSON numbers compare as numbers; strings do not coerce to numbers.

## Decisions

- JSON assertions are checker vocabulary and evaluation, not a new command; they run inside `accord check` like other expectations.
- Absence (`notExists`) is a first-class assertion kind, not an inversion flag on `exists`.
- Artifact content comes from the checked git ref only.
- No JSON Schema validation, no remote loading, no working-tree reads.
- Conditional (iff) assertions are out of scope for the first slice.
- Use an in-repo declared JSONPath subset rather than an RFC 9535 dependency. The Deno spike found usable packages, but the first slice needs only root, child access, wildcard, recursive descent, and array index; pulling a full RFC implementation would make filters, slices, unions, function expressions, and other grammar easy to accept accidentally. The checked package footprints were: `jsonpath-rfc9535@1.3.0`, 0 unique dependencies, 1.05 MB; `@swaggerexpert/jsonpath@4.0.4`, 1 unique dependency, 983.87 KB; `@jsonpath-tools/jsonpath@1.0.0`, 3 unique dependencies, 776.41 KB; `jsonpath-plus@10.3.0`, 3 unique dependencies, 1.03 MB; legacy `jsonpath@1.3.0`, 8 unique dependencies, 3.55 MB. The local subset keeps Accord's contract smaller than all of those options.
- Supported JSONPath syntax for this slice is exactly: `$`; dot child names such as `$.artifact.status`, where dot names match `[A-Za-z_][A-Za-z0-9_-]*`; bracket child names with quoted strings such as `$["artifact"]["status"]` or `$['artifact']`; child wildcards `.*` and `[*]`; recursive descent to names or wildcards such as `$..text`, `$.."participantAim"`, and `$..*`; and non-negative array indexes such as `$.items[0]`. Filters, slices, unions, script/current-node expressions, negative indexes, parent operators, function selectors, and descendant indexes are rejected as unsupported path syntax.
- Duplicate keys in asserted JSON artifacts fail closed with a dedicated duplicate-key report code before assertion evaluation.
- JSON assertions follow the existing RDF expectation style: `JsonExpectation` is a transition-case sibling that `targetsFileExpectation`, and each `JsonAssertion` hangs from it through `hasJsonAssertion`.
- JSON assertions operate on the raw JSON form of `.json` or `.jsonld` artifacts, not JSON-LD expanded RDF form.
- `equals` uses strict JSON scalar equality for strings, booleans, and numbers. `null`, arrays, and objects are out of scope for `expectedValue` in this slice.

## Contract Changes

- New ontology terms for JSON assertions (class, attachment property, path property, assertion-kind properties) in `accord-ontology.ttl`.
- New SHACL shapes for the vocabulary in `accord-shacl.ttl`.
- New checker report codes for JSON assertion pass, fail, parse error, duplicate-key error, and unsupported-path error.
- Documented supported path syntax as part of the checker contract.

## Testing

- Unit tests per assertion kind, including absence over wildcard/recursive paths and mismatch reporting.
- Unit tests for parse errors, duplicate-key behavior, and unsupported path syntax rejection.
- Black-box manifests covering a passing absence proof, a failing absence proof, and an `equals`/`count` mix.
- Focused run passed for JSON assertion, validation, and black-box suites: `deno task test -- tests/json_assertions_test.ts tests/validate_cli_test.ts tests/black_box_test.ts`.
- Gate passed: `deno task fmt:check`, `deno task check`, and `deno task test` (140 passed).

## Non-Goals

- JSON Schema or structural validation of application documents.
- Conditional/iff assertion vocabulary.
- Mutation, patching, or generation of JSON artifacts.
- Replacing RDF assertions for data that should be asserted as RDF.
- Domain-specific Stagecraft helpers.

## Implementation Plan

- [x] Spike RFC 9535 JSONPath options under Deno; record the dependency-versus-subset decision and its rationale here.
- [x] Design the manifest vocabulary alongside the existing `FileExpectation`/`RdfExpectation` pattern and extend [[ac.spec.2026.2026-04-03-accord-cli]] first.
- [x] Add ontology terms and SHACL shapes.
- [x] Implement artifact loading from the checked ref with explicit duplicate-key policy.
- [x] Implement the four assertion kinds with distinguishable report codes.
- [x] Add unit and black-box coverage, including the Stagecraft-shaped leak-scan absence proof.
- [x] Update [[ac.user-guide]], README, and [[ac.dev.general-guidance]] with the supported path syntax.
