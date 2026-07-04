---
id: accord-real-sparql-7a76f7a8
title: 'accord real sparql'
desc: ''
created: 1783151011138
updated: 1783151011138
participants: [djradon, codex.gpt-5.5]
kato-sessionIds: [019f2c0d-cb6a-7602-8d2f-01464ec408a2]
kato-workspaceIds: [d768c729-a2c0-4099-817f-16fd384768e4]
kato-recordingIds: [7a76f7a8-3ee0-4c9a-be56-17406f3ea920]
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

Type guard patched; now I’m rerunning the focused checker and ASK tests.

The focused test command needs the repo’s usual `--allow-env` because existing npm dependencies read Node env shims during import. That matches the project test task, so I’m rerunning with the normal permissions.

# gpt-5.5_2026-07-04_0043_47

The focused tests are green now. I’m turning to the lockfile cleanup next: the lock currently contains the earlier Comunica spike, and the final change should only lock `sparqljs` plus its type/runtime dependencies.

# gpt-5.5_2026-07-04_0044_20

`deno.lock` also has an unrelated `rdf-validate-shacl` specifier that predates my implementation work, so I’m not going to reset the whole lockfile. I’ll prune only the Comunica spike closure and keep unrelated lock entries intact.

# gpt-5.5_2026-07-04_0044_59

I’m going to regenerate a fresh lock in `.test-tmp` from the actual source/test modules plus the existing `rdf-validate-shacl` lock extra, then copy that generated lock over `deno.lock`. That should keep unrelated SHACL lock intent while dropping the Comunica spike.

# gpt-5.5_2026-07-04_0045_03

The temporary lock input is ignored test scratch. I’m generating the clean lock now.

# gpt-5.5_2026-07-04_0045_12

The temporary lock generated cleanly. I’m replacing `deno.lock` with that generated result, then I’ll verify that no Comunica entries remain.

# gpt-5.5_2026-07-04_0045_25

`deno.lock` no longer has Comunica or the `cross-fetch` path. It now has the parser dependency, the matching `@types`, and preserves the existing `rdf-validate-shacl` lock entry. Next I’ll run formatting/checks, then update the docs/specs.

# gpt-5.5_2026-07-04_0045_52

The fresh lock tried to float the `@std/*` JSR packages because their imports are version ranges. I’m going to pin those back to the committed lock versions so this patch does not smuggle in unrelated std upgrades.

# gpt-5.5_2026-07-04_0046_04

There’s one more floated runtime package from fresh lock generation: `undici` moved from the committed `6.24.1` to `6.27.0`. I’m pinning that back too. The new `undici-types` is only from `@types/node` for `sparqljs` types, so that one is expected.

# gpt-5.5_2026-07-04_0046_11

I’m restoring the original JSR pins and the original unused `n3@1.23.0` lock entry. That keeps the lock diff focused: existing pins stay put, new parser entries get added.

# gpt-5.5_2026-07-04_0046_17

I’ve got the exact committed snippets, so this is a straightforward lockfile patch: restore old std pins, add back the old `n3@1.23.0` entry, and pin `undici` back to `6.24.1`.

# gpt-5.5_2026-07-04_0046_43

The lock patch missed one exact hunk because I fat-fingered the `ms` integrity context. I’m splitting the patch into smaller pieces using exact nearby lines.

# gpt-5.5_2026-07-04_0046_45

Now applying the smaller lockfile correction.

# gpt-5.5_2026-07-04_0047_11

Lockfile correction is applied. I’m validating JSON and checking the remaining diff so there are no resolver surprises hiding in the lock.

# gpt-5.5_2026-07-04_0047_21

The lock diff is now much tighter and has no Comunica. I’ll use `jq` for JSON validation since this Deno build’s `eval` subcommand does not accept the usual read permission flag.

# gpt-5.5_2026-07-04_0047_42

The implementation and focused acceptance tests are green. I’m updating the Accord docs now so the supported ASK surface is explicit: parser-backed syntax, local evaluator, BGP plus `FILTER NOT EXISTS`, bare literals, and stable errors for everything outside the profile.

# gpt-5.5_2026-07-04_0047_54

I’m patching four notes: dev guidance, CLI spec, user guide, and the SHACL-validation task. The important honesty bit is that `sparqljs` parses more SPARQL than Accord commits to evaluate, so unsupported valid SPARQL remains a checker error with `sparql_query_error`.

# gpt-5.5_2026-07-04_0048_46

I’ve got the spike and parser-backed implementation in place; I’m in the documentation pass now so the public contract matches what the checker actually supports. After that I’ll run the full Deno gate and tighten anything the tools catch.

# gpt-5.5_2026-07-04_0048_56

One thing surfaced in `git status`: there are several pre-existing SHACL/validation files and note edits in the working tree. I’m leaving them alone and keeping this ASK task scoped, but the full `deno task check` may still see untracked source files if they’re inside the configured check globs.

# gpt-5.5_2026-07-04_0049_02

