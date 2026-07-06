---
id: e175bzw2z7oxl25uwox5v3t
title: 2026 07 05 Jsr Shipped Shapes Loading
desc: ''
updated: 1783318381545
created: 1783318381545
---

## Goals

- Make `accord validate` work when Accord runs from the published JSR package, not only from a local checkout.
- Keep shape loading local-only and offline: no runtime network fetch, no new permissions.
- Ship the fix as a `v0.1.1` patch release, since `v0.1.0` is already published and Stagecraft consumes it.

## Summary

Active consumer-reported bug: `deno run -A jsr:@spectacular-voyage/accord@0.1.0/cli validate <manifest>` fails before reading manifest content with `[shacl_validation_error] Failed to load shipped Accord SHACL shapes: Must be a file URL`. The same manifests validate cleanly through a local checkout. Reproduced 2026-07-05 against `jsr:@spectacular-voyage/accord@0.1.0` with an in-repo fixture manifest; exit code 2 and the stable error envelope are correct, so the failure mode is honest — the resource loading is what is broken.

Root cause is `src/shacl/validate_manifest.ts`:

```ts
const SHAPES_URL = new URL("../../accord-shacl.ttl", import.meta.url);
// ...
const text = await Deno.readTextFile(SHAPES_URL);
```

From a local checkout, `import.meta.url` is a `file://` URL and the read works. From JSR, modules load from `https://jsr.io/...`, so `SHAPES_URL` is an `https:` URL and `Deno.readTextFile` throws `Must be a file URL`. The TTL file is in the publish include list, so it exists on jsr.io, but reading it there would require a network fetch, which Accord's local-only execution posture forbids.

## Discussion

### Fix options

1. Embed the shipped shapes as a generated TypeScript module (recommended). Add a small generator script that renders `accord-shacl.ttl` into e.g. `src/shacl/shipped_shapes.ts` exporting the Turtle text as a string constant, and change `loadShippedShapes` to parse that constant. Add a release-gate test asserting the embedded string is byte-identical to `accord-shacl.ttl` so the two cannot drift. This makes shape loading environment-independent: local checkout, JSR, `deno compile` binaries, and offline CI all work with no fs read, no network, and no permission changes.

2. Deno raw text imports (`import shapes from "../../accord-shacl.ttl" with { type: "text" }`). Cleaner in principle, but support across the Deno version range and JSR module-graph publishing for non-TS files needs its own spike; not worth blocking a consumer-facing patch on.

3. Scheme-branching (file → `Deno.readTextFile`, https → `fetch`). Rejected: it adds a runtime network dependency and `--allow-net` requirement to a deliberately local-only command, and breaks offline use.

### Scope check

`grep import.meta.url src/` shows this is the only package-relative resource load in the runtime; the manifest/scenario loaders read user files, and draft-manifest emits inline contexts. `accord-ontology.ttl` is not loaded at runtime. So one loading site plus one generator/test closes the whole class.

### Observed permission footnote

Running the CLI from JSR also needs `--allow-env` (jsonld's `undici` dependency reads env vars at import). Local `deno task` invocations already grant it. The user guide's JSR invocation examples should state the actual minimal permission set.

## Acceptance Criteria

- `deno run --allow-read --allow-env jsr:@spectacular-voyage/accord@<patched>/cli validate <manifest>` validates a conformant manifest end to end with no network access for shape loading.
- Local checkout behavior, report formats, and exit codes are unchanged.
- A release-gate test fails if `accord-shacl.ttl` and the embedded shapes module ever differ.
- The generator is a repeatable `deno task` (or equivalent) documented for future shape edits.
- User docs state the minimal JSR CLI permission set.
- `v0.1.1` is published with release notes naming this fix.

## Decisions

- Embed the shapes as a generated module; do not add a fetch fallback or new runtime permissions.
- Keep `accord-shacl.ttl` as the authoring source of truth; the embedded module is generated output guarded by a drift test.
- Ship as a patch release `v0.1.1`; no vocabulary or CLI surface changes.

## Contract Changes

- None to the ontology, shapes semantics, CLI surface, or report formats. The fix is resource-packaging only.

## Testing

- Drift test: embedded shapes string equals `accord-shacl.ttl` bytes.
- Existing validate unit and CLI suites stay green (they now exercise the embedded path).
- Manual (or scripted, if cheap) post-publish smoke: run the JSR CLI validate against a fixture manifest per the release runbook before announcing.
- Run `deno task fmt:check`, `deno task check`, `deno task lint`, and `deno task test`.

### Completion Results

- Local release gate passed on 2026-07-06: `deno task fmt:check`, `deno task check`, `deno task lint`, `deno task test` (158 tests), and `deno task publish:dry-run`.
- Release commit `40b313c` was pushed to `main`; GitHub branch CI run `28803324433` and CodeQL run `28803323503` both passed.
- Tag `v0.1.1` was pushed; `release-jsr` run `28803431303` passed, publishing JSR package `@spectacular-voyage/accord@0.1.1` and creating the GitHub release at `https://github.com/spectacular-voyage/accord/releases/tag/v0.1.1`.
- Post-publish smoke passed: `deno run --allow-read --allow-env jsr:@spectacular-voyage/accord@0.1.1/cli validate testdata/manifests/validate-001-valid.jsonld --format json` exited 0 and returned `status: "conformant"`, `conforms: true`, `resultCount: 0`, and `errorCount: 0`.

## Non-Goals

- Runtime fetching of shapes from jsr.io or GitHub Pages.
- Text-import (`with { type: "text" }`) migration; revisit only if a later Deno/JSR spike proves it clean.
- Embedding `accord-ontology.ttl` (not loaded at runtime).
- Any behavior change beyond resource loading.

## Implementation Plan

- [x] Add the shapes-embedding generator and generated `src/shacl/shipped_shapes.ts`, and switch `loadShippedShapes` to the embedded constant.
- [x] Add the byte-identical drift test to the release gate.
- [x] Update the user guide's JSR invocation examples with the minimal permission set.
- [x] Run the full gate, bump to `v0.1.1` per [[ac.dev.release-runbook]], write `release-notes.v0.1.1`, and publish.
- [x] Post-publish, smoke the JSR CLI validate path against a fixture manifest and record the result here.
