---
id: wkc8i4y4983s7evp2smsbgl
title: General Development Guidance
desc: ''
updated: 1775232385519
created: 1775232375756
---

## Purpose

This note captures the current working guidance for Accord development. It should describe the implementation that actually exists, not an aspirational framework that has not landed yet.

Accord is currently a thin Deno CLI centered on `accord check` for fixture-transition execution, `accord check-scenario` for ordered scenario execution, `accord draft-manifest` for conservative authoring scaffolds, and `accord validate` for manifest SHACL authoring validation. Development should preserve that bias unless repeated real use cases justify broader scope.

## Source of truth

When changing behavior, keep these notes aligned:

- [[ac.spec.2026.2026-04-03-accord-cli]] is the normative checker spec
- [[ac.completed.2026.2026-04-03-accord-cli]] tracks implementation status and remaining work
- [[ac.completed.2026.2026-04-03-jsonld-support]] records the JSON-LD RDF artifact implementation and remaining format follow-up in that area
- [[ac.completed.2026.2026-04-03-accord-ci]] tracks CI, PR, and release-process follow-up work

If runtime behavior changes and the spec is affected, update the spec and then the relevant task note. Do not let code drift away from the documented checker contract.

## Current architecture

The current code layout is intentionally flat:

- `src/cli` for command parsing and routing
- `src/draft` for deterministic draft-manifest rendering
- `src/manifest` for JSON-LD manifest loading and case selection
- `src/git` for git-backed repository access
- `src/checker` for file, text, JSON assertion, RDF, and SPARQL ASK evaluation
- `src/shacl` for manifest RDF dataset validation against the shipped Accord SHACL shapes
- `src/report` for text and JSON reports
- `tests/harness` for CLI and fixture-repo test helpers
- `testdata/` for black-box fixture repos, manifests, and scenario indexes

The `accord check` runtime model is:

1. load the manifest as JSON-LD
2. select a `TransitionCase`
3. resolve a local git repository
4. inspect the named refs directly with git object reads
5. evaluate file expectations plus JSON and RDF assertions
6. emit text or JSON results

Keep this model explicit and debuggable. Avoid layering in framework abstractions unless they remove a real recurring pain point.

The `accord validate` runtime model is separate: load a manifest through the same fail-closed local-only JSON-LD policy, convert it to an RDF dataset, load the shipped `accord-shacl.ttl`, run SHACL Core and the shipped `sh:sparql` constraints, emit a stable validation report, and return a failing exit status for non-conformance. Do not hide this validation inside `accord check`.

The `accord draft-manifest` runtime model is also separate: resolve a local git repository, read `git diff --name-status --find-renames` through `src/git`, map changed paths to file expectations, infer compare modes from the documented extension table, and write deterministic JSON-LD. It must not read the working tree, run validation/checking implicitly, fabricate ASK or JSON assertions, or bake local fixture paths into the generated manifest.

## Current dependency stance

Accord is Deno-first, but the current implementation deliberately uses a few npm packages where they are the most practical RDF/JSON-LD tools:

- `jsonld.js` for manifest JSON-LD loading
- `jsonld.js` for `.jsonld` RDF artifact ingestion
- `n3` for RDF parsing and the in-memory RDFJS store
- `rdf-canonize` for RDF canonicalization
- `sparqljs` for parsing authored SPARQL ASK syntax before Accord evaluates the supported local profile over parsed quads
- `shacl-engine` for SHACL validation, currently using an Accord-owned `sh:sparql` validation hook because `shacl-engine/sparql.js` hits Deno npm-cache resolver problems

SPARQL `ASK` support is intentionally implemented as a small local evaluator over parsed quads rather than through Comunica. `sparqljs` handles syntax, prefixes, and RDF term parsing; Accord owns the execution profile. The committed profile supports `ASK` and `ASK WHERE`, `PREFIX`, basic graph patterns, IRIs, variables, blank nodes as query-local variables, RDF `a`, repeated-variable joins, semicolon predicate-object lists, comma object lists, typed and language-tagged literals, bare boolean and numeric literals, and `FILTER NOT EXISTS` graph-pattern filters. It deliberately rejects broader SPARQL features such as `SERVICE`, `OPTIONAL`, `UNION`, `GRAPH`, `MINUS`, `BIND`, `VALUES`, property paths, subqueries, `FROM`, non-ASK query forms, and general filter expressions with `sparql_query_error`. That keeps ASK execution local, avoids Deno/npm resolver instability from Comunica's transitive `cross-fetch` chain, and prevents incidental parser support from becoming Accord's product contract. New dependencies should be added cautiously and only when they solve a concrete problem.