I’m about to patch the docs and task notes. The main contract point I’m threading through them is: `sparqljs` is only the syntax/term parser; Accord still owns a deliberately local ASK execution profile over the loaded artifact graph.

# gpt-5.5_2026-07-04_0049_18

Spec update is in. It now names the parser dependency, the supported ASK subset, stable `sparql_query_error`, and the two new black-box cases, including the unsupported `SERVICE` case.

# gpt-5.5_2026-07-04_0049_26

User docs now say the quiet part plainly: ASK is local and profile-based, not endpoint behavior. I’m adding the SHACL note next so validate work doesn’t assume a reusable ASK preflight exists.

# gpt-5.5_2026-07-04_0049_48

Task notes are updated too. I’ve marked the ASK task’s implementation checklist complete and recorded the validation-preflight decision in the SHACL task instead of leaving a dangling maybe.

# gpt-5.5_2026-07-04_0049_58

The doc scan looks clean for the obsolete “prefixes and filters unsupported” wording. I also noticed `git diff --stat` includes unrelated CLI/SHACL edits that weren’t part of this ASK slice; I’m going to separate my verification and final summary carefully so that work doesn’t get misattributed.

# gpt-5.5_2026-07-04_0050_07

I’m moving into the gate now. Since there are unrelated untracked validation sources under `src/`, I’m going to run the requested tasks as-is and distinguish ASK failures from ambient worktree failures if anything shakes loose.

# gpt-5.5_2026-07-04_0050_28

`fmt:check` caught two ASK-formatting lines in `src/checker/sparql.ts`, and it also caught unrelated validation files already present in `src/`. I’m going to format the ASK file first, then run the rest of the gate so we have a clean distinction between this slice and the ambient SHACL work.

# gpt-5.5_2026-07-04_0050_31

The ASK formatter issues are fixed. I’m rerunning the full `fmt:check`; if it still fails, it should now be only on the already-open validation changes.

# gpt-5.5_2026-07-04_0050_37

Full `fmt:check` is now failing only on the validation command/SHACL files that were already in the tree. I’m still running `check` and `test` next so we can see whether anything in the ASK work itself or the ambient tree is broken.

# gpt-5.5_2026-07-04_0050_42

`deno task check` gets through `src/checker/sparql.ts` and the ASK tests, then fails in the unrelated `src/shacl/validate_manifest.ts` type work. I’m running the test task as well, plus I’ll keep a focused ASK verification line for the final notes.

# gpt-5.5_2026-07-04_0050_50

The full test task stops during type-checking on that same SHACL file before executing tests. The ASK-specific type-check passes, so I’m rerunning the ASK unit and black-box tests directly to make sure this slice is still green after formatting and docs.

# gpt-5.5_2026-07-04_0051_09

The ASK unit and black-box coverage is green: 13/13 and 39/39, including `bb-205` through `bb-215`. I’m doing one final status/lock sanity pass now, especially to confirm Comunica did not sneak into the committed dependency set.

# gpt-5.5_2026-07-04_0051_28

The lock sanity check shows no Comunica, `@comunica/query-sparql`, or `cross-fetch` in `deno.json`/`deno.lock`; only the task note mentions Comunica as the rejected spike path. I’m also running the repo lint task because the local guidance asks for it after significant code changes.

# gpt-5.5_2026-07-04_0051_33

`deno task lint` is also blocked by the same validation file, this time unused symbols and an unnecessary `async`. I’ll run focused lint over the ASK-related files so the final report has both the repo-level blocker and the ASK slice’s own status.

# gpt-5.5_2026-07-04_0051_56

Implemented the real ASK slice with a parser-backed local evaluator in [src/checker/sparql.ts](../src/checker/sparql.ts). I chose `sparqljs` after the spike: Comunica worked only with physical `node_modules` and pulled a large resolver/network-capable dependency graph, so it stayed out.

What landed:
- `FILTER NOT EXISTS`, `PREFIX`, bare boolean literals, and numeric literals now work in ASK assertions.
- Unsupported SPARQL such as `SERVICE` returns stable `sparql_ask` / `sparql_query_error` reports.
- Added unit coverage plus `bb-214` and `bb-215`; `bb-205` through `bb-215` are green.
- Updated the task note, CLI spec, dev guidance, SHACL task note, and user guide with the honest supported ASK profile.

Verification:
- Passed: `deno check src/checker/sparql.ts tests/sparql_test.ts tests/black_box_test.ts`
- Passed: `deno test --allow-read --allow-env tests/sparql_test.ts` 13/13
- Passed: `deno test --allow-read --allow-write --allow-run --allow-env tests/black_box_test.ts` 39/39
- Full `deno task fmt:check`, `deno task check`, `deno task test`, and `deno task lint` are blocked by unrelated in-progress SHACL/validate files already in the worktree, mainly [src/shacl/validate_manifest.ts](../src/shacl/validate_manifest.ts).

Suggested commit message:

