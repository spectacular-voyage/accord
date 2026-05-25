---
id: 42s22av1s9kdy6x2gekrthh
title: 2026-05-03-ignorePaths
desc: ''
updated: 1777854796323
created: 1777854796323
---

## Goals

- Add an explicit way for Accord manifests to document paths that are intentionally outside the transition contract.
- Keep ordinary `accord check` behavior deterministic: listed `FileExpectation`s remain authoritative for explicit file/RDF checks, while whole-tree completeness reports unexpected unlisted changes.
- Support whole-tree and future generated-workspace checks without forcing manifests to list unrelated files such as project `README.md`.
- Avoid using ignored paths as a broad escape hatch for files that should be modeled with `FileExpectation`.

## Summary

Accord now runs a whole-tree transition completeness check in addition to evaluating the paths named by `hasFileExpectation`. That check compares all file paths in the selected `fromRef` and `toRef`, then reports added, removed, or updated paths that are not covered by explicit expectations.

`ignorePaths` is the case-level escape valve for paths that are intentionally outside the transition contract. The Fantasy Rules sidecar fixture was the motivating case: `README.md` or harness assets can change as project guidance evolves, but they are not part of a Semantic Flow transition contract and should not have to be listed as unchanged files merely to satisfy whole-tree completeness.

The implemented feature is a manifest/case-level `ignorePaths` list. These paths are repository-root-relative path patterns that tell whole-tree comparison tooling which files to exclude from "unexpected changed file" checks. They do not suppress checks for any path that is explicitly named by `hasFileExpectation`; Accord reports that as a contradictory manifest instead of silently hiding the explicit expectation.

## Current Behavior

The current checker evaluates:

- each listed `FileExpectation`
- any `RdfExpectation` targeting a listed file expectation
- optional RDF `ignorePredicate` rules for canonical graph comparison
- whole-tree transition completeness between `fromRef` and `toRef`

Whole-tree completeness reports unexpected added, removed, or updated paths that are not covered by explicit file expectations and are not matched by `ignorePaths`. `absent` expectations remain assertion-only and do not cover a changed tree path.

The manifest model, JSON-LD loader, ontology, SHACL, checker, reports, black-box tests, spec, and user guide now all carry the `ignorePaths` contract.

## Manifest Shape

Use a plural property on `TransitionCase`:

```json
{
  "type": "TransitionCase",
  "ignorePaths": [
    "README.md",
    ".weave/**"
  ]
}
```

The same property can be represented in JSON-LD with the existing manifest context:

```json
"ignorePaths": {
  "@container": "@list"
}
```

The implemented path syntax is deliberately conservative:

- exact repository-relative file paths, such as `README.md`
- directory-subtree globs ending in `/**`, such as `.weave/**`
- simple `*` inside one path segment, such as `generated/*.ttl`
- no absolute paths
- no `..` segments
- no backslashes
- no full minimatch feature set until there is a real need

The plural `ignorePaths` name is deliberately different from RDF comparison's `ignorePredicate`; one filters paths in fixture-tree completeness checks, the other filters RDF predicates inside a file comparison.

## Semantics

`ignorePaths` means:

- ignored paths are excluded from whole-tree "unexpected path" or "unexpected change" checks
- ignored paths are not excluded from explicit `FileExpectation` checks
- if a path is both matched by `ignorePaths` and named by `hasFileExpectation`, Accord reports an `ignore_path_conflict` error rather than hiding the explicit expectation
- ignored paths do not affect `RdfExpectation`
- ignored paths do not affect git ref resolution or fixture repository selection
- ignored paths are repository-root-relative, matching `FileExpectation.path`

This keeps the feature narrow. It is not a replacement for `absent`, `removed`, `added`, `updated`, or `unchanged`.

## Example

For a sidecar fixture transition, the manifest can focus on mesh output while acknowledging unrelated project documentation:

