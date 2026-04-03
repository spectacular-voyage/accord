---
id: wkc8i4y4983s7evp2smsbgl
title: General Development Guidance
desc: ''
updated: 1775232385519
created: 1775232375756
---

## Purpose

This note captures the current working guidance for Accord development. It should describe the implementation that actually exists, not an aspirational framework that has not landed yet.

Accord is currently a thin Deno CLI checker centered on `accord check`. Development should preserve that bias unless repeated real use cases justify broader scope.

## Source of truth

When changing behavior, keep these notes aligned:

- [[ac.spec.2026.2026-04-03-accord-cli]] is the normative checker spec
- [[ac.task.2026.2026-04-03-accord-cli]] tracks implementation status and remaining work
- [[ac.task.2026.2026-04-03-jsonld-support]] tracks JSON-LD RDF artifact follow-up work
- [[ac.task.2026.2026-04-03-accord-ci]] tracks CI, PR, and release-process follow-up work

If runtime behavior changes and the spec is affected, update the spec and then the relevant task note. Do not let code drift away from the documented checker contract.

## Current architecture

The current code layout is intentionally flat:

- `src/cli` for command parsing and routing
- `src/manifest` for JSON-LD manifest loading and case selection
- `src/git` for git-backed repository access
- `src/checker` for file, text, RDF, and SPARQL ASK evaluation
- `src/report` for text and JSON reports
- `tests/harness` for CLI and fixture-repo test helpers
- `testdata/` for black-box fixture repos, manifests, and scenario indexes

The runtime model is:

1. load the manifest as JSON-LD
2. select a `TransitionCase`
3. resolve a local git repository
4. inspect the named refs directly with git object reads
5. evaluate file expectations and RDF assertions
6. emit text or JSON results

Keep this model explicit and debuggable. Avoid layering in framework abstractions unless they remove a real recurring pain point.

## Current dependency stance

Accord is Deno-first, but the current implementation deliberately uses a few npm packages where they are the most practical RDF/JSON-LD tools:

- `jsonld.js` for manifest JSON-LD loading
- `n3` for RDF parsing and the in-memory RDFJS store
- `rdf-canonize` for RDF canonicalization
- `@comunica/query-sparql` for SPARQL `ASK`

That stack is acceptable because it is working under Deno today. It is still heavier than ideal, especially because Comunica has a large transitive graph, so new dependencies should be added cautiously and only when they solve a concrete problem.

## Important implementation boundaries

### Manifest JSON-LD support is not the same as RDF artifact JSON-LD support

Accord already supports JSON-LD for manifests.

That does not mean the RDF checker path automatically supports `.jsonld` artifact files under `rdfCanonical` or SPARQL `ASK`. That follow-up work is intentionally separated in [[ac.task.2026.2026-04-03-jsonld-support]].

Do not "add JSON-LD support" by merely extending a file-extension switch in the RDF checker. If `.jsonld` RDF artifact support is implemented, it should arrive as a real JSON-LD-to-quads ingestion layer with tests and spec updates.

### Local-only JSON-LD document loading is intentional

Manifest loading is fail-closed:

- inline contexts are fine
- local file contexts are fine
- arbitrary remote JSON-LD loading is disallowed unless explicitly allowlisted

Preserve that behavior unless there is a strong reason to change it, and if it changes, update the spec.

### Direct git object access is intentional

The current checker reads refs and blobs directly with git commands. That is simpler and more deterministic than worktree materialization during normal runtime.

Keep temporary git repo materialization inside tests and `testdata/` harness code, not in the runtime checker.

### RDF artifact syntax support is intentionally narrow today

The current RDF checker path only supports syntaxes parsed directly by `n3`:

- `.ttl`
- `.nt`
- `.nq`
- `.trig`

Do not pretend `.jsonld` or RDF/XML are supported until they have a real parser path and black-box coverage.

## Testing guidance

The current testing strategy has two layers:

- focused unit tests for parsing, git access, comparisons, and report behavior
- black-box tests driven by `testdata/scenarios/black-box.json`

The black-box suite is important because it asserts the CLI contract instead of implementation details. Prefer extending that suite when adding observable behavior.

The next major testing step is real-corpus validation against the `mesh-alice-bio` manifests. That should be treated as integration validation, not as a replacement for the synthetic black-box corpus.

When changing logic:

- run `deno task test`
- run `deno task check`
- run `deno task fmt:check`

When changing CI or coverage behavior, also use the existing coverage tasks rather than inventing ad hoc commands.

## Documentation expectations

Before or alongside meaningful behavior changes, update:

- [[ac.user-guide]] for user-visible CLI behavior
- [[ac.spec.2026.2026-04-03-accord-cli]] for normative contract changes
- the relevant task note for planning and scope tracking

Accord note files should stay readable and easy to edit. Avoid hard-wrapping markdown prose.

## Near-term priorities

The current order of work should be:

1. keep the current checker and black-box suite stable
2. complete user and development documentation for the current implementation
3. validate the checker against the real `mesh-alice-bio` corpus
4. only then expand format support such as JSON-LD RDF artifacts

That order matters. It is better to validate the current checker against its intended real corpus before broadening the format surface.
