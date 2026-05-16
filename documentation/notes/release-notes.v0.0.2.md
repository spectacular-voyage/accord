---
id: r71zx8y2ca9gygi76zolchn
title: 'release notes v0.0.2'
desc: ''
updated: 1778970716532
created: 1778970708634
---

## Summary

Accord `v0.0.2` tightens manifest checking for real fixture workflows. It makes `ignorePaths` active during whole-tree transition completeness checks and extends replay metadata so downstream fixture tooling can preserve ordered command sequences.

## Highlights

- `accord check` now detects unexpected added, removed, or updated files between `fromRef` and `toRef` when those paths are not covered by `hasFileExpectation`.
- Manifest `ignorePaths` now suppresses intentionally unmanaged tree changes during completeness checks.
- `ignorePaths` supports exact repo-relative paths, directory subtrees such as `.assets/**`, and single-segment `*` patterns such as `generated/*.ttl`.
- Invalid `ignorePaths` values now fail closed with explicit report codes for absolute paths, traversal, unsupported patterns, or explicit expectation conflicts.
- Replay profiles now support `hasCommandSequence` for ordered multi-command replay metadata, while preserving the existing single `hasCommandInvocation` shape.

## Changed Behavior

Whole-tree completeness is stricter in `v0.0.2`. A manifest that previously passed with an unmentioned file change may now fail with `tree_unexpected_change` unless the path is covered by `hasFileExpectation` or intentionally excluded through `ignorePaths`.

`absent` expectations remain assertion-only. They prove a path is absent in the target ref, but they do not cover added, removed, or updated paths for tree-completeness purposes.

If a manifest explicitly declares a `FileExpectation` for a path that is also matched by `ignorePaths`, Accord reports `ignore_path_conflict` instead of hiding that expectation. This is deliberate: ignored paths are for unmanaged noise, not for suppressing authored assertions.

## Usage

Example `ignorePaths` use:

```json
{
  "fromRef": "r1-before",
  "toRef": "r2-after",
  "ignorePaths": [
    ".assets/**",
    "generated/*.ttl"
  ],
  "hasFileExpectation": [
    {
      "path": "artifact.ttl",
      "changeType": "updated",
      "compareMode": "rdfCanonical"
    }
  ]
}
```

Example replay sequence shape:

```json
{
  "hasReplayProfile": {
    "hasCommandSequence": [
      { "command": ["deno", "task", "example:first"] },
      { "command": ["deno", "task", "example:second"] }
    ]
  }
}
```

Accord still records and loads replay metadata only. It does not execute replay commands.

## Validation

- Adds black-box coverage for `ignorePaths` pass, unexpected-change fail, explicit expectation conflict, absolute path rejection, and traversal rejection.
- Adds focused unit coverage for supported and invalid ignore pattern forms.
- Extends manifest loader coverage for replay metadata preservation.

## Artifacts

- JSR package: `@spectacular-voyage/accord`
- Deno library import: `jsr:@spectacular-voyage/accord`
- Deno CLI entrypoint: `jsr:@spectacular-voyage/accord/cli`
- GitHub source release: `v0.0.2`

## Known Limitations

- This is not a native binary release.
- This is not an npmjs global-install release.
- Replay command metadata is loadable and available to downstream tools, but `accord check` remains a checker and does not execute commands or materialize replay inputs.
- `ignorePaths` intentionally supports a small pattern language rather than full glob semantics.
