---
id: accord-real-sparql-344e15b6
title: 'accord real sparql'
desc: ''
created: 1783150990171
updated: 1783150990171
participants: [djradon, codex.gpt-5.5]
kato-sessionIds: [019f2c0d-cb6a-7602-8d2f-01464ec408a2]
kato-workspaceIds: [d768c729-a2c0-4099-817f-16fd384768e4]
kato-recordingIds: [344e15b6-eef7-4ea1-93b2-856d8e221001]
---

# User_2026-07-04_0035_37

accord real sparql

Kim — next accord task: notes/ac.task.2026.2026-07-04-real-sparql-ask.md. Read it fully, plus notes/ac.dev.general-guidance.md, before writing code.

This is a spike-gated task. First re-spike a real SPARQL ASK engine (Comunica or alternative) under the current Deno toolchain and record dependency/permission/performance findings in the task note. Only then choose: engine, sparqljs-plus-local-evaluator, or a deliberately documented extension of the current src/checker/sparql.ts evaluator. Do not drift into an accidental one-feature-at-a-time parser.

Acceptance bar: FILTER NOT EXISTS works as a positive expectedBoolean: true assertion; bare true/false and numeric literals match typed RDF literals; bb-205 through bb-211 stay green; invalid/unsupported queries yield stable sparql_ask reports, never raw stack traces; no network access; the manifest vocabulary (SparqlAskAssertion, expectedBoolean) is unchanged.

Write acceptance tests before changing behavior, using the Stagecraft temporal-rung absence check as the motivating shape. Update the spec (ac.spec.2026.2026-04-03-accord-cli), ac.dev.general-guidance, and user docs to state the supported ASK profile honestly. If you expose a reusable query-syntax preflight, note that in ac.task.2026.2026-04-03-shacl-validation; if not, say there that ASK syntax failures remain check-time errors. Gate: deno task fmt:check, deno task check, deno task test.

# gpt-5.5_2026-07-04_0035_51

I’ll take this as Kim and start by reading the accord task and the repo guidance it names, plus the top-level product vision note. Then I’ll spike the ASK engine before touching behavior, so the choice is documented rather than accidental.

The accord files are not at `accord/...` under the current repo root, so I’m locating the sibling or dependency checkout now. The Weave guidance is loaded; I’ll keep the accord-specific guidance as the next gate before edits.

I don’t see an `accord` checkout anywhere under `/home/djradon/hub/semantic-flow` from the first pass. I’m widening the local search a little before assuming it needs to be fetched or mounted.

Found it under `dependencies/github.com/spectacular-voyage/accord`. I’m switching into that checkout and reading the task, spec, and guidance straight from there.

The task is explicit that this is spike-gated, and the existing guidance still says the narrow evaluator was chosen to avoid Comunica resolver instability. I’m checking the actual code and package setup next, then I’ll do a small reproducible Deno spike and put the findings into the task note before choosing the implementation path.

The implementation is exactly as the note described: a compact in-repo tokenizer/evaluator over `n3` quads. I’m also checking the report/code path so acceptance tests can assert stable `sparql_ask` errors rather than just unit-level exceptions.

One useful detail: the existing checker already converts both Turtle and JSON-LD artifacts to RDFJS quads before ASK evaluation, which gives us a clean boundary for a parser-plus-local evaluator if a full engine is too heavy. I’m not choosing that yet; first I’m going to test actual engine behavior under Deno.

I’m running the dependency spike in an isolated Deno cache under `.test-tmp`, so any resolver behavior is visible and easy to discard mentally. The key checks are: can the package import, can it answer ASK over an in-memory RDFJS source, what permissions does Deno request, and how slow/heavy is cold versus warm startup.

Cold import succeeded, but the dependency graph is enormous: hundreds of Comunica packages and HTTP/update/remote-source actors come along for the ride. That does not disqualify it alone, but it raises the bar for permissions and runtime isolation.

Small correction from the toolchain: this Deno build’s `deno eval` does not accept `--no-prompt`, so I’m rerunning the tiny import/API probes without that flag. The previous commands did not touch project files.

