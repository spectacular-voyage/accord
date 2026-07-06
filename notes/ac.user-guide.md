---
id: xy0jpe61u3mt53e2xir642s
title: Accord User Guide
desc: ''
updated: 1779601786125
created: 1775228646463
---

## Purpose

Accord is a deterministic checker, scenario runner, manifest drafter, and validator for machine-readable conformance manifests. `accord check` answers a narrow execution question: does a manifest correctly describe the expected transition between two named refs in a local fixture repository? `accord draft-manifest` answers a separate authoring question: what conservative file expectations can be scaffolded from a git diff? `accord validate` checks whether an authored manifest RDF graph conforms to Accord's shipped SHACL shapes.

This guide describes the current checker behavior that exists in this repository now. It does not describe future packaging or planned commands that have not landed yet.

## Current command surface

During development, the checker is run from the repository with Deno:

```bash
deno run -A src/main.ts --help
deno run -A src/main.ts check <manifest-path>
deno run -A src/main.ts check-scenario <scenario-index-path>
deno run -A src/main.ts draft-manifest --from <ref> --to <ref>
deno run -A src/main.ts validate <manifest-path>
```

After the JSR package is published, the same CLI entrypoint is available through the package:

```bash
deno run -A jsr:@spectacular-voyage/accord/cli --help
deno run -A jsr:@spectacular-voyage/accord/cli check <manifest-path>
deno run -A jsr:@spectacular-voyage/accord/cli check-scenario <scenario-index-path>
deno run -A jsr:@spectacular-voyage/accord/cli draft-manifest --from <ref> --to <ref>
deno run -A jsr:@spectacular-voyage/accord/cli validate <manifest-path>
```

For repeated local use before native binaries exist:

```bash
deno install -A --global --name accord jsr:@spectacular-voyage/accord/cli
```

The current CLI usage is:

```text
accord check <manifest-path> [--case <case-id>] [--fixture-repo-path <path>] [--format <text|json>]
accord check-scenario <scenario-index-path> [--fixture-repo-path <path>] [--format <text|json>]
accord draft-manifest --from <ref> --to <ref> [--fixture-repo-path <path>] [--out <path>] [--force]
accord validate <manifest-path> [--format <text|json>]
accord --help
```

The eventual native binary command should preserve this shape. Until then, use either the repository-native invocation or the JSR `./cli` entrypoint.

`accord check` does not run SHACL validation as a hidden preflight. `accord draft-manifest` also does not validate or check its own output. Run `accord validate` explicitly in authoring workflows or CI when you want structural manifest validation.

## Library use

Accord is also published as a Deno-first TypeScript library. The default package entrypoint exposes the manifest model, manifest loading, case selection, comparison helpers, JSON-LD document policy helpers, report types, checker result codes, and the CLI runner:

```ts
import {
  readManifestSource,
  readScenarioIndexSource,
  renderDraftManifest,
  runScenarioCheck,
  selectTransitionCase,
  type ManifestDocument,
  validateManifest,
  validateScenarioIndexDocument,
} from "jsr:@spectacular-voyage/accord";
```

The public API is intentionally small for the first package release. Treat it as early and expect explicit migration notes if the module surface changes before a stability milestone.

## Inputs

### Manifest

The manifest input is a local JSON-LD file. Accord currently supports JSON-LD manifest loading with a deterministic local-only document-loader policy.

That means:

- inline contexts are supported
- local file contexts are supported
- remote `http` and `https` JSON-LD contexts are rejected today

### Scenario indexes

Accord also defines a portable JSON-LD `ScenarioIndex` shape for fixture-owned topology documents. A scenario index is not a replacement for a transition manifest. It describes how multiple manifests fit into an ordered scenario, and `accord check-scenario` executes those steps in order by wrapping the existing `accord check` behavior per step.

The current library helpers are:

```ts
const loaded = await readScenarioIndexSource("conformance/index.jsonld");
await validateScenarioIndexDocument(loaded.document);
```

A scenario index can declare fixture-level defaults such as `defaultFixtureRepo`, `branchPrefix`, and `assetRoot`; named state lanes with `hasStateLane`; and an ordered `hasStep` list. Each `ScenarioStep` points at a transition manifest with `manifestPath` and may provide a `caseId` selector. `LaneStateBinding` nodes can bind a step to declared lanes using `fromLaneState` and `toLaneState` locators.

For `accord check-scenario`, each step's `manifestPath` is resolved relative to the scenario index document. The runner uses `--fixture-repo-path` when provided; otherwise it uses `defaultFixtureRepo` resolved relative to the scenario index document; otherwise it uses the current working directory. Lane bindings are loaded and reported as ignored warnings in this first runner slice. The selected manifest case's `fromRef` and `toRef` remain the execution source of truth.

