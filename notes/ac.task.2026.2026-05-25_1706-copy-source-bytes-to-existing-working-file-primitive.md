---
id: z5j8f6pe1wngunzqsepa44k
title: 2026 05 25_1706 Copy Source Bytes to Existing Working File Primitive
desc: ''
updated: 1779761183257
created: 1779761178273
---

## Context

Weave's Alice Bio fixture ladder exposed an ambiguity in Accord replay metadata. Rung 10 has a fixture asset named `alice-data-v2.ttl`, but the replay operation should not stage that file into the mesh as `alice-data-v2.ttl`. The deterministic replay is:

- copy the source bytes from `.assets/10-alice-bio-updated/alice-data-v2.ttl`
- overwrite the existing working file `alice-data.ttl`
- run `weave payload update alice-data.ttl alice/data`
- assert that `alice-data-v2.ttl` is absent from the product output

Current `accord:InputMaterialization` can describe `targetPath` plus `hasSourceProvenance`, but it does not say whether the target path is expected to be new, expected to already exist, or allowed to be replaced. That makes a legitimate "replace an existing command input" step look too much like "create a new staging artifact".

This task follows [[ac.completed.2026.2026-05-14-generalized-replay-and-provenance]]. The replay vocabulary should stay small, but it needs one sharper primitive for command-input preparation.

## Goals

- Distinguish pre-command input preparation from post-command/manual `FileOperation` changes.
- Represent the specific replay step "copy these source bytes over this existing working file".
- Make the target-path precondition explicit enough for runners and fixture planners to fail closed when a manifest accidentally targets a missing file.
- Keep source provenance attached to the copied bytes so fixture assets remain harness inputs, not expected product output.
- Preserve path identity: the command sees the original working file path, not a temporary sibling or versioned staging filename.
- Keep the shape portable for downstream runners without making `accord check` execute replay commands.

## Proposed Contract

Add a controlled materialization mode for `InputMaterialization`.

Recommended ontology additions:

- `accord:MaterializationMode`
- `accord:materializationMode`
- `accord:createInputPath`
- `accord:replaceExistingInputPath`
- possibly `accord:copyInputPath` only if we deliberately want an upsert-style mode

The important new primitive is `accord:replaceExistingInputPath`.

Semantics:

- The runner resolves `hasSourceProvenance` to source bytes.
- The runner resolves `targetPath` relative to the replay `workspaceRoot`.
- The target path must already exist before the replay command is invoked.
- The target path must be a file, at least for this first primitive.
- The runner overwrites the target file bytes exactly with the resolved source bytes.
- The source path is not thereby introduced as a product-output path.
- If the target path is missing or is not a file, replay fails before command execution.

Compact JSON-LD example:

```json
{
  "type": "InputMaterialization",
  "materializationMode": "replaceExistingInputPath",
  "targetPath": "alice-data.ttl",
  "hasSourceProvenance": {
    "type": "SourceProvenance",
    "sourceKind": "localPathSource",
    "sourcePath": ".assets/10-alice-bio-updated/alice-data-v2.ttl",
    "mediaType": "text/turtle"
  }
}
```

This should be read as "use the fixture source bytes from `alice-data-v2.ttl` to replace the existing working file `alice-data.ttl` before running the command." It should not be read as "create `alice-data-v2.ttl` in the replay workspace."

## Push-Back

Do not model this as a new `FileOperationKind` unless the operation is genuinely part of the transition being checked. `FileOperation` describes command-incomplete or manual changes to the replayed output. The Alice case is command input preparation: the command is still `weave payload update`, and the replacement happens so that command sees the intended working file.

Also avoid overloading `accord:operationKind` on `InputMaterialization`. Its current domain is `FileOperation`, and reusing it here would blur the replay phases. A dedicated `materializationMode` keeps the model legible.

## Contract Details

`materializationMode` should probably become required on `InputMaterialization` after existing replay fixtures are migrated. Pre-v1 Accord can afford this small manifest migration because silent upsert behavior is exactly the ambiguity this task is trying to remove.

Recommended modes:

- `createInputPath`: source bytes are copied to `targetPath`, and replay fails if the path already exists.
- `replaceExistingInputPath`: source bytes are copied to `targetPath`, and replay fails if the path does not already exist.

Defer directory materialization until there is a real fixture that needs it. If we add it later, use separate directory-specific modes rather than making `replaceExistingInputPath` quietly recurse.

Remote sources should keep the existing source-provenance digest expectations. This task does not need a new digest rule, but runners should continue treating undigested remote sources as nondeterministic unless explicitly marked.

A future optional precondition digest for the target file could be useful, but it should not be part of this first slice. Existing `fromRef` / `fromState` verification already gives branch-backed fixtures a way to prove the starting file state.

## Implementation Plan

- [ ] Add `MaterializationMode` and `materializationMode` to `accord-ontology.ttl`.
- [ ] Add `createInputPath` and `replaceExistingInputPath` individuals with comments that define the target-path preconditions.
- [ ] Update `accord-shacl.ttl` so each `InputMaterialization` declares one supported `materializationMode`.
- [ ] Update the bundled JSON-LD context examples and test manifests so `materializationMode` is an `@vocab` term.
- [ ] Add `materializationMode?: string` to the TypeScript `InputMaterialization` model.
- [ ] Preserve compact and expanded `materializationMode` in the JSON-LD loader.
- [ ] Extend manifest-loader tests for compact and expanded replay metadata.
- [ ] Add positive and negative SHACL fixture coverage for missing and unsupported materialization modes.
- [ ] Update README or user-facing manifest examples that show `InputMaterialization`.
- [ ] Update Weave's fixture ladder planner/replay rendering to emit `replaceExistingInputPath` for the Alice rung 10 pattern.
- [ ] Update Weave's replay executor to fail before command execution if `replaceExistingInputPath` targets a missing path.
- [ ] Add a Weave fixture-ladder regression proving `alice-data-v2.ttl` remains a source asset and never appears in the product mesh output.

## Testing

- Loader unit tests should cover both compact and expanded `materializationMode`.
- SHACL tests should reject `InputMaterialization` nodes with no mode or an unsupported mode.
- A runner-level test should materialize source bytes onto an existing file and verify the target path content changes while the source fixture path is not copied into the workspace.
- A runner-level negative test should fail when `replaceExistingInputPath` targets a missing file.
- The Alice Bio rung 10 fixture should remain the motivating integration test: `alice-data.ttl` changes in place, `alice-data-v2.ttl` is absent, and the subsequent `payload update` command consumes `alice-data.ttl`.

## Non-Goals

- Do not make Accord a general workflow engine.
- Do not make `accord check` execute replay commands in this slice.
- Do not add directory merge/replace semantics until a concrete fixture needs them.
- Do not rename or replace `FileOperation`; it still describes manual or command-incomplete output operations.
- Do not encode Weave-specific command behavior into Accord terms.

## Open Questions

- Should Accord require `materializationMode` immediately, or allow omission as deprecated `createInputPath` behavior for one release?
- Is `replaceExistingInputPath` the right name, or should the term be shorter, such as `replaceInputFile`?
- Should the first slice include a `targetPreconditionDigest`, or is the existing `fromState`/`fromRef` enough until directory/generated-state replay grows up?
- Should text reports render this as `input replace: alice-data.ttl <= .assets/.../alice-data-v2.ttl` to make the distinction visible to humans?
