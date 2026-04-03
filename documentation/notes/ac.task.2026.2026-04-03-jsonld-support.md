---
id: 1lk0vc8sqw74hen1v35ud8n
title: 2026 04 03 Jsonld Support
desc: ''
updated: 1775236929174
created: 1775236929174
---

## Goal

Add JSON-LD support for RDF file expectations and SPARQL ASK assertions in `accord check`, while preserving the same deterministic local-only document loading policy already used for Accord manifest loading.

## Summary

Accord already supports JSON-LD manifests. This task is not about manifest loading. It is about supporting `.jsonld` as an RDF artifact format under `rdfCanonical` comparison and RDF-backed `SparqlAskAssertion` execution.

Today the RDF assertion path in `src/checker/compare_rdf.ts` and `src/checker/sparql.ts` is intentionally limited to syntaxes parsed directly by `n3`:

- `.ttl`
- `.nt`
- `.nq`
- `.trig`

That is enough for the current `mesh-alice-bio` corpus, which targets `.ttl` RDF files even though the manifests themselves are JSON-LD. It is not enough if future fixtures or downstream users want to assert over RDF artifacts authored as `.jsonld`.

The right implementation shape is an ingestion layer in front of the existing quad-based checker flow:

- parse RDF input into RDF/JS quads
- keep the quad store/query backend separate from file format handling
- continue using `n3` and `rdf-canonize` once quads exist
- continue using Comunica against an RDF/JS source or `n3` store once quads exist

For `.jsonld`, the parser should come from `jsonld.js`, not from `n3`.

## Why This Is Separate From The Existing CLI Task

[[ac.task.2026.2026-04-03-accord-cli]] intentionally scoped the first usable checker to the formats the current corpus actually exercises. That let the first implementation land without pretending that JSON-LD RDF ingestion was "just another file extension."

Adding `.jsonld` support is a real feature, not a MIME mapping tweak. Doing it correctly requires:

- a distinct JSON-LD to RDF conversion path
- the same fail-closed local document-loader policy used for manifests
- additional black-box fixtures and failure cases
- some explicit decisions about default graph handling and context policy

That is enough scope to justify a dedicated follow-up task.

## Current State

- Accord manifest loading already uses `jsonld.js` with a local-only document-loader policy.
- RDF canonical comparison currently parses RDF using `n3` and then canonicalizes with `rdf-canonize`.
- SPARQL ASK execution currently parses RDF using `n3`, loads quads into an in-memory `n3` store, and queries that store through Comunica.
- The current `semantic-flow-framework/examples/alice-bio/conformance` manifests target `.ttl` RDF files for `rdfCanonical` expectations, not `.jsonld` files.

So the immediate need is not blocked, but the missing capability is real.

## Desired Design

### Core separation

Backend/store selection should stay separate from file format support.

The desired pipeline is:

1. detect the RDF artifact format from the path
2. parse the artifact into RDF/JS quads
3. optionally filter ignored predicates on quads for graph comparison
4. canonicalize quads for `rdfCanonical`
5. load quads into the queryable store/source for SPARQL ASK

This means `.ttl` and `.jsonld` should converge on the same internal quad representation before comparison or query execution.

### JSON-LD ingestion

For `.jsonld` files, Accord should:

- read the file as JSON text
- parse it as JSON
- convert it to RDF quads with `jsonld.js`
- apply the same local-only document-loader policy already used for manifest loading
- reject non-allowlisted remote contexts or linked documents

The intent is deterministic execution, not best-effort remote expansion.

### Store/query path

The current in-memory `n3` store plus Comunica path is acceptable unless JSON-LD ingestion exposes a compatibility problem. If quads produced by `jsonld.js` are not fully compatible with the store/query stack, term normalization can be added as an adapter step. That normalization should be introduced only if tests show a real incompatibility.

### Default graph and named graph handling

The first JSON-LD RDF-ingestion implementation should preserve the RDF dataset semantics produced by `jsonld.js`.

That means:

