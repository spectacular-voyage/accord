---
id: ex778b6bn59mrvpbl09pzep
title: 2026 04 03 Accord CLI
desc: ''
updated: 1775225028833
created: 1775224391133
---

## Goals

- Define a thin, deterministic Accord CLI checker rather than a large runner framework.
- Keep Accord manifests normative and runner-neutral while still making them executable.
- Evaluate whether a Deno-first implementation can rely on `npm:n3` and `npm:@comunica/query-sparql`.
- Identify the smallest useful command surface for checking real manifests against real fixture refs.

## Summary

This task is to design and then prototype a minimal Accord CLI that can load a manifest, validate its basic authoring assumptions, compare named fixture refs, evaluate file expectations, run RDF assertions, and report pass/fail results clearly.

The intended shape is a thin checker, not a workflow engine. It should not attempt to perform operations, create fixtures, or replace repository-native tests. It should simply answer: does this manifest describe what actually changed between these refs?

The first likely command is:

```bash
accord check examples/alice-bio/conformance/13-bob-extracted-woven.jsonld
```

with optional flags for selecting a case, overriding the fixture checkout path, or emitting JSON output for automation.

The current best implementation direction is a Deno CLI in this repository. A small local spike on this machine showed:

- `deno 2.7.8` runs successfully here
- `npm:n3` works for Turtle parsing and RDFJS store creation under Deno
- `npm:@comunica/query-sparql` loads under Deno and can evaluate `ASK` queries successfully against an RDFJS `n3` store

That is enough to justify a thin-checker prototype in Deno, but not yet enough to assume every required RDF and JSON-LD edge case is solved.

## Discussion

There are three broad options:

1. Prompt-only workflow
   - Manifest plus fixture refs are handed to an LLM agent.
   - The LLM interprets the manifest and reports whether the transition seems correct.
2. Thin deterministic checker
   - A small CLI performs file and RDF checks directly.
   - An LLM can still be used afterward to explain failures or propose fixes.
3. Full runner framework
   - Accord grows its own test-harness abstractions, fixtures, adapters, plugins, and execution stack.

The prompt-only option is too weak if the manifests are meant to be normative. It is useful as an operator workflow, but not as the ground truth. The full runner option is too much too early and cuts against the current Accord direction in `README.md`, which explicitly favors a semantic kernel plus a tiny reference validator.

The thin deterministic checker is the right middle ground.

The checker should likely work in phases:

1. Load and minimally validate the manifest.
2. Resolve the selected `TransitionCase`.
3. Open the referenced fixture repository locally.
4. Compare `fromRef` and `toRef` at the paths named by each `FileExpectation`.
5. For `rdfCanonical` expectations, load RDF, optionally filter ignored predicates, compare graph equivalence, and run ASK assertions.
6. Emit a clear result summary and a machine-readable report.

The first version should stay small. It does not need to understand every conceivable future Accord feature. It only needs to support the current manifest vocabulary well enough to execute the `mesh-alice-bio` examples.

The simplest repository access model is probably local-git-only:

- `fixtureRepo` identifies the expected repository
- the CLI accepts a local checkout path for that repository, or infers it from the current working directory
- file contents at refs are read via `git show <ref>:<path>` or similar targeted commands

That avoids temporary worktrees in the first pass and keeps the checker deterministic and debuggable.

For compare modes, the first useful set is:

- `bytes`
- `text`
- `rdfCanonical`

That already covers the current `mesh-alice-bio` manifests.

For RDF execution, the promising Deno-first split is:

- `n3` for parsing Turtle/N-Quads and building RDFJS stores
- `Comunica` for SPARQL `ASK`
- a separate canonicalization strategy for graph equivalence

The last point matters. `ASK` is already viable with Deno plus `n3` plus `Comunica`, but robust RDF canonical comparison is the harder part, especially once blank nodes matter.

## Open Issues