The important spike result just got sharper: `deno info` can resolve Comunica, but actually importing `@comunica/query-sparql` fails on the same `cross-fetch/polyfill` cache path problem recorded in the old conversations. I’m checking whether that only works with a physical `node_modules`, because that would still be a poor fit for Accord’s current Deno-first setup.

The path Comunica complained about actually exists in the cache after resolution, which makes this look like Deno/npm resolution behavior rather than a simple missing download. I’m rerunning the import after extraction and then in a throwaway physical `node_modules` directory.

With `node_modules_dir=auto`, the Comunica import does succeed, but Deno initializes a very large graph and emits deprecation noise. I’m doing the functional ASK probe now, because a dependency can be ugly and still be worth it if the runtime behavior is clean.

Functional probe: Comunica answers the exact target shapes correctly when forced through a physical `node_modules`; `sparqljs` parses the same shapes cleanly in the normal Deno cache path. The fork in the road is now about stability and dependency weight, not expressiveness.

One measurement got polluted by the project-level cache, so I’m taking a clean `sparqljs` reading in a separate Deno cache and with config disabled. I want the task note to distinguish “small parser package” from “the big cache already had Comunica in it.”

Clean parser reading is much better: `sparqljs@3.7.4` resolves as five npm packages in the isolated cache and imports without physical `node_modules`. I’m going to record the spike and choose the parser-plus-local-evaluator route, with the deprecation warning noted instead of swept under the rug.

Before changing behavior, I’m updating the task note with the spike outcome and the selected path. After that I’ll write the failing acceptance tests, then replace the tokenizer with the parser-backed evaluator.

I’m leaving existing dirty files alone unless this task needs them. The visible pre-existing changes include unrelated notes and `deno.lock`; since this task will legitimately add a parser dependency, I’ll inspect the lockfile later and only account for the dependency changes I make.

Spike gate is recorded in the task note. Next I’m adding the red tests: unit coverage for the new ASK profile and black-box scenarios for the natural absence assertion plus stable unsupported-query reporting.

I’m editing tests and fixture manifests now. The new black-box pair is: one passing positive absence assertion with `FILTER NOT EXISTS`, and one unsupported `SERVICE` query that must return a stable `sparql_ask` error without attempting network access.

The unit acceptance tests are in place; several should fail against the current tokenizer. I’m adding the black-box manifests and scenario index entries before touching the evaluator.

Black-box execution will now include the new ASK scenarios. I’m updating the machine-readable scenario catalog with the expected report outcomes.

The acceptance fixtures are written. I’m running the targeted tests once now to see the expected failures before implementing the parser-backed evaluator.

The red run did what we needed: the new unit tests fail on prefix, `FILTER NOT EXISTS`, and bare literals. It also exposed a spike side effect: `deno.lock` currently contains Comunica from the probe, so subprocess tests download Comunica even though the code does not import it. I’ll clean that up when I update the real dependency pin.

I’m about to change `src/checker/sparql.ts`: `sparqljs` will own parsing and prefix/literal syntax, while Accord keeps the evaluator small and local. The evaluator will accept only ASK, BGPs, and `FILTER NOT EXISTS`; `SERVICE`, `OPTIONAL`, `UNION`, `GRAPH`, property paths, and other query forms will stop as `sparql_query_error`.

`deno.lock` definitely has the Comunica spike in it right now; that is not going to stay. The implementation itself will only import `sparqljs`, and I’ll regenerate/trim the lock after the code path is settled.

I’m adding the parser dependency to `deno.json` now, then replacing the local tokenizer code. The runtime evaluator still works only on the parsed artifact quads already produced by `compare_rdf.ts`; no remote source machinery is coming in.

The evaluator rewrite is scoped to `src/checker/sparql.ts`. I’m replacing the bespoke token stream with a parsed ASK plan and a tiny binding evaluator over RDF terms.

The parser-backed evaluator is in. I’m checking the TypeScript surface first, because `sparqljs` ships untyped JS and the RDFJS term types need a little care.

The only type issue is exactly where expected: SPARQL predicates can be property paths, and Accord’s profile rejects them. I’m tightening the type guard so TypeScript understands that rejection.
