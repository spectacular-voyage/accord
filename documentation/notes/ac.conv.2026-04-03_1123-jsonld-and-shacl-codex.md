---
id: jsonld-and-shacl-971f083d
title: 'jsonld and shacl'
desc: ''
created: 1775240622350
updated: 1775240622350
participants: [djradon, codex.gpt-5.4]
kato-sessionIds: [019d5493-5878-77e1-a4dc-cb6e308dff91]
kato-workspaceIds: [d768c729-a2c0-4099-817f-16fd384768e4]
kato-recordingIds: [971f083d-bfee-4b2d-aa38-def615f39185]
---

# User_2026-04-03_1122_05

jsonld and shacl

Let's try to check the last box on [ac.task.2026.2026-04-03-accord-cli.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-accord-cli.md) and [ac.task.2026.2026-04-03-jsonld-support.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-jsonld-support.md) . Check [ac.user-guide.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.user-guide.md) and [ac.dev.general-guidance.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.dev.general-guidance.md) for context.

# gpt-5.4_2026-04-03_1122_12

I’m checking the repo guidance and the Accord task notes first so I can see exactly what “jsonld and shacl” means in the current implementation before changing anything.

I’ve confirmed the worktree is clean. Next I’m reading the top-level guidance plus the Accord-specific notes in the dependency checkout, and I’ll look for any nested `AGENTS.md` there before editing.

The top-level guidance is straightforward: Deno-first, update docs alongside code, and keep the change scoped with matching validation. I’m in the Accord checkout now reading the task notes and developer guidance to see what that last checkbox actually requires.

The task notes line up with the guidance: JSON-LD RDF artifacts are the concrete feature, and SHACL looks like a design decision that should stay separate unless the codebase already has a clean path for it. I’m inspecting the current checker and spec now so I can wire JSON-LD in without smuggling in broader behavior.

I have the spec boundary now. Next I’m reading the checker and manifest loader code to see whether JSON-LD artifact parsing can reuse the existing loader policy cleanly or whether it needs a separate adapter.

The current checker is narrow exactly where the notes said it would be: RDF parsing is still hard-coded to `n3`, while manifest JSON-LD already has a fail-closed loader. I’m reading the existing RDF and CLI tests now so I can extend the right seams instead of bolting a second path on top.

There’s no existing SHACL runtime path in the code at all, which is a useful constraint: I can implement JSON-LD artifacts now, but I shouldn’t pretend there’s a real preflight validator unless I build one deliberately. I’m checking the README and the ontology/SHACL surfaces next to see whether we need any documentation or contract correction around that decision.

The SHACL files are authoring constraints only; they don’t imply there should be an in-process preflight inside `accord check`. That matches the task note’s own caution, so I’m treating SHACL as a scope decision and JSON-LD artifacts as the actual code change. Next I’m building the implementation plan against the existing test harness and fixtures.

Plan:
1. Update the RDF ingestion layer so Turtle-family inputs and `.jsonld` both produce the same quad dataset, reusing the existing local-only JSON-LD loader policy.
2. Add focused unit and black-box coverage for `.jsonld` RDF comparison, SPARQL ASK, local contexts, and remote-context rejection.
3. Update the spec, user guide, and task notes to reflect the new `.jsonld` support and record that SHACL preflight remains a separate follow-up rather than part of `accord check`.

# gpt-5.4_2026-04-03_1127_14

I have the seam now: the checker needs a real JSON-LD-to-quads path, and the cleanest version is to share the JSON-LD document-loading policy while keeping manifest and git-blob local document wrappers separate. I’m patching the RDF parser, adding a shared JSON-LD helper, and then I’ll wire the CLI to load `.jsonld` artifact contexts from the checked git refs rather than the working tree.

# gpt-5.4_2026-04-03_1128_58

I’m on the CLI wiring now. The important detail is that JSON-LD artifact contexts must be loaded from the checked git refs, not from the working tree, otherwise relative contexts would silently read the wrong version.

# gpt-5.4_2026-04-03_1129_17

The parser refactor is in place. I’m running type-checking now before I add fixtures, because the async parser change touches both RDF comparison and SPARQL execution.

# gpt-5.4_2026-04-03_1130_02

I’m adding a small dedicated JSON-LD RDF fixture family rather than overloading the Turtle repo. That keeps the new behavior explicit and gives us stable local-context, remote-context, and parse-error cases.

# gpt-5.4_2026-04-03_1131_20

