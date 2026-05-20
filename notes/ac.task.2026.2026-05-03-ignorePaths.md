---
id: 42s22av1s9kdy6x2gekrthh
title: 2026-05-03-ignorePaths
desc: ''
updated: 1777854796323
created: 1777854796323
---

## Goals

- Add an explicit way for Accord manifests to document paths that are intentionally outside the transition contract.
- Keep ordinary `accord check` behavior path-scoped and deterministic: listed `FileExpectation`s remain the authoritative checks.
- Support stricter future whole-tree or generated-workspace checks without forcing manifests to list unrelated files such as project `README.md`.
- Avoid using ignored paths as a broad escape hatch for files that should be modeled with `FileExpectation`.

## Summary

Accord currently checks only the paths named by `hasFileExpectation`. That means an omitted file is already ignored by the current `accord check` implementation. This is good for ordinary transition checks: a manifest can say exactly which files are part of the contract and leave unrelated fixture files alone.

The gap appears when a runner wants to compare a whole tree, or when a manifest author wants to make ignored paths explicit for human readers and future tooling. The Fantasy Rules sidecar fixture is the motivating case: `README.md` can change as project guidance evolves, but it is not part of the Semantic Flow transition contract. It should not be listed as an unchanged file just to satisfy a whole-tree helper.

The proposed feature is a manifest/case-level `ignorePaths` list. These paths would be repository-root-relative path patterns that tell whole-tree comparison tooling which files to exclude from "unexpected changed file" checks. They should not suppress checks for any path that is explicitly named by `hasFileExpectation`.

## Current Behavior

The current checker already has no implicit whole-tree assertion. It evaluates:

- each listed `FileExpectation`
- any `RdfExpectation` targeting a listed file expectation
- optional RDF `ignorePredicate` rules for canonical graph comparison

There is no existing `ignoredPath`, `ignorePath`, `ignorePaths`, path glob, or path exclusion concept in the manifest model.

This means adding `ignorePaths` should not change current `accord check` results unless and until Accord adds a whole-tree completeness check or a helper that materializes workspaces and compares file lists.

## Proposed Manifest Shape

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

The same property can be represented in JSON-LD with the existing manifest context once the vocabulary and loader support it:

```json
"ignorePaths": {
  "@container": "@list"
}
```

The first useful path syntax should be conservative:

- exact repository-relative file paths, such as `README.md`
- directory-subtree globs ending in `/**`, such as `.weave/**`
- no absolute paths
- no `..` segments
- no backslashes
- no full minimatch feature set until there is a real need

The plural `ignorePaths` name is deliberately different from RDF comparison's `ignorePredicate`; one filters paths in fixture-tree completeness checks, the other filters RDF predicates inside a file comparison.

## Semantics

`ignorePaths` should mean:

- ignored paths are excluded from whole-tree "unexpected path" or "unexpected change" checks
- ignored paths are not excluded from explicit `FileExpectation` checks
- if a path is both listed in `ignorePaths` and named by `hasFileExpectation`, the explicit file expectation wins
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

In current `accord check`, omitting `README.md` is already enough. The explicit ignore becomes useful for future tree-completeness tooling and for documenting intent.

## Open Issues

- Decide whether `ignorePaths` belongs only on `TransitionCase`, or whether manifest-level defaults are also useful.
- Decide whether whole-tree completeness should be an opt-in check mode such as `accord check --check-unexpected-paths`.
- Decide whether the vocabulary should use `ignorePath` with repeated values or `ignorePaths` as a collection. The JSON-facing spelling should stay `ignorePaths`.
- Decide whether path matching should remain exact plus `/**`, or whether a small glob library is justified.
- Decide what report code should be emitted for unexpected paths once whole-tree checks exist.

## Decisions

- Do not add README-like project files to conformance manifests solely to make a whole-tree helper happy.
- Treat omitted file expectations as ignored by the current checker.
- Use `ignorePaths` only for future explicit tree-completeness semantics and authoring clarity.
- Keep `ignorePaths` lower priority than explicit `FileExpectation`s.
- Keep the first path-pattern grammar intentionally small.

## Contract Changes

If this lands, the Accord manifest vocabulary and loader need a new case-level field:

- `TransitionCase.ignorePaths?: string[]`

The ontology should add the corresponding property. The SHACL shape should validate that ignored paths:

- are strings
- are repository-relative
- do not contain `..`
- do not start with `/`
- do not contain backslashes
- do not duplicate file expectation paths unless the chosen contract explicitly allows "explicit expectation wins"

The current CLI checker does not need to apply `ignorePaths` until there is an actual whole-tree check. It should still preserve the field in parsed manifests so downstream tooling can use it.

## Testing

- Add manifest-loader tests for `ignorePaths` in compact JSON-LD and expanded JSON-LD forms.
- Add SHACL validation tests once `accord validate` exists, covering valid exact paths, valid `/**` subtree paths, absolute paths, parent traversal, and backslashes.
- If whole-tree checking lands, add a fixture transition where an unlisted changed `README.md` fails without `ignorePaths` and passes with `ignorePaths`.
- Add a test proving explicit `FileExpectation` still wins when the same path is also ignored.
- Re-run existing checker tests to confirm current path-scoped checks are unchanged.

## Non-Goals

- Changing current `accord check` into a whole-tree checker by default.
- Using `ignorePaths` to suppress failures for explicitly listed file expectations.
- Adding broad shell-style glob support before there is a concrete need.
- Replacing `ignorePredicate` for RDF canonical comparison.
- Treating ignored paths as filesystem permissions or runtime access policy.

## Implementation Plan

- [x] Add `ignorePaths?: string[]` to the manifest model and JSON-LD loader.
- [x] Add the Accord ontology property and context term.
- [x] Add SHACL constraints for repository-relative ignored paths.
- [x] Add loader/unit tests for compact and expanded manifest forms.
- [ ] Decide whether to expose whole-tree completeness as an opt-in checker mode.
- [ ] If whole-tree checking is added, implement exact path and `/**` subtree matching first.
- [ ] Add report codes and tests for unexpected paths and ignored unexpected paths.
- [ ] Update the user guide with guidance: omit unrelated files for current path-scoped checks; use `ignorePaths` only when whole-tree completeness is enabled or when documenting intentionally out-of-scope project files.
