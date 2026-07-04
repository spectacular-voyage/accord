---
id: 56rsorss4gbam1e6qkdlua4
title: 2026 07 04 Real Sparql Ask
desc: ''
updated: 1783148934710
created: 1783148934710
---

## Goals

- Decide whether Accord should replace the current narrow in-repo ASK evaluator with a real SPARQL ASK engine, or deliberately extend the in-repo evaluator for the next proven subset.
- Unblock natural negative RDF assertions such as `FILTER NOT EXISTS` without forcing every absence proof into an inverted `expectedBoolean: false` workaround.
- Support common SPARQL literal syntax, especially bare boolean and numeric literals, when those terms are already valid in the RDF artifact graph.
- Keep Accord's execution model deterministic, local-only, and artifact-scoped.
- Preserve the current `SparqlAskAssertion` manifest shape unless a vocabulary change is truly needed.

## Summary

Accord currently has intentionally narrow SPARQL `ASK` support. The implementation parses a small graph-pattern subset in `src/checker/sparql.ts` and evaluates it over the RDF artifact loaded from the target git ref. [[ac.dev.general-guidance]] documents that choice: it avoids pulling in a broad SPARQL engine and currently supports IRIs, variables, literals, RDF `a`, repeated-variable joins, semicolon predicate-object lists, and comma object lists.

That was the right tradeoff for the first checker slice, but the Stagecraft temporal-vocabulary rung exposed a real product gap. Contract manifests naturally want absence proofs like:

```sparql
ASK {
  FILTER NOT EXISTS {
    ?relator <https://example.test/endedAt> ?end .
  }
}
```

The current workaround is to write a positive pattern and set `expectedBoolean: false`. That works, but it makes authoring less clear and it does not scale to more expressive absence checks. The same rung also hit boolean-literal ergonomics: a SPARQL author expects `true` and `false` to work as typed literals, while the current evaluator only accepts quoted RDF literals such as `"true"^^<http://www.w3.org/2001/XMLSchema#boolean>`.

This task should decide and land the smallest credible "real ASK" improvement. The preferred shape is a bounded SPARQL ASK execution path over Accord's already-loaded artifact graph. If dependency or Deno compatibility makes that too costly, the fallback should be an explicit parser/evaluator extension with a clearly documented supported subset, not an accidental one-feature-at-a-time parser.

## Discussion

### What "real ASK" means here

For Accord, real ASK does not mean becoming a SPARQL endpoint. It means authored `SparqlAskAssertion.query` strings can use ordinary SPARQL ASK syntax for contract checks over one local artifact graph.

In scope for the first slice:

- `ASK` and `ASK WHERE`
- `PREFIX` declarations, if the selected engine/parser handles them cleanly
- basic graph patterns already supported today
- typed, language-tagged, boolean, and numeric literals
- `FILTER NOT EXISTS` for absence checks
- stable error reporting when the query is invalid or uses unsupported features
- `.ttl` and `.jsonld` RDF artifact inputs through the existing local-only loading policy

Out of scope unless a chosen engine gives it essentially for free and tests prove it:

- remote `SERVICE`
- update operations
- `SELECT`, `CONSTRUCT`, and `DESCRIBE`
- named graph semantics beyond Accord's current artifact loading model
- network access or remote JSON-LD context loading
- using SPARQL as a replacement for `rdfCanonical` comparison

### Candidate approaches

1. Use a real SPARQL engine for ASK.

   This is the cleanest product shape if it is stable under Deno. Re-spike Comunica or another RDF/JS-compatible engine against the current Deno toolchain, with special attention to resolver behavior, transitive dependencies, and permissions. Earlier guidance avoided Comunica because of Deno/npm instability around transitive dependencies, so the spike has to prove that risk has changed or is manageable.

2. Use a SPARQL parser plus a small local evaluator.

   This could be a middle path if a parser such as `sparqljs` is Deno-compatible and produces an algebra/AST Accord can evaluate safely. It is less dependency-heavy than a full engine, but Accord would still own execution semantics for filters, joins, and literal comparison. That ownership should be accepted consciously.

3. Extend the current regex/token parser.

   This is acceptable only for a tiny stopgap. Adding `FILTER NOT EXISTS`, prefixes, boolean literals, numeric literals, and future filters by hand risks rebuilding a fragile SPARQL subset. If this route is chosen, the task should explicitly document the subset and add tests for every accepted construct and every intentionally rejected construct.

## Acceptance Criteria

- Manifests can express at least one `FILTER NOT EXISTS` absence check as a positive `expectedBoolean: true` ASK assertion.
- Manifests can use bare `true` and `false` SPARQL boolean literals where the artifact graph contains matching `xsd:boolean` literals.
- Current passing ASK fixtures still pass.
- Current mismatch reporting still distinguishes query errors from boolean-result mismatches.
- `.jsonld` RDF artifacts still use the existing local-only document-loading policy and do not consult the working tree for historical ref contexts.
- Invalid or unsupported query syntax yields a stable `sparql_ask` report with a useful message, not a raw parser or dependency stack trace.
- No network access is required or permitted for ASK execution.
- Documentation states the supported ASK surface honestly, including any remaining exclusions.

## Relationship To Validation

[[ac.task.2026.2026-04-03-shacl-validation]] should not own SPARQL parser semantics. If this task exposes a reusable query-syntax preflight, `accord validate` can call it later so authoring errors surface before `accord check` runs a transition. If no reusable preflight is exposed, the SHACL validation task should say that ASK syntax failures remain check-time errors.

## Open Issues

