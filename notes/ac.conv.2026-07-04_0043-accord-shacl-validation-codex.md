---
id: accord-shacl-validation-26863efd
title: 'accord shacl validation'
desc: ''
created: 1783151003491
updated: 1783151003491
participants: [djradon, codex.gpt-5.5]
kato-sessionIds: [019f2c11-1628-7321-823e-650ade477104]
kato-workspaceIds: [d768c729-a2c0-4099-817f-16fd384768e4]
kato-recordingIds: [26863efd-505d-400f-bf1e-a8ecc2844a19]
---

# User_2026-07-04_0040_37

accord shacl validation

Kim — next accord task: notes/ac.task.2026.2026-04-03-shacl-validation.md. Read it fully, plus notes/ac.dev.general-guidance.md.

Build accord validate <manifest> as a separate command — no SHACL preflight inside accord check, not even warning-only. It must execute the shipped accord-shacl.ttl as-is, which uses sh:sparql constraints, so spike shacl-engine (with its sparql.js plugin) AND rdf-validate-shacl under Deno first and record findings in the task note. Do not rewrite the shapes graph to fit a weaker validator.

Execution model: existing fail-closed local-only JSON-LD loader → dataset → shipped shapes → stable text/JSON report → non-zero exit on non-conformance. Check whether ac.task.2026.2026-07-04-real-sparql-ask exposed a reusable ASK syntax preflight; wire it in if so, or document in the task note that ASK syntax failures remain check-time errors. Decide the duplicate-key-detection question (pre-expansion) explicitly and record the decision.

Tests: exercise the sh:sparql constraints specifically (compareMode required/forbidden rules, same-transition-case targeting, duplicate accord:path), passing and failing manifests through the CLI, and confirm accord check behavior is untouched. Update spec + user guide. Gate: deno task fmt:check, deno task check, deno task test.

# gpt-5.5_2026-07-04_0040_46

Kim here. I’ll start by reading the repo guidance and the two Accord notes so the implementation matches the project’s own expectations before I touch code.

The Weave-level guidance is present, but the Accord paths aren’t under this repo root as written. I’m locating the Accord workspace/note vault now so I can read the exact task instead of guessing at a sibling layout.

Accord is vendored as a dependency repo at `dependencies/github.com/spectacular-voyage/accord`, so I’m switching context there. I also noticed an existing modified `documentation/notes/wd.todo.md` in Weave; I’ll leave that alone unless the Accord task genuinely needs it.

The Accord repo already has in-progress ASK work in the worktree, including `deno.lock` and SPARQL tests/fixtures. I’m going to inspect that carefully and build on it, since the validation command depends on whether that branch exposed a reusable ASK syntax preflight.

A small wrinkle: the ASK task note has recorded the spike decision, but the actual `src/checker/sparql.ts` file is still the old hand parser in the index, so there is no reusable ASK preflight I can wire into validation yet. I’ll verify via tests, then keep that decision explicit in the SHACL task note instead of inventing a dependency between the two tasks.

I’ve got enough of the CLI/report shape now. Before wiring the command, I’m going to do the Deno library spikes against the shipped `accord-shacl.ttl` and a small real manifest graph; that will keep the implementation decision grounded in the validator behavior, not just package claims.

I’m going to keep the spike artifacts out of the source tree and use Deno’s npm bridge directly. The main thing I need to learn is whether the validator can execute the existing `sh:sparql` rules against real Accord data without changing the shapes file.

Early spike data: `shacl-engine@1.1.2` resolves under Deno 2.8.3 but brings a Comunica RDFJS-lite stack, about 406 unique npm packages and 33.56 MB logical dependency size. `rdf-validate-shacl@0.6.5` is much smaller at 33 unique packages, but I still need to verify the advertised SHACL-SPARQL gap against the actual shipped shapes.

That spike found a serious Deno compatibility snag: importing `shacl-engine` itself works, but importing `shacl-engine/sparql.js` with the normal npm-cache mode fails on the same `cross-fetch/polyfill` resolution class the ASK task saw with Comunica. I’m checking whether physical `node_modules` makes it functional; if that is required, I’m going to push back on using it for the release-gate path unless there’s no better option.

The package docs match the behavior: `shacl-engine` needs the SPARQL plugin for `sh:sparql`, and that plugin is the part tripping Deno’s npm-cache resolver. `rdf-validate-shacl` plainly documents that it does not support SHACL-SPARQL, so it can validate only a weakened subset of Accord’s shipped shapes.

# gpt-5.5_2026-07-04_0044_06

I’m leaning toward `rdf-validate-shacl` for SHACL Core plus an Accord-owned `sh:sparql` executor over the loaded shapes graph, rather than requiring physical `node_modules` for `shacl-engine/sparql.js`. That still executes the shipped `accord-shacl.ttl` as data, but avoids importing the failing plugin path into the normal Deno release gate.

# gpt-5.5_2026-07-04_0044_20

The local evaluator approach is tractable because the shipped `sh:sparql` queries use a small SELECT profile: BGPs, `FILTER IN`, `FILTER NOT EXISTS`, string functions, `&&`/`||`, one `UNION`, and one RDF list property path. I’m checking that profile now so the code can reject anything outside it cleanly instead of silently half-validating.

# gpt-5.5_2026-07-04_0045_06

The implementation shape I’m going to use now: `accord validate` will load the manifest through the same local-only JSON-LD policy, convert it to an RDF dataset, run `rdf-validate-shacl` for SHACL Core, then run the `sh:sparql` constraints harvested from `accord-shacl.ttl` with a small `sparqljs`-based SELECT evaluator. `accord check` will not call any of this.