I’ve moved on to coverage. The next layer is unit tests that prove the JSON-LD path is real, not just a black-box side effect: local file contexts load, quads are produced, and remote contexts fail with the expected code.

# gpt-5.4_2026-04-03_1131_52

Type-checking is clean again. I’m running the test suite now; the main thing I’m watching for is whether git-backed JSON-LD contexts resolve correctly in black-box mode, since that’s the part unit tests can’t prove by themselves.

# gpt-5.4_2026-04-03_1132_40

One regression surfaced in the manifest-loader unit tests. I’m waiting for the full run to finish, then I’ll patch that error-path mismatch before touching docs.

# gpt-5.4_2026-04-03_1132_54

The failure is just the parse-error wording getting generalized by the shared helper. I’m restoring the manifest-specific wording so the visible error contract stays stable while the loader logic remains shared.

# gpt-5.4_2026-04-03_1133_25

The code path is stable again. I’m updating the contract and guidance now so the docs describe the implementation that actually exists: `.jsonld` RDF artifacts are supported, while SHACL preflight is still a separate concern rather than hidden inside `accord check`.

# gpt-5.4_2026-04-03_1136_02

The implementation and docs are aligned now. I’m doing the last verification pass: formatting first, then the full test suite one more time so the final state is clean rather than “probably fine.”

# gpt-5.4_2026-04-03_1136_05

Formatting found two TypeScript files that just need mechanical cleanup. I’m applying `deno fmt` now and then rerunning the verification pass.

# gpt-5.4_2026-04-03_1137_49