```text
accord: support parser-backed local SPARQL ASK profile

Add sparqljs as a bounded syntax/term parser and replace the old ad hoc ASK tokenizer with Accord-owned local evaluation over parsed artifact quads. Support PREFIX, FILTER NOT EXISTS, bare boolean and numeric literals, and stable query/profile errors while keeping SERVICE and broader SPARQL features unsupported.

Add unit and black-box coverage for the Stagecraft-style absence assertion and unsupported SERVICE behavior. Update the ASK task note, CLI spec, developer guidance, SHACL validation task note, and user docs with the committed ASK profile and preflight decision.
```

# User_2026-07-04_0101_09

Jimbo reports: "Confirmed bug: FILTER position changes the result
In SPARQL, a FILTER scopes to its entire group no matter where it's written. The new evaluator in sparql.ts:93-109 applies patterns in syntactic order, so a filter written before its sibling triples is evaluated against not-yet-extended bindings. I verified with this data — <urn:alice> a <urn:Relator> and only <urn:bob> having <urn:endedAt>:

ASK { ?r a <urn:Relator> . FILTER NOT EXISTS { ?r <urn:endedAt> ?end } }  → true  (correct)
ASK { FILTER NOT EXISTS { ?r <urn:endedAt> ?end } ?r a <urn:Relator> . }  → false (spec says true)
Both are the same query per the SPARQL algebra. For a tool whose product is evidence, silently returning the wrong boolean for a legally-written manifest is the worst failure mode. The fix is small: in evaluatePatterns, evaluate non-filter patterns first, then apply the group's filters to the surviving bindings (that's exactly the algebra translation), plus a regression test for the filter-first form. Alternatively, rejecting filter-before-triples as outside the profile would also be honest — but reordering is spec-correct and just as easy."

# gpt-5.5_2026-07-04_0101_22

Jimbo’s right, and it’s exactly the kind of bug that’s too polite to announce itself. I’m going to add the filter-first regression first, watch it fail against the current evaluator, then change group evaluation so filters apply after the group’s graph patterns.

# gpt-5.5_2026-07-04_0101_36

The current tests have “filter only” and “filter after pattern” coverage, but not the binding-sensitive filter-first form. I’m adding Jimbo’s minimized case as a regression so the failure is pinned to the algebra issue, not just the Stagecraft-shaped happy path.

# gpt-5.5_2026-07-04_0101_42

The regression is in. I’m running just `tests/sparql_test.ts` now to confirm it fails before the evaluator fix.

# gpt-5.5_2026-07-04_0102_02

The new test fails in the expected way: filter-first returns `false` instead of `true`. I’m changing group evaluation now so top-level filters are collected and applied after the group’s graph patterns, while preserving the existing local-profile rejection path for unsupported pattern types.

# gpt-5.5_2026-07-04_0102_08

The evaluator now treats filters as group-level constraints rather than syntactic-order steps. I’m rerunning the SPARQL unit suite first, then the black-box ASK scenarios.

# gpt-5.5_2026-07-04_0102_27

The regression and black-box suites are green with the fix. I’m doing formatter/type/lint checks now; the repo still has unrelated SHACL/validate work in the tree, so I’ll call out any ambient failures separately from this patch.

# gpt-5.5_2026-07-04_0102_36

Focused formatter, type-check, and lint all pass for the touched ASK files. I’m running the repo-level tasks too, mostly to confirm whether the existing SHACL blockers are unchanged.

# gpt-5.5_2026-07-04_0103_03

The requested gate is now good: `fmt:check`, `check`, and `test` all pass. The extra lint run still has one unrelated SHACL `require-await` finding in `src/shacl/validate_manifest.ts`; I’m leaving that file alone because it’s outside this ASK fix.

# gpt-5.5_2026-07-04_0103_15

Jimbo was right. I fixed the evaluator in [src/checker/sparql.ts](../src/checker/sparql.ts:96) so a group evaluates non-filter patterns first, then applies the group’s `FILTER` constraints to the surviving bindings. That makes filter-first and filter-after forms equivalent for the supported ASK profile.

I also added the regression in [tests/sparql_test.ts](../tests/sparql_test.ts:126) using the exact shape Jimbo described: Alice is the relator, Bob has `endedAt`, and `FILTER NOT EXISTS` appears before `?r a <urn:Relator>`.

Verification:
- First ran the new test before the fix: failed with `false` vs `true`
- `deno task fmt:check` passed
- `deno task check` passed
- `deno task test` passed, 112 tests
- Extra `deno task lint` still fails on unrelated SHACL work at `src/shacl/validate_manifest.ts:212` for `require-await`; I left that file alone.

Suggested commit message:

```text
accord: apply ASK filters after sibling graph patterns

Fix SPARQL ASK evaluation so FILTER NOT EXISTS scopes over the full group rather than only bindings produced earlier in syntactic order. Add a regression for the filter-first form where sibling triples bind the variable used inside the absence check.
```