Current validation stays deliberately local. It checks that steps exist, step ids and lane keys are not duplicated, manifest paths are safe repository-relative paths that reference existing files, and lane bindings reference declared lanes. It does not read the referenced transition manifests for semantic compatibility, execute replay commands, or update fixture branches.

### Fixture repository

Accord checks file, JSON, and RDF expectations against a local git checkout.

Today the runtime fixture resolution behavior is intentionally simple:

- for `accord check`, if `--fixture-repo-path` is provided, Accord uses that path
- for `accord check`, otherwise Accord uses the current working directory
- for `accord check-scenario`, `--fixture-repo-path` overrides the scenario index `defaultFixtureRepo`
- for `accord check-scenario`, `defaultFixtureRepo` is resolved relative to the scenario index document when no override is provided
- for `accord draft-manifest`, `--fixture-repo-path` selects the repository to diff; otherwise Accord uses the current working directory
- the selected path must already be a git repository

The manifest’s `fixtureRepo` value is still useful as semantic metadata, but the checker does not yet resolve local repositories from that field automatically. Drafted manifests omit `fixtureRepo` so local machine paths are not baked into generated JSON-LD.

### Case selection

If a manifest contains exactly one `TransitionCase`, Accord selects it automatically.

If a manifest contains more than one case, pass `--case <case-id>`.

The selected case may be identified by its authored `@id`. Accord also accepts the resolved case IRI when that is how the manifest was expanded.

### Replay metadata and ignored paths

Manifests may include optional replay metadata for tools that regenerate fixture states or run command-backed examples. The current model supports generalized `fromState` / `toState` locators, a linked `ReplayProfile`, command invocation details, input materialization, manual file operations, source provenance, and `ignorePaths`.

Today `accord check` remains a checker only. It loads replay metadata so downstream tooling can consume it, but it does not execute commands, materialize sources, or apply file operations. Continue to use `fromRef`, `toRef`, and explicit file/RDF expectations for current checker behavior.

`ignorePaths` is active for whole-tree transition completeness. Accord compares all file paths in `fromRef` and `toRef`, removes ignored paths, then reports any remaining added, removed, or modified paths that are not covered by `hasFileExpectation`. `absent` expectations are assertion-only and do not cover added, removed, or modified tree paths.

Supported ignore pattern forms are intentionally small:

- exact repo-relative path, such as `foo/bar.ttl`
- directory subtree, such as `.assets/**`
- simple `*` inside one path segment, such as `generated/*.ttl`

Ignore patterns must be repo-relative POSIX paths. Empty patterns, absolute paths, and `..` traversal are errors. If a manifest explicitly declares a `FileExpectation` for a path also matched by `ignorePaths`, Accord reports a contradictory manifest error instead of hiding that explicit expectation.

## Output formats

### Text output

Text is the default format for all commands.

For `accord check`, it prints:

- manifest path
- selected case id
- fixture repository path
- overall status
- summary counts
- only failing or error checks

Passing checks are counted in the summary but are not listed individually in text output.

For `accord check-scenario`, text output prints scenario metadata and a scenario-level step summary, then groups output by step. Each step group includes the step id, resolved manifest path, selected case id when available, transition refs when available, lane-binding warnings when applicable, the wrapped check status, the wrapped check summary, and only failing or error checks.

For `accord validate`, it prints the manifest path, shapes path, validation status, conformance boolean, result/error counts, and every validation result.

`accord draft-manifest` is not a report-producing command. It writes the drafted JSON-LD manifest to stdout by default, or to `--out <path>` when provided.

### JSON output

Pass `--format json` to receive a machine-readable report.

The current `accord check --format json` report includes:

- `manifestPath`
- `caseId`
- `fixtureRepoPath`
- `status`
- `summary`
- `checks`

Each check record includes:

- `kind`
- `status`
- `code`
- `message`
- `path`, `assertionId`, or `jsonPath` where applicable

The current `accord check-scenario --format json` report includes:

- `scenarioPath`
- `scenarioId`
- `fixtureRepoPath`
- `status`
- `summary` counting step verdicts
- `steps`

Each step includes `stepId`, zero-based `index`, resolved `manifestPath`, optional `caseId`, optional `fromRef` and `toRef`, `warnings`, and `report`. The nested `report` is the existing `accord check --format json` report shape for that step.

The current `accord validate --format json` report includes:

- `manifestPath`
- `shapesPath`
- `status`
- `conforms`
- `summary`
- `results`
- `errors` when validation cannot run