JSON assertion path support is intentionally implemented as a small in-repo JSONPath subset, not an RFC 9535 dependency. The committed profile supports `$`, dot child names matching `[A-Za-z_][A-Za-z0-9_-]*`, quoted bracket child names, child wildcards `.*` and `[*]`, recursive descent to names or wildcards, and non-negative array indexes. It rejects filters, slices, unions, script/current-node expressions, negative indexes, parent operators, function selectors, and descendant indexes with `json_path_unsupported`. Do not broaden this grammar without updating [[ac.spec.2026.2026-04-03-accord-cli]], docs, and rejection/acceptance tests.

## Important implementation boundaries

### Manifest JSON-LD loading and RDF artifact JSON-LD loading share policy, not storage access

Accord now supports JSON-LD for both manifests and `.jsonld` RDF artifacts.

The shared rule is the fail-closed local-only JSON-LD document-loading policy. The local document wrappers are intentionally different:

- manifests load local JSON-LD documents from the filesystem
- `.jsonld` RDF artifacts load local JSON-LD documents from the checked git ref, not from the working tree

Do not collapse that distinction. If the RDF checker consults the working tree for local JSON-LD artifact contexts, it will read the wrong data for historical refs.

### Local-only JSON-LD document loading is intentional

Manifest loading and `.jsonld` RDF artifact loading are fail-closed:

- inline contexts are fine
- local file contexts are fine
- arbitrary remote JSON-LD loading is disallowed unless explicitly allowlisted

Preserve that behavior unless there is a strong reason to change it, and if it changes, update the spec.

### Direct git object access is intentional

The current checker reads refs and blobs directly with git commands. The drafter reads diff metadata directly with `git diff --name-status --find-renames`. Both paths are simpler and more deterministic than worktree materialization during normal runtime.

Keep temporary git repo materialization inside tests and `testdata/` harness code, not in the runtime checker.

### JSON assertions are raw artifact checks

`JsonExpectation` targets a `FileExpectation`, and `JsonAssertion` evaluates the target file's raw JSON bytes from the selected case's `toRef`. This is separate from RDF `.jsonld` ingestion: JSON assertions do not expand JSON-LD and do not load remote documents. Duplicate object keys in asserted JSON artifacts fail closed with `json_duplicate_key` before assertion evaluation.

The first assertion kinds are `exists`, `notExists`, `equals`, and `count`. `notExists` is first-class because absence proofs are part of Accord's contract language, not an inversion trick.

### RDF artifact syntax support is intentionally limited

The current RDF checker path supports:

- `.ttl`
- `.nt`
- `.nq`
- `.trig`
- `.jsonld`

The `.jsonld` path is a real JSON-LD-to-quads ingestion layer using `jsonld.js`, not an `n3` parser shortcut.

RDF/XML is still not supported. Do not pretend it is until there is a real parser path and black-box coverage.

### Draft compare-mode inference is intentionally small

`accord draft-manifest` infers `rdfCanonical` for `.ttl`, `.nt`, `.nq`, `.trig`, and `.jsonld`; `text` for the documented known text extensions; and `bytes` for everything else. Keep this table explicit in [[ac.spec.2026.2026-04-03-accord-cli]] and [[ac.user-guide]], and do not broaden it silently.

## Testing guidance

The current testing strategy has two layers:

- focused unit tests for parsing, git access, comparisons, and report behavior
- black-box tests driven by `testdata/scenarios/black-box.json`
- optional `mesh-alice-bio` smoke tests driven by the real sibling `semantic-flow-framework` manifests and `mesh-alice-bio` fixture checkout when those repositories are present

The black-box suite is important because it asserts the CLI contract instead of implementation details. Prefer extending that suite when adding observable behavior.

Real-corpus validation against the `mesh-alice-bio` manifests is useful, but it is not part of Accord's ordinary release gate. Treat it as optional cross-repository integration validation. Weave owns the live Semantic Flow fixture ladder checks, while Accord's default suite should stay stable against its in-repo synthetic corpus.

The current baseline is:

- `deno task test` for the default in-repo release-gate suite
- `deno task test:black-box` for the synthetic CLI contract
- `deno task test:mesh-alice-bio` for a representative real-corpus smoke subset when the sibling `semantic-flow` repositories are available
- an explicit full-corpus rerun against all current `mesh-alice-bio` manifests when the fixture ladder or real manifests change materially

The opt-in `mesh-alice-bio` smoke test reads the latest Semantic Flow Framework Alice manifests, then rewrites their bare numbered `fromRef` / `toRef` values to the current `a.NN-*` replay branch series in a temporary manifest copy. It discovers the current manifest set and checks every manifest; any known-incomplete manifest must be listed explicitly in the test with a reason. Weave remains responsible for full live-ladder regeneration and fixture repair.

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
3. use the `mesh-alice-bio` smoke subset and full-corpus reruns as optional cross-repository checks when real fixture compatibility is the point of the change
4. only then expand the remaining format surface such as whole-document JSON compare mode or RDF/XML support

That order matters. It is better to keep Accord's in-repo contract crisp and let Weave carry the live Semantic Flow ladder as that corpus evolves.
