---
id: 8a82ad8ccc79482cad224517acb64853
title: 'release notes v0.1.0'
desc: ''
updated: 1783310133508
created: 1779520409342
---

## Summary

Accord `v0.1.0` turns the early conformance-manifest prototype into a Deno-first executable acceptance layer. It keeps the published ontology and SHACL identifiers on stable slash-ended namespaces, adds real local checking for file, RDF, SPARQL ASK, and JSON artifact expectations, ships standalone SHACL validation, and adds the first scenario and draft-authoring commands.

The release is still intentionally small and runner-neutral. Accord checks authored transition expectations against local git refs, validates manifest authoring constraints, runs ordered scenario indexes, and scaffolds conservative draft manifests. It does not execute Semantic Flow operations, push branches, or become a workflow orchestrator.

## Highlights

### Vocabulary And Packaging

- Changes the Accord term namespace from `https://spectacular-voyage.github.io/accord/ns#` to `https://spectacular-voyage.github.io/accord/ontology/`.
- Changes the Accord SHACL shape namespace from `https://spectacular-voyage.github.io/accord/shapes#` to `https://spectacular-voyage.github.io/accord/shacl/`.
- Sets the ontology document IRI to `https://spectacular-voyage.github.io/accord/ontology`.
- Sets the SHACL document IRI to `https://spectacular-voyage.github.io/accord/shacl`.
- Adds version, release, preferred namespace, creator, content URL, and downloadable TTL metadata to both `accord-ontology.ttl` and `accord-shacl.ttl`.
- Updates Accord's JSON-LD loaders, bundled context, examples, and test fixtures to use the new slash namespaces.
- Adds `JsonExpectation` and `JsonAssertion` to the ontology, with `hasJsonAssertion`, `jsonPath`, `jsonAssertionKind`, `expectedValue`, and `expectedCount`, plus matching SHACL authoring shapes.
- Adds regression coverage that parses the Turtle files and verifies the new metadata headers do not drift back to the old hash namespaces.
- Exposes a Deno-first package surface with manifest loading, scenario loading, validation, checker helpers, report types, and the CLI runner through `jsr:@spectacular-voyage/accord`.

### CLI Commands

- `accord check <manifest-path>` evaluates one transition case against a local git repository, reading refs and blobs directly from git objects rather than the working tree.
- `accord validate <manifest-path>` validates authored JSON-LD against the shipped Accord SHACL shapes, including Accord-owned `sh:sparql` constraint execution.
- `accord check-scenario <scenario-index.jsonld>` runs ordered scenario steps by wrapping the existing single-check report per step, preserving step order and isolating per-step manifest/setup errors.
- `accord draft-manifest --from <ref> --to <ref>` scaffolds a deterministic JSON-LD manifest from `git diff --name-status --find-renames`, emitting file expectations only.
- `accord check`, `accord check-scenario`, and `accord validate` share stable exit codes for scripting: `0` pass/conformant, `1` fail/non-conformant, `2` error.

### Checking Surface

- JSON-LD manifest loading is fail-closed and local-only: inline and local file contexts are supported; arbitrary remote `http`/`https` contexts are rejected.
- File expectations cover `added`, `updated`, `unchanged`, `removed`, and `absent` change types with byte, text, JSON assertion, and RDF canonical support where appropriate.
- Whole-tree completeness checks report unexpected added, removed, or changed paths, with an explicit `ignorePaths` contract and fail-closed path validation.
- RDF comparison supports `.ttl`, `.nt`, `.nq`, `.trig`, and `.jsonld`, including JSON-LD artifact contexts loaded from the checked git ref rather than the working tree.
- RDF canonical comparison is blank-node-insensitive and supports ignored predicates through `RdfExpectation`.
- SPARQL ASK assertions are parser-backed with `sparqljs` but evaluated locally by Accord over parsed artifact quads. The committed profile supports ASK/BGP patterns, prefixes, repeated-variable joins, blank nodes as query-local variables, RDF `a`, semicolon and comma predicate/object lists, typed and language-tagged literals, bare boolean and numeric literals, and `FILTER NOT EXISTS`.
- Broader SPARQL endpoint features such as `SERVICE`, `OPTIONAL`, `UNION`, `GRAPH`, `MINUS`, `BIND`, `VALUES`, property paths, subqueries, `FROM`, non-ASK forms, and general filter expressions are rejected with stable `sparql_query_error` diagnostics.
- JSON assertions support `exists`, first-class `notExists`, `equals`, and `count` over a documented in-repo JSONPath subset: root, dot/bracket child access, wildcard, recursive descent to names or wildcards, and non-negative array indexes.
- JSON assertion artifact reads come from the checked git ref, not the working tree, and duplicate JSON object keys fail closed with `json_duplicate_key`.

