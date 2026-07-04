---
id: y7zd4jpz6tt8ppy8nwh1xdl
title: 2026 07 04 Draft Manifest
desc: ''
updated: 1783149845965
created: 1783149845965
---

## Goals

- Remove the brittle handwork of enumerating file expectations for a transition by scaffolding them from the actual git diff.
- Stay conservative: the command drafts file expectations and infers compare modes; humans add semantic assertions.
- Emit a manifest that is immediately loadable by `accord check` and, once [[ac.task.2026.2026-04-03-shacl-validation]] lands, conforms to `accord validate`.

## Summary

This task lands product bet 3 from [[ac.product-ideas.runner-neutral-test-spec]]. Authoring a transition manifest today means hand-listing every added, updated, and removed path between two refs, which is exactly the kind of mechanical work that produces stale or incomplete manifests. The command shape is:

```sh
accord draft-manifest --from a.03 --to a.04 [--fixture-repo-path <path>] [--out <manifest.jsonld>]
```

It reads `git diff --name-status` between the two refs (via the existing `src/git` access layer, not worktree materialization), emits one file expectation per changed path with status mapped to `added`, `updated`, or `removed`, and infers a likely `compareMode` by extension: `rdfCanonical` for RDF artifact extensions the checker already supports, text for known text extensions, byte otherwise. The output is a valid JSON-LD manifest document with a single transition case and placeholder identifiers, written to stdout by default or to `--out`.

The temporal-rung guidance applies: conservative but useful. The draft is a starting point that a human reviews and extends with ASK or JSON assertions; it is not an auto-generated contract.

## Discussion

### Status mapping

- `A` → `added`
- `M` → `updated`
- `D` → `removed`
- `R*` → drafted as a `removed` expectation for the old path and an `added` expectation for the new path, since Accord's expectation vocabulary has no rename concept
- unchanged paths → omitted by default; an `--include-unchanged` flag can add them for immutability-heavy ladders like Stagecraft's `_history*/_s*/...` convention, but default output should not drown the reader

### Compare-mode inference

Inference should be a small explicit table, documented in the user guide: RDF artifact extensions the checker supports (`.ttl`, `.nt`, `.nq`, `.trig`, `.jsonld`) draft as `rdfCanonical`; known text extensions draft as text comparison; everything else drafts as byte comparison. Wrong guesses are fine — the point is a reviewable draft — but the table must be stable so authors learn it.

### Identifier minting

The draft needs node identifiers for the manifest, case, and expectations. Simple deterministic patterns derived from the ref pair and path (so re-running the command is idempotent) beat random ids. The exact convention should follow what existing manifests in `testdata/manifests` and the Semantic Flow corpus do.

### Validation relationship

The drafted manifest should pass `accord validate` once that command exists. Until then, the acceptance bar is that `accord check` can load the draft and evaluate it (it may legitimately fail the check if expectations are edited, but it must not fail to parse). If SHACL shapes and the drafter disagree about required properties, that is a bug in one of them and should be caught by a round-trip test once both exist.

## Acceptance Criteria

- `accord draft-manifest --from <ref> --to <ref>` emits a loadable JSON-LD manifest with one transition case covering the diff between the refs.
- Added, modified, deleted, and renamed paths are represented per the status mapping above.
- Compare modes follow the documented inference table.
- Output goes to stdout by default; `--out <path>` writes a file and refuses to overwrite an existing file without `--force`.
- Re-running with the same inputs produces byte-identical output.
- The drafted manifest loads and evaluates under `accord check` against the same ref pair, with all drafted file expectations passing before human edits.
- The command never touches the working tree state and requires no network access.

## Open Issues

- What existing manifest id/IRI conventions should the drafter mint? Survey `testdata/manifests` and the Semantic Flow corpus before deciding.
- Should the draft reference a shared context document or inline its context? Follow whatever existing manifests do.
- Is `--include-unchanged` in the first slice, or recorded as the immediate follow-up for immutability ladders?
- Should the drafter accept an ignore-pattern option mirroring the checker's `ignorePaths`, or is post-draft human deletion enough initially?

## Decisions

- The drafter emits file expectations only; it never fabricates ASK or JSON assertions.
- Use the existing `src/git` object access; no worktree materialization in runtime code.
- Deterministic, idempotent output is a hard requirement.
- Renames draft as remove-plus-add.
- Unchanged paths are omitted by default.

## Contract Changes

- New CLI command `accord draft-manifest --from <ref> --to <ref> [--fixture-repo-path <path>] [--out <path>] [--force]`.
- A documented compare-mode inference table as part of the command contract.
- No ontology changes; the drafter emits existing vocabulary only.

## Testing

- Unit tests for status mapping (including renames), compare-mode inference, deterministic id minting, and idempotent output.
- Black-box test: draft a manifest from a fixture repo ref pair, then run `accord check` on the draft and require a pass.
- Overwrite-protection test for `--out`.
- Once `accord validate` exists, a round-trip test that drafted output validates cleanly.
- Run `deno task fmt:check`, `deno task check`, and `deno task test`.

## Non-Goals

- Auto-generating semantic (ASK/JSON) assertions.
- Diffing working-tree state or uncommitted changes.
- Scenario-index scaffolding (single-manifest drafting only; scenario drafting can be a later idea if [[ac.task.2026.2026-07-04-scenario-runner]] usage demands it).
- Guessing `ignorePaths` or history conventions.

## Implementation Plan

- [ ] Survey existing manifest conventions (context reference, id patterns) in `testdata/manifests` and the Semantic Flow corpus; record the chosen minting convention here.
- [ ] Extend [[ac.spec.2026.2026-04-03-accord-cli]] with the command contract and inference table.
- [ ] Add CLI parsing and routing for `draft-manifest`.
- [ ] Implement diff reading over `src/git` and the expectation emitter with deterministic serialization.
- [ ] Add unit and black-box coverage including the draft-then-check round trip.
- [ ] Update [[ac.user-guide]] and README.