- Is a full SPARQL engine now stable enough under Deno 2.x for Accord's release gate, or does it recreate the dependency instability that led to the current in-repo evaluator?
- Should the first slice require `PREFIX`, or can all first-slice examples stay absolute-IRI-only while still supporting `FILTER NOT EXISTS`?
- Should `GRAPH` be explicitly rejected until Accord models named graph loading, even if a selected engine can parse it?
- Should unsupported valid-SPARQL features be reported as query errors, or should Accord distinguish "invalid query" from "valid SPARQL outside Accord's supported profile"?
- Does this task need any vocabulary change, or is better behavior under the existing `SparqlAskAssertion.query` enough?

## Decisions

- Keep `SparqlAskAssertion` as the manifest surface for this task.
- Keep `expectedBoolean` semantics unchanged.
- Keep ASK execution local to the artifact graph selected by the owning `RdfExpectation`.
- Do not fold this work into SHACL manifest validation.
- Do not make Accord a general SPARQL CLI.
- Re-spike result on Deno 2.8.3: do not wire `@comunica/query-sparql` into the checker for this slice. `deno info npm:@comunica/query-sparql` resolves `@comunica/query-sparql@5.2.4`, but a normal Deno npm-cache import with `--node-modules-dir=none` still fails through `jsonld-context-parser@2.4.0` requiring `cross-fetch/polyfill` and Deno reporting the resolved `dist/node-polyfill.js` path as missing. The file exists in the cache after resolution, so this remains the Deno/npm resolver class of failure that previously pushed Accord away from Comunica.
- Comunica does run when forced through a physical `node_modules` directory (`--node-modules-dir=auto`) and correctly answers `FILTER NOT EXISTS`, bare boolean literal, and integer literal ASK probes over an in-memory `n3` store. That path initialized a very large graph, emitted deprecation noise, and pulled remote-source, HTTP, update, RDF/XML, HTML, JSON-LD streaming, and serializer actors that Accord does not need for local artifact-scoped ASK. Functional, yes; release-gate dependency shape, no.
- Comunica dependency/performance notes from the spike: isolated cache size was about 95 MB; `deno info --json` reported 518 npm packages in the resolved cache; the warm physical-`node_modules` functional probe answered the first ASK in about 19 ms after import/engine setup and the next two in about 2-3 ms. Those per-query numbers are fine, but import/setup weight and resolver behavior are not.
- `sparqljs@3.7.4` is compatible with the normal Deno npm cache path and does not need physical `node_modules`. In a clean `--no-config` spike, `deno info npm:sparqljs@3.7.4` reported 4 unique dependencies, 2.66 MB logical dependency size, and a 4.3 MB isolated cache. It parsed `ASK`, `ASK WHERE`, `PREFIX`, `FILTER NOT EXISTS`, bare booleans, and numeric literals into RDFJS-shaped terms that Accord can evaluate locally. The package is deprecated upstream, so it should be treated as a bounded parser dependency for this first slice rather than a blank check for broad SPARQL growth.
- Choose the parser-plus-local-evaluator route for this task: use `sparqljs` for syntax and term parsing, keep evaluation in Accord over the already-loaded RDF artifact quads, and document the committed ASK profile explicitly. Do not extend the old regex/token parser for `FILTER NOT EXISTS`.

## Contract Changes

The likely contract change is behavioral rather than vocabulary-level:

- `accord check` accepts a broader, documented SPARQL ASK surface.
- `FILTER NOT EXISTS` can be used directly for absence checks.
- SPARQL boolean literals can be used directly instead of requiring quoted typed RDF literal syntax.
- Error output for unsupported ASK syntax becomes part of the checker contract.

If the implementation adopts a full SPARQL engine and thereby supports additional standard SPARQL features, the docs should still state the features Accord tests and commits to support. Incidental engine support should not silently become the product contract.

## Testing

- Add unit tests for `FILTER NOT EXISTS` returning true and false.
- Add unit tests for bare boolean literals and numeric literals matching RDF typed literals.
- Add unit tests for prefix handling if prefixes are in the first slice.
- Add JSON-LD artifact ASK coverage for at least one new supported construct.
- Add a black-box manifest that proves a natural absence assertion can pass with `expectedBoolean: true`.
- Keep the existing `bb-205` through `bb-211` ASK coverage green.
- Add stable failure tests for unsupported syntax if Accord keeps a supported-profile boundary.
- Run `deno task fmt:check`, `deno task check`, and `deno task test`.

## Non-Goals

- General SPARQL endpoint behavior.
- Remote graph loading or `SERVICE`.
- Query forms other than ASK.
- Replacing RDF canonical comparison.
- SHACL validation implementation.
- Domain-specific Stagecraft assertion helpers.

## Implementation Plan

- [x] Re-spike a real SPARQL ASK engine under the current Deno toolchain and record dependency, permission, and performance risks.
- [c] If the engine spike is clean, wire ASK execution through the engine while preserving Accord's existing RDF artifact loading and report codes.
- [x] If the engine spike is not clean, choose between a parser-plus-local-evaluator slice and a deliberately small extension of the current evaluator.
- [x] Add acceptance tests before changing behavior, using the Stagecraft temporal-rung absence check as the motivating shape.
- [x] Keep query-error and boolean-mismatch reporting stable.
- [x] Update [[ac.dev.general-guidance]], [[ac.spec.2026.2026-04-03-accord-cli]], and user docs to describe the supported ASK profile.
- [x] Update [[ac.task.2026.2026-04-03-shacl-validation]] to record that this task did not expose a reusable syntax/profile preflight; ASK syntax/profile failures remain check-time `sparql_query_error` results for now.