### Validation And Authoring

- SHACL validation now catches malformed manifest authoring without being hidden inside `accord check`.
- The shipped shapes cover transition manifests, scenario indexes, scenario steps, state lanes, lane bindings, file expectations, RDF expectations, SPARQL ASK assertions, JSON expectations, and JSON assertions.
- The local SHACL-SPARQL evaluator now applies filters after sibling patterns in each group, matching Accord's ASK filter-scoping profile.
- `accord draft-manifest` maps git diff statuses conservatively: `A` to `added`, `M` to `updated`, `D` to `removed`, and `R*` to removed-old plus added-new.
- Drafted compare modes are inferred from a small documented extension table: RDF extensions use `rdfCanonical`, known text extensions use `text`, and everything else uses `bytes`.
- Draft output is byte-stable for the same refs and repository state, writes to stdout by default, and refuses to overwrite `--out` without `--force`.

## Breaking Or Changed Behavior

JSON-LD manifests and scenario indexes should update their Accord vocabulary context to:

```json
{
  "@vocab": "https://spectacular-voyage.github.io/accord/ontology/"
}
```

Consumers that store expanded RDF using old `https://spectacular-voyage.github.io/accord/ns#...` term IRIs should migrate those values to `https://spectacular-voyage.github.io/accord/ontology/...`.

Accord does not add backward-compatibility aliases for the old namespace in this release. Until a v1.0 stability commitment exists, the cleaner contract is preferable to a permanent dual-namespace surface.

`accord validate` is a separate command rather than an implicit preflight inside `accord check`. CI workflows that want both semantic checking and manifest authoring validation should run both commands explicitly.

Scenario lane bindings are loaded and reported, but they are topology metadata in this release. `accord check-scenario` does not use lane bindings to override a selected manifest case's `fromRef` / `toRef`.

Scenario indexes with missing or empty `hasStep` now produce a scenario-level setup error with stable code `scenario_steps_required`; they are not treated as vacuous passes.

`rdfCanonical` file expectations can be checked and validated without a companion `RdfExpectation`. Add `RdfExpectation` only when a manifest needs `ignorePredicate` or `SparqlAskAssertion` behavior.

## Artifacts

- JSR package: `@spectacular-voyage/accord`
- Deno library import: `jsr:@spectacular-voyage/accord`
- Deno CLI entrypoint: `jsr:@spectacular-voyage/accord/cli`
- GitHub source release: `v0.1.0`

## Validation

- Turtle metadata regression tests parse `accord-ontology.ttl` and `accord-shacl.ttl`.
- The current release gate is `deno task fmt:check`, `deno task check`, `deno task lint`, and `deno task test`.
- The latest full gate passed with 151 tests.
- Focused coverage includes JSON-LD manifest loading, local-only document policy, git object access, file/tree expectation behavior, RDF canonical comparison, JSON-LD RDF artifacts, SPARQL ASK profile support and rejection cases, JSON assertion kinds and failure modes, SHACL validation, scenario ordering/path resolution/error isolation, and draft-manifest check/validate round trips.
- Package dry-run and release publication checks should still be run before tagging/publishing.

## Known Limitations

- This is not a native binary release.
- This is not an npmjs global-install release.
- Accord does not execute Semantic Flow operations, replay profiles, replay commands, input materialization, or manual file operations. Replay/provenance metadata is loaded for downstream tooling, but `accord check` still evaluates `fromRef`, `toRef`, and explicit expectations.
- `accord check-scenario` runs scenario steps but does not yet use lane bindings to drive git ref selection.
- `accord validate` does not preflight `SparqlAskAssertion.query` syntax/profile support; ASK query errors remain check-time diagnostics.
- JSON assertions intentionally use a small in-repo path subset rather than full RFC 9535 JSONPath.
- `json` compare mode is assertion-oriented; Accord does not yet perform whole-document JSON structural comparison for `updated` or `unchanged` files.
- RDF/XML is not yet an RDF artifact format.
- Arbitrary remote JSON-LD document loading is intentionally disabled.

## Next

- Publish dereferenceable ontology and SHACL pages for the new document IRIs.
- Use the `mesh-alice-bio` smoke subset and full-corpus reruns as optional cross-repository checks when real Semantic Flow fixture compatibility is the point of the change.
- Continue tightening the conformance-authoring loop around real Semantic Flow manifests, especially scenario topology, draft-manifest review flows, and eventual replay-runner integration.
- Consider whole-document JSON comparison and RDF/XML only after the current in-repo checker contract stays crisp against real fixture usage.
