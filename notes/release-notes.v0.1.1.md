---
id: f0de1ed036ad42ee91800cc4cf7cf2aa
title: 'release notes v0.1.1'
desc: ''
updated: 1783351851039
created: 1783351851039
---

## Summary

Accord `v0.1.1` is a patch release for the published JSR CLI. It fixes `accord validate` when run as `jsr:@spectacular-voyage/accord/cli` by embedding the shipped Accord SHACL shapes into the TypeScript package instead of trying to read `accord-shacl.ttl` through a package-relative file URL.

The validation behavior, SHACL constraints, report formats, and exit codes are unchanged. This release only changes how the shipped shapes are packaged and loaded at runtime.

## Highlights

- Fixes the JSR-only `accord validate` failure that reported `Failed to load shipped Accord SHACL shapes: Must be a file URL`.
- Keeps validation local-only and offline: the CLI does not fetch shapes from jsr.io or require `--allow-net`.
- Adds a generated `src/shacl/shipped_shapes.ts` module with a release-gate drift test proving the embedded Turtle string is byte-identical to `accord-shacl.ttl`.
- Updates the user guide's JSR examples to show the actual command-specific permissions, including the required `--allow-env` for the JSON-LD dependency stack.

## Breaking Or Changed Behavior

None. Existing manifests, scenario indexes, validation reports, and checker behavior remain compatible with `v0.1.0`.

## Artifacts

- JSR package: `@spectacular-voyage/accord`
- Deno library import: `jsr:@spectacular-voyage/accord`
- Deno CLI entrypoint: `jsr:@spectacular-voyage/accord/cli`
- GitHub source release: `v0.1.1`

## Validation

- `deno task fmt:check`
- `deno task check`
- `deno task lint`
- `deno task test`
- `deno task publish:dry-run`
- The validate CLI suite now exercises the embedded shipped-shapes path.
- The latest full gate passed with 158 tests.

## Known Limitations

- This is not a native binary release.
- This is not an npmjs global-install release.
- Accord still keeps arbitrary remote JSON-LD document loading disabled.

## Next

- Continue tightening the manifest-authoring loop around real consumer fixtures without broadening the local-only runtime contract.