- preserve named graphs
- keep the default graph as the default graph
- do not invent synthetic named graphs or provenance triples unless a concrete Accord requirement emerges

This is an important constraint. Another project may have needed graph remapping or control triples, but Accord should not silently import those semantics without a specification reason.

## Decisions

- Treat JSON-LD RDF artifact support as a separate follow-up task from the initial Accord CLI bring-up.
- Keep manifest JSON-LD handling and RDF artifact JSON-LD handling conceptually separate, even if both use `jsonld.js`.
- Preserve the current quad-based backend split:
  - `jsonld.js` for JSON-LD to RDF ingestion
  - `n3` for the current in-memory RDF store and RDF syntax parsing where applicable
  - `rdf-canonize` for canonicalization
  - Comunica for ASK execution
- Reuse the same fail-closed local-only document-loader policy as the manifest loader.
- Do not add synthetic provenance triples or default-graph remapping unless the Accord spec later requires them.

## Open Questions

- Should the RDF artifact loader and manifest loader share one JSON-LD document-loader implementation, or should they have separate wrappers over the same policy?
- Does `jsonld.js` produce RDF/JS terms that work directly with the current `n3` store and canonicalization flow under Deno, or do we need a normalization adapter?
- Should Accord support only `.jsonld`, or also plan for RDF/XML in the same follow-up if another parser is added?
- Do we want direct unit coverage of `jsonld.toRDF(...)` output shape, or should tests focus only on black-box `accord check` behavior?
- Should JSON-LD RDF artifact support be merged before or after running the current checker against the full `mesh-alice-bio` manifest corpus?

## Contract Changes

No ontology or SHACL changes are required just to support `.jsonld` as an RDF artifact format.

However, [[ac.spec.2026.2026-04-03-accord-cli]] should be updated before implementation to make `.jsonld` an explicitly supported RDF artifact syntax for:

- `rdfCanonical`
- `SparqlAskAssertion`

The spec update should also define the JSON-LD document-loading policy for RDF artifacts, not just for manifests.

## Testing

Minimum additional coverage should include:

- unit tests that convert `.jsonld` RDF content into quads successfully
- unit tests for remote context rejection in RDF artifact loading
- unit tests for local file context support in RDF artifact loading
- black-box `rdfCanonical` pass/fail scenarios for `.jsonld` inputs
- black-box SPARQL ASK pass/fail scenarios for `.jsonld` inputs
- at least one invalid JSON-LD or invalid context scenario that produces a stable error code

The testdata plan should likely add a new small RDF fixture family for `.jsonld` artifact cases rather than overloading the existing Turtle-only fixtures.

## Non-Goals

- changing Accord manifest vocabulary
- adding synthetic provenance triples to RDF artifact ingestion
- remapping the default graph to a synthetic named graph without a specification reason
- broadening report semantics beyond what the current checker already emits
- pretending RDF/XML or other formats are supported unless a real parser path is implemented and tested

## Implementation Plan

- [ ] Update [[ac.spec.2026.2026-04-03-accord-cli]] to define `.jsonld` as a supported RDF artifact syntax and to extend the deterministic document-loader policy from manifests to RDF artifact loading.
- [ ] Decide whether the JSON-LD artifact loader should share implementation with the manifest loader or merely share policy.
- [ ] Refactor the RDF checker path so file-format parsing produces a common quad representation before canonicalization or ASK execution.
- [ ] Add a JSON-LD ingestion path using `jsonld.js` for `.jsonld` RDF artifacts.
- [ ] Confirm whether term normalization into the current `n3` store/DataFactory is necessary under Deno.
- [ ] Add focused `testdata/` fixtures for `.jsonld` RDF artifacts, including local-context and remote-context cases.
- [ ] Add unit tests for JSON-LD RDF ingestion and error handling.
- [ ] Add black-box scenarios for `.jsonld` `rdfCanonical` and SPARQL ASK behavior.
- [ ] Re-run the full Accord validation suite after the JSON-LD ingestion path is added.
- [ ] Revisit whether RDF/XML support deserves its own follow-up task rather than being bundled into this one.
