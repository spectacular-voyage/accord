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