---
id: 57310fcbd912fe335a5cef72
title: 2026 05 14 Generalized Replay And Provenance
desc: ''
updated: 1778728187266
created: 1778728187266
---

## Goals

- Make Accord useful beyond git branch-to-branch fixture checks without turning it into a large workflow engine.
- Add a portable way for manifests or adjacent scenario documents to describe how a transition can be replayed.
- Support command provenance for command-backed transitions.
- Support source provenance for manually created, copied, fetched, or derived files.
- Keep the existing `accord check` behavior understandable while broadening the model in small, testable steps.
- Give downstream tools such as Weave's fixture ladder generator a shared contract instead of forcing each project to invent its own replay metadata shape.

## Summary

Accord currently works best when a transition is represented as a before ref and an after ref inside a local git fixture repository. That is valuable, but it is narrower than Accord's intended role as a reusable acceptance-spec layer.

The immediate pressure comes from Weave's fixture ladder generator work. Weave has branch-laddered fixture repositories, but the branches are becoming disposable generated outputs. The durable information should include both the expected after-state checks and enough replay metadata to regenerate the after-state from the before-state. Existing Accord manifests carry `operationId`, `fromRef`, `toRef`, targets, file expectations, and RDF expectations. They do not carry the exact command, command working directory, prompt policy, materialized inputs, remote source digest, or manual file-source provenance.

This task should define the first Accord-level model for generalized replay and source provenance. The first implementation can be metadata-only: load, preserve, validate, and expose the fields without making `accord check` execute commands. A later runner can use the same model to materialize directories, run commands, compare resulting workspaces, or update fixture branches.

## Current Behavior

The current CLI contract in [[ac.spec.2026.2026-04-03-accord-cli]] is intentionally narrow:

- `accord check <manifest-path>` selects one `TransitionCase`.
- The checker resolves a local git repository.
- It compares `fromRef` and `toRef` by reading git objects directly.
- It evaluates listed `FileExpectation` and `RdfExpectation` entries.
- It does not execute the operation named by `operationId`.
- It does not materialize a worktree for normal checks.
- It does not know how to compare directory snapshots, generated temporary workspaces, archives, or runner-produced outputs.
- It does not know how to record or validate replay commands or manually supplied source files.

That behavior should stay understandable while this task is designed, but it does not need to freeze the model. Non-breaking broadening is fine where it fits, and even a breaking manifest migration is acceptable if the replay/provenance shape is materially cleaner. The current real manifest corpus is small, so the main requirement is that any semantic change be explicit and rerunnable rather than accidental.

## Use Cases

Non-branch use cases that Accord should eventually support include:

- directory-backed snapshots where `from` and `to` are folders instead of git refs
- generated temporary workspaces where a runner executes a declared command and then checks the resulting filesystem directly
- manifest-scoped checks with no durable after branch, where the expected outcome is only the listed file/RDF expectations
- API or CLI conformance examples that use checked-in seed fixtures and runner-produced outputs
- ontology and config migrations where RDF canonical comparison matters more than byte-identical text or branch history
- cross-implementation conformance where another implementation can consume the same manifest without reproducing Weave's branch ladder
- negative or validation cases once Accord has an expected-error model

Branch refs should stay a first-class state locator, but they should not be the only state locator the model can express.

## Proposed Model Direction

Keep the model split into two layers:

- verification contract: the existing `TransitionCase`, `FileExpectation`, `RdfExpectation`, and future expected-error fields that say what must be true
- replay contract: optional metadata that says how a runner can reproduce the transition

The replay contract should be optional. A manifest that only wants to compare two git refs should remain small. A manifest that wants deterministic regeneration can opt into the richer shape.

Potential concepts:

- `StateLocator`: a description of a before or after state. First variants could include git ref, directory snapshot, generated workspace, and archive.
- `CommandInvocation`: executable, argv, working directory, environment overrides, stdin or prompt policy, expected exit code, and whether command logs are expected.
- `InputMaterialization`: files or directories to place before a command runs, including target path, source kind, and source digest.
- `SourceProvenance`: where bytes came from when no command generated them. Source kinds should include inline literal, fixture ref path, local checked-in source path, remote URL, and derived-from note or task reference.
- `ValidationProfile`: whether to use manifest-scoped checks only, whole-tree checks, ignored paths, guardrails, or runner-specific invariants.

The first JSON-LD shape can be deliberately conservative. It is better to support a few explicit fields well than to invent a generic workflow language.

## Command Provenance

Command-backed transitions should be able to record:

