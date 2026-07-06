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
- Emit a manifest that is immediately loadable by `accord check` and, once [[ac.completed.2026.2026-04-03-shacl-validation]] lands, conforms to `accord validate`.

## Summary

This task lands product bet 3 from [[ac.product-ideas.runner-neutral-test-spec]]. Authoring a transition manifest today means hand-listing every added, updated, and removed path between two refs, which is exactly the kind of mechanical work that produces stale or incomplete manifests. The command shape is:

```sh
accord draft-manifest --from a.03 --to a.04 [--fixture-repo-path <path>] [--out <manifest.jsonld>] [--force]
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

## Resolved Questions

- Existing manifest id/IRI conventions: `testdata/manifests` and the Semantic Flow conformance manifests use inline JSON-LD contexts, URN manifest ids, fragment case ids, and readable path-derived file expectation fragment ids such as `#mesh-inventory-ttl`.
- Context style: the drafter emits an inline context with the existing manifest terms it uses. It does not reference a shared context document in this slice.
- Unchanged paths: `--include-unchanged` is deferred. The first slice emits changed paths only from `git diff --name-status`.
- Ignore patterns: no draft-time ignore option in this slice. Authors can delete expectations or add `ignorePaths` after reviewing the draft.

## Decisions

- The drafter emits file expectations only; it never fabricates ASK or JSON assertions.
- Use the existing `src/git` object access; no worktree materialization in runtime code.
- Deterministic, idempotent output is a hard requirement.
- Renames draft as remove-plus-add.
- Unchanged paths are omitted by default.
- Manifest ids use `urn:accord:draft:<from-slug>-to-<to-slug>`. The single case id is `#draft-<from-slug>-to-<to-slug>`.
- File expectation ids use `#<changeType>-<path-slug>` derived from the repository path. If two paths slug to the same fragment, later collisions get a stable numeric suffix in output order.
- Drafts omit `fixtureRepo` to avoid baking local machine paths into generated manifests. The fixture repository remains a CLI input used to compute the diff.
- The output is pretty-printed JSON with a trailing newline. Re-running with the same refs and repository state produces byte-identical output.
- Because the drafter emits file expectations only, `rdfCanonical` file expectations are valid without a companion `RdfExpectation`. The checker performs direct graph comparison for untargeted `updated`/`unchanged` `rdfCanonical` file expectations with no ignored predicates; `RdfExpectation` remains the place for `ignorePredicate` and ASK assertions.

## Contract Changes

- New CLI command `accord draft-manifest --from <ref> --to <ref> [--fixture-repo-path <path>] [--out <path>] [--force]`.
- A documented compare-mode inference table as part of the command contract.
- No ontology vocabulary changes; the drafter emits existing vocabulary only.
- SHACL no longer requires every `rdfCanonical` file expectation to be inversely targeted by an `RdfExpectation`, because that rule was stronger than the file-expectation comparison model.

## Testing

- Unit tests for status mapping (including renames), compare-mode inference, deterministic id minting, and idempotent output.
- Black-box test: draft a manifest from a fixture repo ref pair, then run `accord check` on the draft and require a pass.
- Overwrite-protection test for `--out`.
- Round-trip test: drafted output validates cleanly with `accord validate`.
- Focused run passed: `deno test --allow-read --allow-write --allow-run --allow-env tests/draft_manifest_test.ts tests/check_scenario_test.ts tests/cli_parser_test.ts tests/validate_cli_test.ts`.
- Full gate passed: `deno task fmt:check`, `deno task check`, `deno task lint`, and `deno task test`.

## Non-Goals

- Auto-generating semantic (ASK/JSON) assertions.
- Diffing working-tree state or uncommitted changes.
- Scenario-index scaffolding (single-manifest drafting only; scenario drafting can be a later idea if [[ac.completed.2026.2026-07-04-scenario-runner]] usage demands it).
- Guessing `ignorePaths` or history conventions.

## Implementation Plan

- [x] Survey existing manifest conventions (context reference, id patterns) in `testdata/manifests` and the Semantic Flow corpus; record the chosen minting convention here.
- [x] Extend [[ac.spec.2026.2026-04-03-accord-cli]] with the command contract and inference table.
- [x] Add CLI parsing and routing for `draft-manifest`.
- [x] Implement diff reading over `src/git` and the expectation emitter with deterministic serialization.
- [x] Add unit and black-box coverage including the draft-then-check round trip.
- [x] Update [[ac.user-guide]] and README.