```json
{
  "operationId": "weave",
  "fromRef": "02-sidecar-mesh-created",
  "toRef": "03-sidecar-mesh-created-woven",
  "ignorePaths": [
    "README.md"
  ],
  "hasFileExpectation": [
    {
      "path": "docs/_mesh/_inventory/inventory.ttl",
      "changeType": "modified",
      "compareMode": "rdfCanonical"
    },
    {
      "path": "docs/_mesh/index.html",
      "changeType": "added"
    }
  ]
}
```

In current `accord check`, omitting `README.md` is not enough once whole-tree completeness sees it change. The explicit ignore documents that the path is outside the transition contract and prevents an unexpected-change report.

## Open Issues

- Decide whether manifest-level ignore defaults are useful once more multi-case manifests exist.
- Decide whether whole-tree completeness should remain always-on for `accord check` or gain an opt-out/profile knob after more real fixture corpora use it.
- Decide whether the simple single-segment `*` support is enough, or whether a small glob library is justified.
- Decide whether scenario-level validation profiles should be able to supply ignore defaults for generated workspace checks.

## Decisions

- Do not add README-like project files to conformance manifests solely to make a whole-tree helper happy.
- Treat omitted file expectations as unchecked by explicit file/RDF expectation evaluation, but not automatically ignored by whole-tree completeness.
- Use `ignorePaths` for explicit tree-completeness semantics and authoring clarity.
- Keep `ignorePaths` lower priority than explicit `FileExpectation`s; contradictory overlap is an error.
- Keep the first path-pattern grammar intentionally small.
- Run whole-tree completeness by default for `accord check`.
- Emit `tree_unexpected_change` for unexpected added, removed, or updated paths.
- Emit `ignore_path_invalid` for invalid ignore patterns and `ignore_path_conflict` when an ignored path is explicitly expected.

## Contract Changes

The Accord manifest vocabulary and loader have a case-level field:

- `TransitionCase.ignorePaths?: string[]`

The ontology has the corresponding property. The SHACL shape validates that ignored paths:

- are strings
- are repository-relative
- do not contain `..`
- do not start with `/`
- do not contain backslashes
- do not use unsupported glob syntax

The CLI checker applies `ignorePaths` during whole-tree completeness. Explicit `FileExpectation` overlap is reported as a manifest error rather than allowing ignored paths to hide a declared expectation.

## Testing

- [x] Add manifest-loader tests for `ignorePaths` in compact JSON-LD and expanded JSON-LD forms.
- [x] Add checker-level invalid-pattern tests for empty paths, absolute paths, parent traversal, and backslashes.
- Add SHACL validation tests once `accord validate` exists, covering valid exact paths, valid `/**` subtree paths, absolute paths, parent traversal, and backslashes.
- [x] Add a fixture transition where an unlisted changed harness/source path fails without `ignorePaths` and passes with `ignorePaths`.
- [x] Add a test proving explicit `FileExpectation` overlap with `ignorePaths` is reported as an error.
- [x] Re-run existing checker tests to confirm current checks remain stable.

## Non-Goals

- Adding a broad profile system for disabling whole-tree completeness before real fixture pressure requires it.
- Using `ignorePaths` to suppress failures for explicitly listed file expectations.
- Adding broad shell-style glob support before there is a concrete need.
- Replacing `ignorePredicate` for RDF canonical comparison.
- Treating ignored paths as filesystem permissions or runtime access policy.

## Implementation Plan

- [x] Add `ignorePaths?: string[]` to the manifest model and JSON-LD loader.
- [x] Add the Accord ontology property and context term.
- [x] Add SHACL constraints for repository-relative ignored paths.
- [x] Add loader/unit tests for compact and expanded manifest forms.
- [x] Decide whether to expose whole-tree completeness as an opt-in checker mode: keep it on by default for the current checker.
- [x] Implement exact path, `/**` subtree, and single-segment `*` matching.
- [x] Add report codes and tests for unexpected paths and ignored unexpected paths.
- [x] Update the user guide with guidance for whole-tree completeness and `ignorePaths`.
