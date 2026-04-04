---
id: ex778b6bn59mrvpbl09pzep
title: 2026 04 03 Accord CLI
desc: ''
updated: 1775232426867
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

That initial implementation now exists in this repository. The current checker supports:

- JSON-LD manifest loading with a deterministic local-only document-loader policy
- case selection and git-backed fixture repo resolution
- file expectations for `added`, `updated`, `unchanged`, `removed`, and `absent`
- `bytes` and `text` comparison
- `rdfCanonical` graph comparison using `n3` plus `rdf-canonize`
- SPARQL `ASK` assertions using Comunica against an in-memory `n3` store
- text and JSON reports
- unit and black-box coverage against the in-repo `testdata/` corpus

The main remaining work for this task is now follow-up rather than first-use scaffolding. The checker has passed the current real `mesh-alice-bio` corpus, and JSON-LD RDF artifact support has now landed as a separate follow-up. The remaining questions are how to keep that integration signal healthy, how much rerun automation to add, and whether other format work such as `json` compare mode or RDF/XML ever justifies more surface area.

The behavioral specification for the checker now lives in [[ac.spec.2026.2026-04-03-accord-cli]]. This task note should stay focused on planning, implementation, and follow-up decisions.

JSON-LD support for manifests is part of this task and is done. JSON-LD support for RDF artifact files under `rdfCanonical` and SPARQL `ASK` has been split into [[ac.completed.2026.2026-04-03-jsonld-support]] so that follow-up can be scoped and reviewed separately.

The first likely command is:

```bash
accord check examples/alice-bio/conformance/13-bob-extracted-woven.jsonld
```

with optional flags for selecting a case, overriding the fixture checkout path, or emitting JSON output for automation.

The current implementation direction has held up well in practice. Local work on this machine has now shown:

- `deno 2.7.8` runs successfully here
- `npm:n3` works for Turtle parsing and RDFJS store creation under Deno
- `npm:@comunica/query-sparql` loads under Deno and can evaluate `ASK` queries successfully against an RDFJS `n3` store
- `jsonld.js` works for manifest loading under Deno with the intended local-only loader policy
- `rdf-canonize` works under Deno for RDF canonicalization

That is enough to justify the Deno checker architecture already in place, but not enough to assume every required RDF syntax and corpus-level edge case is solved.

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

### Current corpus facts

The existing `mesh-alice-bio` manifest set already narrows the practical v1 scope:

- all 13 current manifests contain exactly one `TransitionCase`
- current file change usage is `added` 91, `unchanged` 38, `updated` 33, and `absent` 9
- no current manifests use `removed`
- current compare mode usage is `rdfCanonical` 81, `text` 80, and `bytes` 1
- no current manifests use `json`

Those facts should drive the implementation order:

- `accord check <manifest>` should default to the only case when exactly one case exists
- `--case` should remain available, but only as an override for future multi-case manifests
- v1 should prioritize `added`, `updated`, `unchanged`, and `absent`
- v1 should prioritize `bytes`, `text`, and `rdfCanonical`
- `removed` was easy enough to include once the file-state engine was in place, even though the current corpus does not require it
- `json` comparison should stay out of the critical path until a real manifest needs it

The simplest repository access model is probably local-git-only:

- `fixtureRepo` identifies the expected repository
- the CLI accepts a local checkout path for that repository, or infers it from the current working directory
- file contents at refs are read via `git show <ref>:<path>` or similar targeted commands

That avoids temporary worktrees in the first pass and keeps the checker deterministic and debuggable.

The current authoring files are JSON-LD manifests and the checker should handle them as JSON-LD from the start. The first implementation may still use a deterministic local document-loader policy so execution stays reproducible and fail-closed.

For compare modes, the first useful set is:

- `bytes`
- `text`
- `rdfCanonical`

That already covers the current `mesh-alice-bio` manifests.

For RDF execution, the promising Deno-first split is:

- `jsonld.js` for JSON-LD manifest loading and document-loader control
- `n3` for parsing Turtle/N-Quads and building RDFJS stores
- `Comunica` for SPARQL `ASK`
- `rdf-canonize` as the first canonicalization candidate for graph equivalence

The last point matters. `ASK` is already viable with Deno plus `n3` plus `Comunica`, but robust RDF canonical comparison is the harder part, especially once blank nodes matter.

