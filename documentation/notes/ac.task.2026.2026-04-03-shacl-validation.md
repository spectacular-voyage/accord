---
id: pctn19l0n6p3cm08t5wacis
title: 2026 04 03 Shacl Validation
desc: ''
updated: 1775260838740
created: 1775260819900
---

## Goals

- Decide whether Accord should add SHACL-based manifest validation now that `accord check` exists.
- Keep the existing `accord check` command thin and deterministic rather than turning it into a mixed execution-plus-authoring validator.
- Evaluate JavaScript/TypeScript SHACL validator options against the current `accord-shacl.ttl`, not against an imagined Core-only subset.
- Define the smallest useful command surface and rollout plan if SHACL validation lands.

## Summary

Accord already has a SHACL file, but the current CLI does not execute it. That is an intentional gap, not an oversight. `accord check` exists to answer whether a manifest matches fixture refs and expected outputs, while SHACL answers whether the manifest is well-formed as RDF authoring data.

The current `accord-shacl.ttl` is not limited to SHACL Core. It uses `sh:sparql` constraints in multiple places, including rules around when `compareMode` is required and whether an `RdfExpectation` targets a file expectation in the same transition case. That matters because a validator that does not support SHACL-SPARQL would not actually validate the shipped Accord shapes graph.

That makes the command-surface decision clearer:

- do not silently add SHACL preflight inside `accord check`, even as warning-only behavior
- if SHACL validation lands, expose it as a separate command such as `accord validate <manifest>`
- make that command authoritative by default and fail on non-conforming manifests
- treat warning-only behavior as possible later ergonomics, not as the base design

Among the current JavaScript and TypeScript options, `shacl-engine` is the best first spike candidate because it works with RDF/JS datasets and explicitly supports SHACL SPARQL-based constraints and targets through its SPARQL plugin. `rdf-validate-shacl` is a poor fit for current Accord because its own README says it does not support SHACL-SPARQL constraints. `shacl-processor-ts` appears oriented toward RDF Connect stream pipelines rather than a thin local CLI, so it is a weaker first choice for Accord even though it may still be useful in other contexts.

## Discussion

### Why this should stay separate from `accord check`

There is a real temptation to treat SHACL as a lightweight preflight. That would be convenient only if the output semantics were unimportant. They are important.

If `accord check` starts running SHACL as a warning-only side effect, several things get worse:

- authors no longer know whether a warning is advisory noise or a real contract problem
- CI has to explain two different failure domains through one command surface
- the checker becomes harder to reason about because authoring validation and transition execution are mixed together
- future output formats have to interleave runtime failures with SHACL validation reports

The cleaner split is:

- `accord check` answers whether the selected case conforms to the named fixture transition
- `accord validate` answers whether the manifest itself is structurally valid against Accord’s authoring constraints

That also matches the current repository direction in `README.md` and [[ac.task.2026.2026-04-03-accord-cli]], both of which already lean toward keeping SHACL separate from the execution checker.

### Current shapes-graph reality

The current `accord-shacl.ttl` already depends on SHACL-SPARQL. Examples include:

- `FileExpectationShape` rules that require `compareMode` for `added`, `updated`, and `unchanged`
- `FileExpectationShape` rules that forbid `compareMode` for `removed` and `absent`
- `RdfExpectationShape` rules that require the targeted file expectation to live in the same transition case
- `TransitionCaseShape` rules that reject two different file expectations with the same `accord:path`

That means "pick the nicest Core-only validator" is the wrong question. Either Accord uses a validator that can execute the current shapes graph, or Accord rewrites the shapes to avoid `sh:sparql`. Rewriting the shapes just to fit a library would be backwards.

### Candidate libraries

#### `shacl-engine`

`shacl-engine` is the strongest first candidate.

Pros:

- RDF/JS-native, which matches the rest of Accord’s current checker stack
- explicitly supports SHACL SPARQL-based constraints and SPARQL-based targets through `shacl-engine/sparql.js`
- presents itself as a general-purpose validator library, not only a CLI wrapper
- performance claims are good enough to justify a spike

Risks:

- Accord still needs a Deno compatibility spike against the actual npm package
- the SPARQL support is plugin-based, so the validator wiring must be explicit
- Accord will still need its own result formatting layer rather than dumping raw validation reports directly

#### `rdf-validate-shacl`

`rdf-validate-shacl` is not the right first pick for current Accord.

Pros:

- mature RDF/JS-based library
- active enough to be credible
- clean library API

Blocking issue:

- its README explicitly says it does not support SHACL-SPARQL constraints

That limitation is not theoretical. It means the current Accord shapes graph would only be partially enforced unless the shapes were rewritten.