# gpt-5.5_2026-07-04_0045_12

The physical `node_modules` directory was created by the spike, so I’ll remove that generated artifact before editing. The lockfile did not pick up `shacl-engine`, but it did pick up `rdf-validate-shacl` and `sparqljs`, which are the dependencies I’m about to make explicit in `deno.json`.

# gpt-5.5_2026-07-04_0045_16

I’m removing the generated `node_modules`; it’s just cleanup from the validator plugin probe, not part of the implementation.

# gpt-5.5_2026-07-04_0045_19

Here’s the working checklist I’ll keep tight: add a `validate` command and report model, implement manifest-to-dataset plus SHACL Core and `sh:sparql` execution, add fixtures/tests for the requested SPARQL constraints and unchanged `check`, then update the spec/user/task notes and run the Deno gate.

# gpt-5.5_2026-07-04_0045_53

I’m about to edit the code. The key files will be a small SHACL validation module, a `validate` CLI handler, parser routing, and report rendering; then I’ll add focused JSON-LD fixtures for the four requested validation cases.

# gpt-5.5_2026-07-04_0046_21

One test detail: `accord check` needs materialized git fixture repos, while `accord validate` only reads JSON-LD. I’m checking the existing black-box harness so the “check unchanged” assertion uses the same fixture materialization path as the rest of the suite.

# gpt-5.5_2026-07-04_0046_24

I’m starting with the dependency and parser surface: making `rdf-validate-shacl` and `sparqljs` explicit, then adding the validation modules.

# gpt-5.5_2026-07-04_0046_34

`deno.json` already had `sparqljs` in the current worktree, likely from the ASK work. I’ll only add the SHACL validator dependency there.

# gpt-5.5_2026-07-04_0046_41

Next I’m adding the manifest-to-RDF path. It reuses the existing file JSON-LD document context, remote-context rejection, and JSON parsing behavior so `validate` and `check` share policy without sharing checker execution.

# gpt-5.5_2026-07-04_0046_51

Now I’m adding the validation report types and text renderer. This stays separate from the existing check report so the two command contracts don’t get tangled.

# gpt-5.5_2026-07-04_0047_03

The text renderer will list every SHACL result, unlike `accord check` text output which suppresses passes; validation has no per-check pass list, just conformance results.

# gpt-5.5_2026-07-04_0047_08

The validation engine is the chunky bit. I’m keeping the local SPARQL executor deliberately narrow and tied to the current shapes profile: it handles the constructs the shipped shapes use and errors if future shapes move beyond that.

# gpt-5.5_2026-07-04_0048_40

With the engine in place, I’m wiring it into the CLI as a separate `validate` subcommand and leaving the existing `check` handler untouched.

# gpt-5.5_2026-07-04_0048_51

The parser update is small: `validate` gets only a manifest path and `--format`, while `--case` and `--fixture-repo-path` stay meaningful only for `check`.

# gpt-5.5_2026-07-04_0048_59

Routing is next: parsed `check` commands go exactly where they did before, parsed `validate` commands go to the new handler.

# gpt-5.5_2026-07-04_0049_05

I’m exporting the new validation helpers too, since the package already exposes the comparable checker/report helpers.

# gpt-5.5_2026-07-04_0049_17

The public API file had a slightly different ordering than my patch expected. I’m applying the exports in smaller chunks.

# gpt-5.5_2026-07-04_0049_49

I’m adding validation-specific manifests under `testdata/manifests`. They’re synthetic and narrowly aimed at the shipped SHACL-SPARQL rules, so they won’t disturb the existing black-box scenario index.

# gpt-5.5_2026-07-04_0050_20

Before writing the assertions, I’m doing a quick type check of the new path. It’s faster to catch compiler complaints now than to bake failing assumptions into the tests.

# gpt-5.5_2026-07-04_0050_32

The new code has a TypeScript narrowing complaint in the SPARQL expression evaluator, not a logic issue. I’m making the operation cast explicit so the checker doesn’t have to infer across the runtime guard.

# gpt-5.5_2026-07-04_0050_40

I found the exact spot; applying the small type fix there.

# gpt-5.5_2026-07-04_0050_46

I’m rerunning the targeted check and then I’ll smoke-test the new CLI against the valid fixture.

# gpt-5.5_2026-07-04_0051_02

The targeted type check is clean. I’m running the new command now to see the real report shape before I lock tests to it.

# gpt-5.5_2026-07-04_0051_17

`rdf-validate-shacl` doesn’t just ignore `sh:sparql`; it hard-errors on `SPARQLConstraintComponent`. That confirms the spike finding in a stronger way. I’m switching the implementation to use `shacl-engine` core with an Accord-owned SPARQL validation hook, so the loaded shapes graph remains the shipped graph and the SPARQL constraints are still attached to the validator run.

# gpt-5.5_2026-07-04_0051_19

`shacl-engine` exposes the right hook: its registry lets us attach a compile function for `sh:sparql`. I’m checking that compile contract and then I’ll replace the `rdf-validate-shacl` runtime path.

# gpt-5.5_2026-07-04_0051_49

I’m replacing the two-pass `rdf-validate-shacl` call with one `shacl-engine` validator run and a custom `sh:sparql` compile hook. That better matches the “execute the shipped shapes as-is” requirement.

# gpt-5.5_2026-07-04_0051_54

I’m making the validation module use `shacl-engine` directly now. The custom SPARQL hook reuses the evaluator I already added, so this is mostly changing where results are produced and normalized.