At this point, both RDF canonical comparison and SPARQL `ASK` execution are implemented for the existing `n3`-parsed RDF syntaxes and for `.jsonld` RDF artifacts. The JSON-LD RDF artifact work is recorded in [[ac.completed.2026.2026-04-03-jsonld-support]].

### Proposed code layout

The first Accord CLI should stay flatter than Kato. The current recommended layout is captured in [[ac.spec.2026.2026-04-03-accord-cli]] and centers on:

- `src/cli` for argument parsing and command routing
- `src/manifest` for JSON-LD loading and case selection
- `src/git` for git-backed fixture reads
- `src/checker` for file, text, RDF, and ASK evaluation
- `src/report` for JSON and text report generation
- `tests/harness` for fixture materialization and CLI helpers
- `testdata/` for black-box fixture repos, manifests, and scenario indexes

## Open Issues

- Keep the committed `mesh-alice-bio` smoke subset representative as the real manifest corpus evolves.
- Decide whether the full `mesh-alice-bio` corpus rerun should become a dedicated scripted task in this repository or remain an explicit ad hoc integration check.
- Decide how much dependency weight is acceptable if `Comunica` stays in the stack, since its transitive npm graph is large even though the Deno interop itself appears workable.
- Decide whether generated HTML should remain `text`-compared, or whether the CLI should normalize line endings and other trivial text differences.
- Decide whether the first version should stop on first failure or accumulate all failures for the selected case.
- Decide whether a separate `accord validate` command should exist later for SHACL-oriented manifest validation.
- Decide whether `json` compare mode or RDF/XML support ever justify expanding the current format surface.

## Decisions

- Prefer a thin deterministic checker over a prompt-only workflow or a large runner framework.
- Treat LLMs as optional explainers and operators, not as the source of truth for conformance outcomes.
- Prefer a Deno-first CLI in this repository, provided the current `n3` and `Comunica` compatibility holds up in a real prototype.
- Keep the first version local and explicit:
  - local manifest file
  - local fixture checkout
  - local git refs
- Start with a single top-level command surface centered on `accord check`.
- For v1, `accord check <manifest>` should default to the only case when the manifest contains exactly one case, and accept `--case` only as an override when needed.
- The initial reporting shape should be human-readable text by default with optional machine-readable JSON via `--format json`.
- The first fixture access implementation should read git objects directly with targeted commands such as `git cat-file -e` and `git show <ref>:<path>`, not temporary worktrees.
- The first manifest loader should handle JSON-LD from the start rather than treating manifests as plain JSON with familiar keys.
- Prefer `jsonld.js` as the first JSON-LD dependency for manifest loading.
- Prefer `rdf-canonize` as the RDF canonicalization dependency for the current checker implementation.
- Scope the first useful checker to the features the current corpus actually needs:
  - file change types `added`, `updated`, `unchanged`, and `absent`
  - compare modes `bytes`, `text`, and `rdfCanonical`
- Include `removed` once the file-state engine is in place, even though it is not part of the current corpus-critical path.
- `json` compare mode is explicitly out of scope for the first checker until a real manifest requires it.
- Keep SHACL and manifest execution conceptually separate; full SHACL validation should not block the first `accord check` implementation.
- If SHACL preflight is added later, keep it as a separate command surface such as `accord validate` rather than silently folding it into `accord check`.
- Keep JSON-LD manifest support in the main checker scope, and record JSON-LD RDF artifact support separately in [[ac.completed.2026.2026-04-03-jsonld-support]].
- Support `.jsonld` RDF artifacts through a real JSON-LD-to-quads ingestion layer while keeping RDF/XML out of scope until a separate parser path is justified.
- Prefer fixing malformed fixture RDF in `mesh-alice-bio` over teaching Accord to coerce bad IRIs implicitly.

## Contract Changes

No Accord ontology or SHACL changes are required just to begin this task.

This task is about executable tooling for the existing Accord contract, not about broadening the manifest vocabulary. If tool implementation exposes a real missing semantic concept, that should be handled as a separate ontology/SHACL change rather than being hidden inside CLI behavior.

## Testing

