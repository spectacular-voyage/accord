---
id: xy0jpe61u3mt53e2xir642s
title: Accord User Guide
desc: ''
updated: 1775228653246
created: 1775228646463
---

## Purpose

Accord is a deterministic checker for machine-readable conformance manifests. Today the primary command is `accord check`, which answers a narrow question: does a manifest correctly describe the expected transition between two named refs in a local fixture repository?

This guide describes the current checker behavior that exists in this repository now. It does not describe future packaging or planned commands that have not landed yet.

## Current command surface

Today the checker is run from the repository with Deno:

```bash
deno run -A src/main.ts --help
deno run -A src/main.ts check <manifest-path>
```

The current CLI usage is:

```text
accord check <manifest-path> [--case <case-id>] [--fixture-repo-path <path>] [--format <text|json>]
accord --help
```

The eventual packaged command should preserve this shape, but the current repository-native invocation is still `deno run -A src/main.ts ...`.

## Inputs

### Manifest

The manifest input is a local JSON-LD file. Accord currently supports JSON-LD manifest loading with a deterministic local-only document-loader policy.

That means:

- inline contexts are supported
- local file contexts are supported
- arbitrary remote contexts are rejected unless explicitly allowlisted in the implementation

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

The current RDF artifact syntax support is intentionally limited to formats parsed directly by `n3`:

- `.ttl`
- `.nt`
- `.nq`
- `.trig`

JSON-LD manifests are supported. JSON-LD RDF artifact files are not yet supported in the RDF checker path. That follow-up is tracked in [[ac.task.2026.2026-04-03-jsonld-support]].

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
- Accord does not yet support `.jsonld` as an RDF artifact format in `rdfCanonical` or SPARQL `ASK`.
- Accord does not yet support `json` compare mode.
- Arbitrary remote JSON-LD document loading is intentionally disabled.

## Where to look next

- [[ac.spec.2026.2026-04-03-accord-cli]] for the normative checker behavior
- [[ac.task.2026.2026-04-03-accord-cli]] for implementation status and remaining work
- [[ac.task.2026.2026-04-03-jsonld-support]] for planned JSON-LD RDF artifact support