`accord draft-manifest` does not accept `--format`; its successful output is always the drafted manifest JSON-LD.

## Exit codes

Accord currently uses:

- `0` for an overall pass
- `1` for an overall fail
- `2` for an overall error

The distinction matters:

- a `fail` for `accord check` means the manifest was evaluated successfully and one or more expectations did not match
- a `fail` for `accord check-scenario` means no step errored and at least one step's wrapped check report failed
- a `non_conformant` result for `accord validate` means SHACL validation ran successfully and found one or more authoring violations
- an `error` means Accord could not complete evaluation cleanly, for example because a ref could not be resolved, a manifest could not be loaded, or RDF input could not be parsed
- `accord draft-manifest` uses `0` for successful draft output and `2` for usage, git access, or file-output errors; it has no semantic `fail` result

## What the checker supports today

### Drafting manifests

`accord draft-manifest --from <ref> --to <ref> [--fixture-repo-path <path>] [--out <path>] [--force]` scaffolds one JSON-LD manifest with one transition case from `git diff --name-status --find-renames`.

The drafter is intentionally conservative:

- it emits `FileExpectation` nodes only
- it never fabricates RDF ASK assertions or JSON assertions
- it reads git object metadata, not the working tree
- it performs no network access
- unchanged paths are omitted
- renames draft as one `removed` expectation for the old path plus one `added` expectation for the new path

Output is deterministic for the same refs and repository state. By default it is written to stdout. `--out <path>` refuses to overwrite an existing file unless `--force` is present.

The compare-mode inference table is small and stable:

| Extension set | Drafted `compareMode` |
| --- | --- |
| `.ttl`, `.nt`, `.nq`, `.trig`, `.jsonld` | `rdfCanonical` |
| `.txt`, `.md`, `.markdown`, `.json`, `.yaml`, `.yml`, `.toml`, `.csv`, `.html`, `.htm`, `.css`, `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`, `.cjs`, `.xml`, `.svg`, `.sh` | `text` |
| anything else, including no extension | `bytes` |

Removed file expectations do not declare `compareMode`.

### File expectation change types

Accord currently evaluates:

- `added`
- `updated`
- `unchanged`
- `removed`
- `absent`

### Compare modes

Accord currently supports:

- `bytes`
- `text`
- `json`
- `rdfCanonical`

`text` comparison normalizes LF versus CRLF line endings.

`json` currently marks JSON-bearing artifacts for assertion-oriented checks. Accord does not yet perform whole-document JSON structural comparison for `updated` or `unchanged` files.

### JSON assertions

For JSON-bearing file expectations, Accord supports `JsonExpectation` nodes that target a `FileExpectation` with `targetsFileExpectation`. Each `JsonAssertion` is attached with `hasJsonAssertion`.

JSON assertions parse the targeted artifact from the selected case's `toRef`. They do not read the working tree, do not load remote documents, and treat `.jsonld` artifacts as raw JSON for this feature rather than expanding them to RDF.

The supported assertion kinds are:

- `exists`: the path matches at least one value
- `notExists`: the path matches no values
- `equals`: at least one match is strictly equal to a string, boolean, or number `expectedValue`
- `count`: the number of matches equals `expectedCount`

`notExists` is first-class so manifests can prove absence, such as "no participant-aim text leaks."

The supported JSONPath subset is intentionally small:

- `$` for the root value
- dot child names such as `$.artifact.status`; dot names must match `[A-Za-z_][A-Za-z0-9_-]*`
- bracket child names with quoted strings such as `$["artifact"]["status"]` or `$['artifact']`
- child wildcards with `.*` and `[*]`
- recursive descent to names or wildcards such as `$..text`, `$.."participantAim"`, and `$..*`
- non-negative array indexes such as `$.items[0]`

Unsupported path constructs are rejected with `json_path_unsupported`: filters, slices, unions, script/current-node expressions, negative indexes, parent operators, function selectors, and descendant indexes. Malformed JSON artifacts report `json_parse_error`; duplicate object keys fail closed with `json_duplicate_key`; assertion mismatches report `json_assertion_mismatch`; passing JSON assertions use `json_assertion_ok`.

### RDF assertions

For `rdfCanonical` expectations, Accord currently supports:

- graph equivalence comparison
- ignored predicate filtering
- SPARQL `ASK` assertions attached through `RdfExpectation`

An `updated` or `unchanged` `rdfCanonical` file expectation can be checked without an authored `RdfExpectation`; Accord compares the graphs with no ignored predicates. Add an `RdfExpectation` when the manifest needs `ignorePredicate` or `SparqlAskAssertion` behavior.