- Decide whether the CLI should perform SHACL validation itself, or treat SHACL validation as a separate preflight step.
- Decide how strict `rdfCanonical` must be in v1:
  - true RDF dataset canonicalization, including blank nodes
  - or a narrower initial implementation that is explicitly limited and documented
- Decide whether manifest loading should be JSON-LD-aware from day one, or whether the first version may parse the compact authoring shape directly and rely on separate SHACL/RDF validation for semantics.
- Decide how fixture repositories should be located:
  - explicit `--fixture-repo-path`
  - repo discovery from `fixtureRepo`
  - or both
- Decide whether file comparison should read target files directly from git objects with `git show`, or materialize temporary trees.
- Decide whether generated HTML should remain `text`-compared, or whether the CLI should normalize line endings and other trivial text differences.
- Decide the report format:
  - human-readable text only
  - JSON only
  - or text plus optional JSON
- Decide whether the first version should stop on first failure or accumulate all failures for the selected case.
- Decide how much dependency weight is acceptable if `Comunica` stays in the stack, since its transitive npm graph is large even though the Deno interop itself appears workable.
- Decide whether `accord check` should default to validating all cases in a manifest or require an explicit case selector when there are multiple cases.

## Decisions

- Prefer a thin deterministic checker over a prompt-only workflow or a large runner framework.
- Treat LLMs as optional explainers and operators, not as the source of truth for conformance outcomes.
- Prefer a Deno-first CLI in this repository, provided the current `n3` and `Comunica` compatibility holds up in a real prototype.
- Keep the first version local and explicit:
  - local manifest file
  - local fixture checkout
  - local git refs
- Limit the first implementation to the compare modes and expectation types already needed by the `mesh-alice-bio` manifests.
- Keep SHACL and manifest execution conceptually separate even if the CLI later offers a convenience preflight step.

## Contract Changes

No Accord ontology or SHACL changes are required just to begin this task.

This task is about executable tooling for the existing Accord contract, not about broadening the manifest vocabulary. If tool implementation exposes a real missing semantic concept, that should be handled as a separate ontology/SHACL change rather than being hidden inside CLI behavior.

## Testing

- Keep a small Deno compatibility spike for `n3` and `Comunica` in mind as the initial feasibility gate.
- Add unit tests for path/ref resolution and change-type evaluation.
- Add focused tests for compare modes:
  - `bytes`
  - `text`
  - `rdfCanonical`
- Add CLI smoke tests against at least a subset of the `mesh-alice-bio` manifests.
- Add at least one intentionally failing test case so the failure report format is exercised, not just the happy path.
- If SHACL preflight is wired into the CLI, test both valid and invalid manifests explicitly.

## Non-Goals

- Building a general workflow engine
- Replacing ordinary unit/integration tests in consuming repositories
- Performing Semantic Flow operations directly from Accord
- Hiding repository or git behavior behind a large abstraction layer
- Solving every future RDF serialization or canonicalization concern before the first usable checker exists
- Making Accord dependent on a browser runtime or a heavy web service

## Implementation Plan

- [x] Refine this task note into an explicit thin-checker design centered on `accord check`.
- [ ] Decide the minimum supported command surface for v1, including case selection and output format.
- [ ] Spike Deno package compatibility more thoroughly with real local manifest and RDF inputs, not just trivial in-memory examples.
- [ ] Decide the first-pass fixture access strategy: `git show`/`git cat-file` versus temporary worktree materialization.
- [ ] Prototype manifest loading and case selection for the current JSON-LD authoring shape.
- [ ] Prototype file expectation checking for `added`, `updated`, `unchanged`, `removed`, and `absent`.
- [ ] Prototype `text` and `bytes` comparison.
- [ ] Prototype `rdfCanonical` handling with ignored-predicate filtering and SPARQL ASK execution.
- [ ] Decide whether SHACL validation is a built-in CLI step or an explicit documented prerequisite.
- [ ] Design the failure report structure for both humans and automation.
- [ ] Run the checker against the existing `mesh-alice-bio` manifests and record the gaps it exposes.