- Keep the existing unit and synthetic black-box suite green as the baseline validator for new checker work.
- Keep a committed smoke suite against at least a representative subset of the real `mesh-alice-bio` manifests.
- Continue to include intentionally failing scenarios so the failure report format is exercised, not just the happy path.
- If SHACL preflight is ever wired into the CLI, test both valid and invalid manifests explicitly.

## Mesh-alice-bio validation

The current integration validation state is now concrete rather than speculative:

- a committed smoke subset covers `01-source-only`, `05-alice-knop-created-woven`, `09-alice-bio-referenced-woven`, `11-alice-bio-v2-woven`, and `13-bob-extracted-woven`
- a full local rerun against all 13 current manifests under `semantic-flow-framework/examples/alice-bio/conformance/` is green

The gap exposed during the first full-corpus pass turned out not to be an Accord runtime bug. The late-ladder failures were all `sparql_ask_mismatch` checks against `alice/_knop/_references/references.ttl`, `alice/_knop/_references/_history001/_s0001/references-ttl/references.ttl`, `bob/_knop/_references/references.ttl`, and `bob/_knop/_references/_history001/_s0001/references-ttl/references.ttl`.

Those files had authored `sflo:hasReferenceRole` values like `<sflo:ReferenceRole/Canonical>` and `<sflo:ReferenceRole/Supplemental>`. In Turtle, those are base-relative IRIs, not ontology IRIs. The fix belonged in the `mesh-alice-bio` fixture branches, and after correcting those role IRIs to the full ontology IRIs, all current manifests passed.

## Non-Goals

- Building a general workflow engine
- Replacing ordinary unit/integration tests in consuming repositories
- Performing Semantic Flow operations directly from Accord
- Hiding repository or git behavior behind a large abstraction layer
- Solving every future RDF serialization or canonicalization concern before the first usable checker exists
- Making Accord dependent on a browser runtime or a heavy web service

## Implementation Plan

- [x] Refine this task note into an explicit thin-checker design centered on `accord check`.
- [x] Split normative checker behavior into [[ac.spec.2026.2026-04-03-accord-cli]] so the task note can remain implementation-focused.
- [x] Decide the minimum supported command surface for v1:
  - `accord check <manifest>`
  - optional `--case <case-id>`
  - optional `--fixture-repo-path <path>`
  - optional `--format json`
- [x] Spike Deno package compatibility more thoroughly with real local manifest and RDF inputs, not just trivial in-memory examples.
- [x] Spike `npm:jsonld` with real local manifests, including inline context handling and the intended no-arbitrary-remote-fetch document-loader policy.
- [x] Spike `npm:rdf-canonize` with real local RDF inputs and confirm whether its Deno behavior is acceptable for `rdfCanonical`.
- [x] Decide the first-pass fixture access strategy: direct `git show` and `git cat-file` access rather than temporary worktree materialization.
- [x] Bootstrap the Deno CLI and test scaffold for this repository.
- [x] Create the initial Deno project layout from [[ac.spec.2026.2026-04-03-accord-cli]], including `src/cli`, `src/manifest`, `src/git`, `src/checker`, `src/report`, and `tests/harness`.
- [x] Create the in-repo `testdata/` layout and a test-only fixture materializer plan that turns source trees into temporary git repositories with the named refs required by [[ac.spec.2026.2026-04-03-accord-cli]].
- [x] Prototype manifest loading and case selection for JSON-LD inputs using a deterministic local document-loader policy.
- [x] Prototype file expectation checking for `added`, `updated`, `unchanged`, `removed`, and `absent`.
- [x] Prototype `text` and `bytes` comparison.
- [x] Prototype `rdfCanonical` handling with ignored-predicate filtering and SPARQL ASK execution.
- [x] Design the failure report structure for both humans and automation.
- [x] Author the first black-box manifests and scenario index under `testdata/` before relying on the larger `mesh-alice-bio` corpus.
- [x] Add unit tests for manifest loading, git-backed file access, change classification, and compare modes.
- [x] Add CLI smoke tests against a representative subset of the `mesh-alice-bio` manifests.
- [x] Run the checker against the full current `mesh-alice-bio` manifest set and record the gaps it exposes.
- [x] Revisit `json`, JSON-LD RDF artifact support, and separate SHACL preflight only after the thin checker passes the current corpus.
- [x] compose user documentation into [[ac.user-guide]]
- [x] compose development documentation into [[ac.dev.general-guidance]]