The current ASK evaluator is intentionally small and local. It supports `ASK` and `ASK WHERE`, `PREFIX`, basic graph patterns such as `ASK { ?s a <Type> ; <name> "Alice" . }`, IRIs, variables, blank nodes used as query-local bindings, RDF `a`, repeated-variable joins, semicolon predicate-object lists, comma object lists, typed and language-tagged literals, bare boolean and numeric literals, and `FILTER NOT EXISTS` graph-pattern filters over the parsed RDF artifact quads.

Accord does not run ASK assertions as a SPARQL endpoint. It rejects `SERVICE`, remote graph loading, `OPTIONAL`, `UNION`, `GRAPH`, `MINUS`, `BIND`, `VALUES`, property paths, subqueries, `FROM`, non-ASK query forms, and general filter expressions. Invalid or unsupported ASK queries are reported as `sparql_ask` errors with the stable code `sparql_query_error`; they should not surface raw parser or dependency stack traces.

The current RDF artifact syntax support is intentionally limited to a small explicit set:

- `.ttl`
- `.nt`
- `.nq`
- `.trig`
- `.jsonld`

For `.jsonld` RDF artifacts, Accord converts JSON-LD to quads before canonical comparison or SPARQL evaluation.

The JSON-LD document-loading policy for RDF artifacts matches the manifest loader's current fail-closed behavior:

- inline contexts are supported
- local file contexts are supported
- remote `http` and `https` JSON-LD contexts are rejected today

When a `.jsonld` artifact is checked from git refs, its local context documents are loaded from the same checked ref, not from the current working tree.

## Manifest validation

Use `accord validate` to validate an authored manifest against Accord's shipped `accord-shacl.ttl`:

```bash
deno run -A src/main.ts validate path/to/manifest.jsonld
deno run -A src/main.ts validate path/to/manifest.jsonld --format json
```

Validation uses the same fail-closed local-only JSON-LD policy as manifest loading for `accord check`. It converts the manifest to RDF, loads the repository's shipped shapes graph, executes SHACL Core constraints, and executes the shipped `sh:sparql` constraints. This catches authoring rules such as required or forbidden `compareMode`, RDF/JSON expectations targeting file expectations in the same transition case, JSON `equals`/`count` payload requirements, and duplicate file expectations for the same `accord:path`.

Validation does not inspect fixture git refs, compare artifact contents, or run `SparqlAskAssertion` queries against RDF artifacts. ASK assertion syntax/profile problems are still reported when `accord check` evaluates the relevant RDF expectation.

## Examples

Check a one-case manifest against the current working directory:

```bash
deno run -A src/main.ts check path/to/manifest.jsonld
```

Check a manifest against an explicit local fixture checkout:

```bash
deno run -A src/main.ts check path/to/manifest.jsonld --fixture-repo-path /path/to/fixture/repo
```

Check a specific case and request JSON output:

```bash
deno run -A src/main.ts check path/to/manifest.jsonld --case '#some-case' --fixture-repo-path /path/to/fixture/repo --format json
```

Run all steps in a scenario index:

```bash
deno run -A src/main.ts check-scenario path/to/scenario-index.jsonld --fixture-repo-path /path/to/fixture/repo --format json
```

Draft a starting manifest from a fixture diff:

```bash
deno run -A src/main.ts draft-manifest --from r10-draft-from --to r11-draft-to --fixture-repo-path /path/to/fixture/repo --out draft.jsonld
```

Validate a manifest and request JSON output:

```bash
deno run -A src/main.ts validate path/to/manifest.jsonld --format json
```

## Current limitations

- Accord does not yet auto-locate the fixture repository from `fixtureRepo`.
- Accord does not yet execute replay commands or apply replay materialization/file-operation metadata.
- `accord check-scenario` does not yet use lane bindings to select or override git refs; it reports them as ignored warnings and executes each selected manifest case as authored.
- `accord validate` does not preflight `SparqlAskAssertion.query` syntax; ASK query syntax/profile errors remain check-time errors.
- `accord validate` does not perform duplicate JSON key detection before JSON-LD expansion. `accord check` does detect duplicate keys in artifacts being evaluated by JSON assertions.
- Accord does not yet support `json` compare mode.
- Accord does not yet support RDF/XML as an RDF artifact format.
- Arbitrary remote JSON-LD document loading is intentionally disabled.

## Where to look next

- [[ac.spec.2026.2026-04-03-accord-cli]] for the normative checker behavior
- [[ac.completed.2026.2026-04-03-accord-cli]] for implementation status and remaining work
- [[ac.completed.2026.2026-04-03-jsonld-support]] for the JSON-LD RDF artifact implementation record and remaining format follow-up
