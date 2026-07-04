---
id: xy0jpe61u3mt53e2xir642s
title: Accord User Guide
desc: ''
updated: 1779601786125
created: 1775228646463
---

## Purpose

Accord is a deterministic checker for machine-readable conformance manifests. Today the primary command is `accord check`, which answers a narrow question: does a manifest correctly describe the expected transition between two named refs in a local fixture repository?

This guide describes the current checker behavior that exists in this repository now. It does not describe future packaging or planned commands that have not landed yet.

## Current command surface

During development, the checker is run from the repository with Deno:

```bash
deno run -A src/main.ts --help
deno run -A src/main.ts check <manifest-path>
```

After the JSR package is published, the same CLI entrypoint is available through the package:

```bash
deno run -A jsr:@spectacular-voyage/accord/cli --help
deno run -A jsr:@spectacular-voyage/accord/cli check <manifest-path>
```

For repeated local use before native binaries exist:

```bash
deno install -A --global --name accord jsr:@spectacular-voyage/accord/cli
```

The current CLI usage is:

```text
accord check <manifest-path> [--case <case-id>] [--fixture-repo-path <path>] [--format <text|json>]
accord --help
```

The eventual native binary command should preserve this shape. Until then, use either the repository-native invocation or the JSR `./cli` entrypoint.

## Library use

Accord is also published as a Deno-first TypeScript library. The default package entrypoint exposes the manifest model, manifest loading, case selection, comparison helpers, JSON-LD document policy helpers, report types, checker result codes, and the CLI runner:

```ts
import {
  readManifestSource,
  readScenarioIndexSource,
  selectTransitionCase,
  type ManifestDocument,
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

Accord also defines a portable JSON-LD `ScenarioIndex` shape for fixture-owned topology documents. A scenario index is not a replacement for a transition manifest and is not consumed by `accord check` today. It describes how multiple manifests fit into an ordered scenario.

The current library helpers are:

```ts
const loaded = await readScenarioIndexSource("conformance/index.jsonld");
await validateScenarioIndexDocument(loaded.document);
```

A scenario index can declare fixture-level defaults such as `defaultFixtureRepo`, `branchPrefix`, and `assetRoot`; named state lanes with `hasStateLane`; and an ordered `hasStep` list. Each `ScenarioStep` points at a transition manifest with `manifestPath` and may provide a `caseId` selector. `LaneStateBinding` nodes can bind a step to declared lanes using `fromLaneState` and `toLaneState` locators.

Current validation stays deliberately local. It checks that steps exist, step ids and lane keys are not duplicated, manifest paths are safe repository-relative paths that reference existing files, and lane bindings reference declared lanes. It does not read the referenced transition manifests for semantic compatibility, execute replay commands, or update fixture branches.

### Fixture repository

Accord checks file and RDF expectations against a local git checkout.

Today the runtime fixture resolution behavior is intentionally simple:

- if `--fixture-repo-path` is provided, Accord uses that path
- otherwise Accord uses the current working directory
- the selected path must already be a git repository

The manifest’s `fixtureRepo` value is still useful as semantic metadata, but the checker does not yet resolve local repositories from that field automatically.

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

Text is the default format. It prints:

- manifest path
- selected case id
- fixture repository path
- overall status
- summary counts
- only failing or error checks

Passing checks are counted in the summary but are not listed individually in text output.

### JSON output

Pass `--format json` to receive a machine-readable report.

The current JSON report includes:

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
- `path` or `assertionId` where applicable

## Exit codes

Accord currently uses:

- `0` for an overall pass
- `1` for an overall fail
- `2` for an overall error

The distinction matters:

- a `fail` means the manifest was evaluated successfully and one or more expectations did not match
- an `error` means Accord could not complete evaluation cleanly, for example because a ref could not be resolved, a manifest could not be loaded, or RDF input could not be parsed

## What the checker supports today

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
- `rdfCanonical`

`text` comparison normalizes LF versus CRLF line endings.

### RDF assertions

For `rdfCanonical` expectations, Accord currently supports:

- graph equivalence comparison
- ignored predicate filtering
- SPARQL `ASK` assertions attached through `RdfExpectation`

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

## Current limitations

- Accord does not yet auto-locate the fixture repository from `fixtureRepo`.
- Accord does not yet execute replay commands or apply replay materialization/file-operation metadata.
- `accord check` does not yet consume `ScenarioIndex` documents; they are currently a library-level topology contract for downstream tools.
- Accord does not yet support `json` compare mode.
- Accord does not yet support RDF/XML as an RDF artifact format.
- Arbitrary remote JSON-LD document loading is intentionally disabled.

## Where to look next

- [[ac.spec.2026.2026-04-03-accord-cli]] for the normative checker behavior
- [[ac.completed.2026.2026-04-03-accord-cli]] for implementation status and remaining work
- [[ac.completed.2026.2026-04-03-jsonld-support]] for the JSON-LD RDF artifact implementation record and remaining format follow-up