**Changes**
- `.jsonld` RDF artifacts now work in `rdfCanonical` comparisons and SPARQL ASK checks. The RDF path converts JSON-LD to N-Quads and then reuses the existing quad/canonicalization flow in [compare_rdf.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/checker/compare_rdf.ts#L58) and the shared JSON-LD loading policy in [documents.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/jsonld/documents.ts#L19).
- Local JSON-LD artifact contexts are loaded from the same checked git ref, not the working tree, in [check.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/cli/commands/check.ts#L369). I added a dedicated `repo-rdf-jsonld` fixture family plus new unit and black-box cases for equivalence, ASK, local-context loading, remote-context rejection, and parse errors.
- The spec and task/docs are aligned with the implementation, including checking the last boxes in [ac.task.2026.2026-04-03-jsonld-support.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-jsonld-support.md#L147) and [ac.task.2026.2026-04-03-accord-cli.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-accord-cli.md#L215). SHACL preflight is now explicitly kept separate from `accord check`; if it lands later, it should be a separate command surface, not implicit preflight.

**Verification**
`deno task fmt:check` and `deno task test` both passed in `dependencies/github.com/spectacular-voyage/accord` (`64` tests).

# User_2026-04-03_1137_49

commit message please

# gpt-5.4_2026-04-03_1137_59

```text
feat(accord): support JSON-LD RDF artifacts in accord check

- add a shared fail-closed JSON-LD document-loading helper for manifests and RDF artifacts
- ingest `.jsonld` RDF artifacts through `jsonld.js` before RDF canonical comparison and SPARQL ASK execution
- resolve local JSON-LD artifact contexts from the checked git ref instead of the working tree
- add `repo-rdf-jsonld` fixtures plus unit and black-box coverage for equivalence, ASK, parse, and remote-context error cases
- update the CLI spec, user guide, README, and task notes to record JSON-LD support and keep SHACL preflight as separate future work
```

# User_2026-04-03_1650_18

I've added a "coderabbit review" section to [ac.task.2026.2026-04-03-jsonld-support.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-jsonld-support.md) . Please add markdown checkboxes for each item, and mark those that are not worth doing as [c].

# gpt-5.4_2026-04-03_1650_26

I’m checking the updated task note and the current worktree state first so I can add checkboxes without trampling any of your recent edits.

# gpt-5.4_2026-04-03_1650_32

I’ve got the new review section. I’m checking the rest of it now so I can mark each item consistently and only cancel the ones that are actually low-value or wrong for this repo.

# gpt-5.4_2026-04-03_1650_55

I’ve triaged the review items. I’m only changing the note itself: actionable items will get `[ ]`, and the suggestions that would broaden scope or amount to cosmetic churn are going to `[c]`.

# gpt-5.4_2026-04-03_1651_13

The note content shifted a bit under the wrapped review text, so I’m reopening just that section and patching against the exact lines rather than guessing around the wraps.

# gpt-5.4_2026-04-03_1651_34

Updated the review section in [ac.task.2026.2026-04-03-jsonld-support.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-jsonld-support.md).

I marked these as cancelled with `[c]`:
- configurable remote-context allowlist
- removing the unnecessary `async` in `createInlineJsonLdDocumentLoader`
- adding a comment to `.accord-empty-ref`

The remaining items are marked `[ ]` as actionable follow-up. No tests were needed for this note-only edit.

# User_2026-04-03_1652_15

OK, please implement all that are worth implementing

# gpt-5.4_2026-04-03_1652_29

I’m implementing the actionable CodeRabbit items from the JSON-LD follow-up note. First I’m reading the affected files and current repo state so I can patch only the real gaps and avoid touching the cancelled suggestions.

# gpt-5.4_2026-04-03_1652_44

I’ve isolated the actual work: one docs wording fix, three error-path hardenings, one JSON-LD context-validation improvement, and a test update. I’m patching those together so the behavior and the review checklist stay in sync.

# gpt-5.4_2026-04-03_1653_15

I’m editing the implementation now. The main nuance is the JSON-LD context walker: it needs to catch nested `@import` and nested `@context`, but it must not start treating ordinary remote IRIs like `dcterms` namespace values as forbidden context URLs.

# gpt-5.4_2026-04-03_1653_57

I’m adding direct tests for the context walker instead of hiding this behind manifest fixtures. That makes the behavior explicit: nested `@context` and `@import` should be checked, but ordinary term IRIs must remain legal.

# gpt-5.4_2026-04-03_1654_26

The patches are in. I’m running formatting and the full Accord validation loop now, because these changes are all about edge-case error handling and it’s easy to miss a branch if I only spot-check one test file.

# gpt-5.4_2026-04-03_1654_49

The broad suite is still green so far. I’m waiting on the rest, with the new focus on the added direct JSON-LD helper tests and the manifest-read normalization path.

# gpt-5.4_2026-04-03_1655_37

Implemented the actionable CodeRabbit items and marked their checkboxes `[x]` in [ac.task.2026.2026-04-03-jsonld-support.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-jsonld-support.md). The substantive changes are in [load_jsonld.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/manifest/load_jsonld.ts), [check.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/cli/commands/check.ts), [sparql.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/checker/sparql.ts), and [documents.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/src/jsonld/documents.ts). That includes normalizing manifest read failures to `ManifestLoadError`, wrapping git-backed JSON-LD artifact document read failures consistently as `RdfCompareError`, moving RDF parse/store setup inside the SPARQL error-handling path, and teaching the JSON-LD context validator to catch nested `@import` and nested `@context` usage without rejecting ordinary remote IRIs in term definitions.

I also fixed the user-guide wording in [ac.user-guide.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.user-guide.md) so it matches the actual hard-reject behavior for remote `http`/`https` contexts, updated the remote-context RDF test in [compare_rdf_test.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/tests/compare_rdf_test.ts), added manifest read-failure coverage in [manifest_loader_test.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/tests/manifest_loader_test.ts), and added direct JSON-LD helper coverage in [jsonld_documents_test.ts](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/tests/jsonld_documents_test.ts).

Verification: `deno task fmt:check`, `deno task check`, and `deno task test` all passed in `dependencies/github.com/spectacular-voyage/accord` (`68` tests).

# User_2026-04-03_1657_11

commit message please

# gpt-5.4_2026-04-03_1657_17

```text
fix(accord): harden JSON-LD loader and error-path handling

- normalize manifest read failures into ManifestLoadError with manifest path and document URL context
- wrap git-backed JSON-LD artifact document read failures consistently as rdf_parse_error while preserving existing RdfCompareError cases
- move SPARQL RDF parsing and Store construction inside the query error-handling path
- validate nested JSON-LD object contexts for @import and nested @context references without rejecting ordinary term IRIs
- tighten JSON-LD remote-context tests and add direct coverage for manifest read errors and context-validation edge cases
- correct the user-guide wording to reflect the current hard-reject policy for remote http/https JSON-LD contexts
```

# User_2026-04-03_1701_26

Anything else on this branch? You don't want to do the SHACL preflight? I mean, we would probably just warn anyhow. But yeah, we would need a javascript/typescript SHACL validator. One of these?

rdf-validate-shacl (Zazuko): Currently one of the most active and modern implementations. It is a fork of the original shacl-js adapted to work with the RDF/JS standard. It supports SHACL Core but does not support SHACL-SPARQL constraints.

shacl-engine (RDF-Ext): A high-performance SHACL engine designed for data provided as RDF/JS objects. It powers various client-side tools and can be used in both the browser and Node.js.

shacl-processor-ts: A TypeScript-based library specifically for validating RDF data streams using SHACL.

Fill in [ac.task.2026.2026-04-03-shacl-validation.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-shacl-validation.md) please.

# gpt-5.4_2026-04-03_1701_40

I’m checking the current SHACL task note, the Accord guidance, and the branch state first. Then I’ll verify the SHACL library options against their primary sources before I rewrite the note.

# gpt-5.4_2026-04-03_1701_46

I have the local structure. Next I’m checking the existing SHACL references in Accord and then validating the candidate libraries against their primary sources before I draft the task note.

# gpt-5.4_2026-04-03_1702_25

The key question is whether Accord’s own shapes already rely on `sh:sparql`. I’m checking `accord-shacl.ttl` now, because that determines whether a Core-only validator is even a serious option.

# gpt-5.4_2026-04-03_1703_15

I’ve got enough context to draft the task note. The main technical constraint is now clear: Accord’s own shapes already use `sh:sparql`, so a Core-only validator is not a real fit for the current shapes graph.

# gpt-5.4_2026-04-03_1704_05

I’m checking the current SHACL task note against the existing Accord CLI guidance and the actual shapes file, then I’ll draft the note around the command surface and validator choice rather than guessing.

# gpt-5.4_2026-04-03_1704_07

I’ve confirmed the current shapes graph uses `sh:sparql`, so a Core-only library is not a clean fit. I’m checking the validator projects’ current stated scope before I lock the recommendation into the task note.

# gpt-5.4_2026-04-03_1704_21

The validator choice is narrowing cleanly: current Accord shapes need `sh:sparql`, which makes `rdf-validate-shacl` a mismatch unless we first rewrite the shapes. I’m drafting the note around a separate `accord validate` command and using `shacl-engine` as the first spike candidate.

# gpt-5.4_2026-04-03_1704_55

I’m editing the task note now. The main call I’m making is that SHACL validation should be a separate `accord validate` path with failing results by default, not a warning-only preflight bolted onto `accord check`.

# gpt-5.4_2026-04-03_1705_30

The patch missed the exact template spacing. I’m re-reading the stub and applying the note in one clean replacement so I don’t fight the formatter.

# gpt-5.4_2026-04-03_1706_10

The note is in place. I’m giving it one pass for tone and consistency with the existing CLI docs, then I’ll summarize the branch-level recommendation and the other changes I still see in git.

# gpt-5.4_2026-04-03_1706_15

I’ve finished the note. I’m checking git status one more time so I can answer your “anything else on this branch?” question precisely instead of hand-waving.

# gpt-5.4_2026-04-03_1706_29

Filled in [ac.task.2026.2026-04-03-shacl-validation.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-shacl-validation.md) with the recommendation I’d actually stand behind: do not bolt SHACL onto `accord check` as warning-only preflight. The note now argues for a separate `accord validate <manifest>` command, failing by default, because the current [accord-shacl.ttl](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/accord-shacl.ttl) already uses `sh:sparql`, so a Core-only validator would not reflect the real shapes graph.

I also answered the library question in the note: `shacl-engine` is the first spike candidate; `rdf-validate-shacl` is a mismatch for current Accord unless the shapes are rewritten; `shacl-processor-ts` looks more pipeline-oriented, which I called out as an inference from its documented surface. On this branch, besides the new SHACL task note, git still shows changes in `.github/workflows/ci.yml`, [ac.task.2026.2026-04-03-accord-ci.md](/home/djradon/hub/semantic-flow/weave/dependencies/github.com/spectacular-voyage/accord/documentation/notes/ac.task.2026.2026-04-03-accord-ci.md), and the conversation note. No tests ran because this was a note-only edit.

Sources:
- `rdf-validate-shacl`: https://github.com/zazuko/rdf-validate-shacl and https://raw.githubusercontent.com/zazuko/rdf-validate-shacl/master/packages/shacl/README.md
- `shacl-engine`: https://github.com/rdf-ext/shacl-engine
- `shacl-processor-ts`: https://github.com/rdf-connect/shacl-processor-ts and https://raw.githubusercontent.com/rdf-connect/shacl-processor-ts/main/README.md