- executable name or path
- argv as an ordered list
- command working directory, expressed relative to the materialized workspace or fixture root where possible
- environment overrides that materially affect output
- prompt policy, such as non-interactive, accept preview, or expected confirmation text
- expected exit code or success/failure mode
- expected stdout/stderr fragments only when they are part of the conformance contract
- whether operational or audit logs should be produced

This does not require `accord check` to run the command. It gives runners a shared contract and lets Accord validate that the replay metadata is well-formed.

## Source Provenance

Manual or command-incomplete transitions need source provenance because there is no command invocation to explain where bytes came from.

For each created or replaced file, the replay contract should be able to record:

- target path in the materialized workspace
- source kind
- source locator, such as a fixture ref path, checked-in local path, URL, or inline value
- expected content digest for deterministic replay
- media type when it affects handling
- derivation note when the content is manually authored from a task or spec rather than copied byte-for-byte

Remote URLs need special care. A branch URL such as a raw GitHub `refs/heads/main` URL is not stable enough by itself. A deterministic replay should pin a digest, copy the bytes into a checked-in source fixture, use an immutable commit/tag URL, or combine those strategies.

One practical source-bundling pattern is to put required replay inputs in the fixture repository before cutting the first fixture rung, for example under a top-level `.assets/` directory on the branch that seeds `00-blank-slate`. Later rungs can then materialize command inputs by copying from `.assets/` instead of refetching remote or manually reconstructed content. If Accord supports this pattern, the manifest should still identify `.assets/` files as harness/source material rather than expected product output, and whole-tree comparison should ignore them unless a case explicitly lists them as expectations.

## Relationship To Weave

Weave's fixture ladder generator should pause long enough for this Accord contract to be sketched and accepted. Otherwise Weave will bake replay commands and source provenance into a private TypeScript shape that Accord will need to re-model soon afterward.

That does not mean Weave must wait for a full Accord runner implementation. A pragmatic sequence is:

1. Add this Accord task and settle the minimal replay/provenance vocabulary.
2. Add metadata fields to Accord's ontology, context, SHACL, and manifest loader, while keeping `accord check` behavior unchanged.
3. Let Weave's first dry-run planner consume that manifest metadata, with temporary Weave-local adapters only where Accord execution is not ready.
4. Later decide whether Accord itself should grow a replay/check-generated-workspace command or stay as a manifest library plus checker.

The important boundary is that command and source provenance should be portable Accord data, not hidden inside Weave-only generator code.

## Open Issues

- Should replay metadata live directly on `TransitionCase`, or should it be a linked `ReplayProfile` / `ReproductionProfile` node?
- Should `fromRef` and `toRef` remain git-specific convenience fields while generalized state locators use new fields, or should they be deprecated in favor of `fromState` and `toState`?
- Should Accord eventually execute commands, or should execution remain the responsibility of downstream runners that consume the manifest model?
- Should source provenance be part of the Accord ontology, or should Accord import a more general provenance vocabulary once the shape is mature?
- How much environment and prompt metadata is enough before this becomes a workflow engine?
- Should remote source digests be required for URL-backed source materialization?
- Should checked-in replay assets use a conventional path such as `.assets/`, and should Accord provide first-class semantics for harness-source files that are present in fixture refs but excluded from product output checks?
- Should expected-error cases be modeled in the same pass, since replay runners will need to distinguish failed commands from failed checks?
- How should whole-tree checks, `ignorePaths`, and generated workspace checks compose?

## Decisions

- Keep current `accord check` branch-to-branch behavior understandable while this feature is designed; prefer non-breaking changes, but allow explicit manifest migrations when they produce a cleaner replay/provenance model.
- Treat branch refs as one state-locator adapter, not the whole Accord model.
- Keep replay metadata optional.
- Do not make Accord a general-purpose workflow language.
- Prefer explicit command and source provenance over relying on task notes, chat archives, or generated branch history.
- Downstream generators can execute replay metadata before Accord itself has a command-running surface.
- Store execution-oriented replay metadata on a linked `ReplayProfile`, embedded directly in compact JSON-LD when convenient. This keeps `TransitionCase` readable as the verification contract while leaving a natural place for future runner/execution semantics.
- Add generalized `fromState` and `toState` object locators while keeping `fromRef` and `toRef` as git-ref convenience fields for current `accord check`. Do not make `fromState` / `toState` formal OWL superproperties of `fromRef` / `toRef`: the former point to state-locator nodes and the latter are literal datatype fields. A runner can still synthesize `gitRefState` locators from `fromRef` / `toRef`.
- Put source provenance in the Accord ontology now, with a small `SourceProvenance` shape rather than importing a broader provenance ontology before the workflow is real.
- Treat `.assets/` as a useful convention, not a special source root. Replay sources can come from anywhere; future whole-tree checks should use case-level `ignorePaths` such as `.assets/**` to exclude harness source files unless they are explicitly listed as expectations.
- Defer expected-error modeling until replay execution semantics exist.