#### `shacl-processor-ts`

`shacl-processor-ts` is not the best fit for this task as currently framed.

Pros:

- TypeScript implementation
- supports pipeline configuration with configurable fatal versus non-fatal validation
- already acknowledges multiple RDF input MIME types

Risks:

- the README frames it as an RDF Connect processor for validating incoming RDF streams
- that makes it look more like pipeline middleware than a thin reusable validator for Accord’s CLI
- I am inferring from its documented surface that it is a weaker fit for Accord’s current architecture, not claiming it is incapable of being adapted

### Recommended shape

If this work lands, the recommended first version is:

```bash
accord validate path/to/manifest.jsonld
```

with likely follow-up flags such as:

- `--format json`
- `--shapes <path>` only if local development truly needs shape overrides
- possibly `--warn-only` later, but not as the default contract

The execution model should stay deterministic and local-only:

1. load the manifest through the existing JSON-LD loader policy
2. expand it to RDF quads or dataset form
3. load the shipped `accord-shacl.ttl`
4. run SHACL validation with a validator that can execute the current `sh:sparql` constraints
5. emit a stable text or JSON report
6. return a failing exit status when the manifest does not conform

The important point is that this command validates authored contract data, not fixture transitions. It should therefore be callable in authoring workflows and CI before `accord check`, but not hidden inside it.

## Open Issues

- Confirm whether `shacl-engine` runs cleanly under the current Deno 2.x npm bridge with Accord’s RDF/JS types and parser stack.
- Decide whether `accord validate` should validate the entire manifest graph only, or also support focus-node filtering for faster author feedback.
- Decide whether the first report format should include only SHACL result messages or also post-processed Accord-specific help text.
- Decide whether warning-only behavior is needed at all once a separate `accord validate` command exists.
- Decide whether shape overrides should be supported, or whether the command should always use the repository’s shipped `accord-shacl.ttl`.

## Decisions

- Do not add implicit SHACL preflight to `accord check`.
- Keep SHACL validation as a separate command surface, with `accord validate` as the working name.
- Prefer failing validation by default rather than warning-only behavior.
- Evaluate `shacl-engine` first because current Accord shapes require SHACL-SPARQL support.
- Do not rewrite `accord-shacl.ttl` to avoid `sh:sparql` solely to fit a weaker validator.
- Keep the same deterministic local-only JSON-LD document-loading policy when validating manifests with SHACL.

## Contract Changes

No ontology changes are required to begin this work.

This task is about executing the existing `accord-shacl.ttl` file through the CLI, not about changing the Accord vocabulary. If the implementation exposes weak or missing authoring constraints, those should be handled as targeted SHACL updates rather than folded into ad hoc CLI logic.

If the work lands, the CLI contract changes would be in the command surface, not in the ontology:

- add a separate `accord validate` command
- define its exit behavior and report format
- keep `accord check` behavior unchanged

## Testing

- Add unit tests around manifest-to-dataset loading under the same fail-closed JSON-LD policy already used elsewhere in Accord.
- Add validator tests that exercise the current `sh:sparql` constraints explicitly rather than only happy-path SHACL Core checks.
- Add CLI tests for both passing and failing manifests through `accord validate`.
- Add at least one invalid-manifest fixture per important shape rule so the error report remains stable and understandable.
- Re-run the existing checker suite to confirm SHACL support does not leak into `accord check`.

## Non-Goals

- silently running SHACL validation as a warning-only preflight inside `accord check`
- rewriting the current Accord shapes graph to avoid SHACL-SPARQL just to fit a library choice
- adding SHACL-JS, SHACL-AF, or other extended features before the base validator path exists
- permitting remote JSON-LD document loading during validation
- treating SHACL validation as a replacement for the deterministic fixture-transition checks in `accord check`

## Implementation Plan

- [ ] Confirm Deno compatibility for `shacl-engine` with the current Accord toolchain and RDF/JS dataset flow.
- [ ] Extend the CLI spec and user documentation to define `accord validate <manifest>` as a separate command from `accord check`.
- [ ] Reuse the existing manifest JSON-LD loader policy to produce a dataset suitable for SHACL validation.
- [ ] Load the repository’s shipped `accord-shacl.ttl` into the validator and wire in SHACL-SPARQL support explicitly.
- [ ] Convert raw validation output into stable Accord text and JSON reports.
- [ ] Decide whether any opt-in soft mode such as `--warn-only` is still justified after the separate command exists.
- [ ] Add unit and CLI tests for valid manifests and for failures caused by the current `sh:sparql` constraints.
- [ ] Revisit whether further SHACL ergonomics are needed only after the separate validator command is proven useful.