## Replay Profile Tradeoffs

A linked `ReplayProfile` has real advantages:

- it keeps the checker-facing case compact when no replay data is needed
- it separates "what must be true" from "how a runner may reproduce it"
- it can later be shared, versioned, or swapped without changing file/RDF expectations
- it gives future command execution a node where runner policy, materialization, logs, and prompt behavior can grow

The cost is a little more JSON-LD indirection for simple manifests. The compact authoring shape can keep that cost low by embedding the profile as a nested object under `hasReplayProfile`.

## Workflow Engine Check

Existing workflow engines are worth knowing about, but none should be adopted for this first Accord slice. CWL is the closest conceptual match because it standardizes command-line tools and workflows, and WDL also models task commands explicitly. Nextflow and Snakemake are powerful for larger pipeline orchestration. All of them are heavier than Accord's immediate need: portable replay metadata plus source provenance attached to an acceptance manifest. If Accord later grows a real runner with DAG execution, CWL should be revisited before inventing a broad workflow language.

## Composition Guess

For now, compose the pieces this way:

- `TransitionCase` owns the verification contract, git-compatible `fromRef` / `toRef`, optional generalized `fromState` / `toState`, and case-level `ignorePaths`.
- `ReplayProfile` owns replay-only metadata: command invocation, input materialization, and manual file operations.
- `ignorePaths` only affects future whole-tree or generated-workspace completeness checks. Explicit `FileExpectation` entries still win.
- source provenance can appear on replay input materialization or manual file operations; command-produced output stays verified by file/RDF expectations unless a later runner records derived execution provenance.

## Contract Changes

Likely Accord model additions:

- optional replay or reproduction metadata on a `TransitionCase`
- command invocation data with ordered argv
- source materialization data for files created before execution
- source provenance data for manual or command-incomplete transitions
- generalized state locators that can eventually represent directory-backed or generated states as well as git refs
- validation profile metadata for manifest-scoped versus whole-tree checks

The current `fromRef` and `toRef` fields can remain supported if they still fit the generalized model. If replacing them with cleaner state-locator fields makes the contract clearer, migrate the small existing manifest corpus intentionally rather than preserving awkward compatibility.

## Testing

- Add manifest-loader tests that preserve command invocation metadata from compact JSON-LD and expanded JSON-LD.
- Add manifest-loader tests for manual source provenance entries.
- Add ontology and SHACL tests for required command/source fields once the vocabulary is chosen.
- Add a black-box manifest that includes replay metadata but still passes through current path-scoped `accord check` without changing results.
- Add a synthetic non-git state-locator fixture once the runner/checker semantics are defined.
- Add tests proving URL-backed source materialization requires either a digest or an explicit nondeterministic marker, depending on the chosen contract.

## Non-Goals

- Replacing ordinary unit tests.
- Replacing Weave's fixture ladder generator.
- Requiring every Accord manifest to include replay metadata.
- Executing arbitrary commands from manifests in the current `accord check` command.
- Building a full DAG workflow engine.
- Solving branch update or publication behavior for fixture repositories.

## Implementation Plan

- [x] Review Weave's current fixture ladder use case and extract the minimal replay/provenance fields needed by its generator.
- [x] Decide whether replay metadata lives directly on `TransitionCase` or on a linked profile node.
- [x] Draft JSON-LD examples for one command-backed transition and one manual file-operation transition.
- [x] Add ontology terms and JSON-LD context entries for the accepted minimal shape.
- [x] Add SHACL constraints for command invocation and source provenance fields.
- [x] Add TypeScript manifest model fields that preserve the replay/provenance data.
- [x] Add loader tests for compact and expanded JSON-LD forms.
- [x] Update [[ac.spec.2026.2026-04-03-accord-cli]] to clarify that current `accord check` ignores replay metadata except for validation/preservation until an execution surface exists.
- [x] Update [[ac.user-guide]] with guidance about when to use Accord as a checker only and when to include replay metadata for downstream runners.
- [ ] Coordinate with Weave's [[wd.task.2026.2026-05-07-fixture-ladder-generator]] so the first Weave dry-run planner consumes the Accord-owned replay shape.
