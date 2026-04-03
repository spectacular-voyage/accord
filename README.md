# Accord

Accord is a machine-readable conformance framework for defining expected system behavior as manifests, validating those manifests with shared semantics and constraints, and enabling reusable execution across tools. It bridges prose intent, formal specification, and executable acceptance checks.

## Why Accord exists

Accord is meant to be the thin acceptance-spec layer between prose requirements and test runners.

It is not an attempt to replace TDD, OpenAPI, or ordinary implementation tests. Instead, it gives teams a reusable way to say:

- what operation is under test
- which fixture repository the named refs come from
- which starting and ending fixtures or refs define the expected transition
- which designator path or analogous semantic target the operation addresses
- which files should be added, updated, left unchanged, removed, or absent
- how outputs should be compared
- which RDF predicates are volatile and should be excluded from strict equivalence
- which explicit graph assertions must hold

That makes acceptance criteria machine-readable without turning them into a large prose-heavy "spec-first" process.

## Current scope

This initial repository is intentionally small:

- `accord-ontology.ttl` defines the core vocabulary
- `accord-shacl.ttl` defines authoring and validation constraints
- future JSON-LD manifests can use the ontology terms directly
- future runners or executors can consume the same manifests without owning the semantics

The goal is to start with a semantic kernel, not a framework tower.

## What Accord is not

Accord is not:

- a replacement for OpenAPI or transport-layer contracts
- a replacement for TDD or unit tests
- a full workflow-orchestration language
- tied to any one runner such as Karate, Playwright, Vitest, or a custom harness

Accord should remain runner-neutral. A test runner can execute an Accord manifest, but the manifest should not be shaped around a specific test framework.

## Core model

The current ontology starts with a deliberately small set of concepts:

- `accord:Manifest`
- `accord:TransitionCase`
- `accord:FileExpectation`
- `accord:RdfExpectation`
- `accord:SparqlAskAssertion`
- `accord:fixtureRepo`
- `accord:targetDesignatorPath`
- `accord:targetsFileExpectation`
- controlled values for file change types and compare modes

Case identity should normally be carried by the case node `@id` rather than a separate `scenarioId` property.

The current model is centered on transition cases because many conformance problems are easiest to express as:

- begin from a named fixture or branch
- perform or simulate one operation
- compare the resulting state against expected outcomes

That works especially well for systems that combine filesystem layout with RDF content. Each RDF expectation now targets exactly one file expectation so per-file RDF assertions, ignore lists, and canonical comparison rules remain unambiguous.

For deterministic execution, file expectations that describe present files should also declare how those files are compared. In the current model:

- `added`, `updated`, and `unchanged` file expectations should declare `compareMode`
- `removed` and `absent` should not

## Validation strategy

Accord separates semantics from authoring constraints:

- the ontology says what the terms mean
- SHACL says what a well-formed manifest must contain

This keeps the model RDF-native without forcing authors to maintain both a JSON Schema and an RDF model by hand.

## JSON-LD authoring direction

Accord is intended to support a JSON-LD authoring style so manifests can remain grounded in a reusable RDF vocabulary without losing readability for humans.

Titles and descriptions may be authored either as simple plain strings or as language-tagged values when multilingual metadata is needed.

An authoring profile can look like this:

```json
{
  "@context": {
    "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
    "dcterms": "http://purl.org/dc/terms/",
    "id": "@id",
    "type": "@type",
    "targetsFileExpectation": {
      "@type": "@id"
    },
    "ignorePredicate": {
      "@type": "@id"
    }
  },
  "type": "Manifest",
  "id": "urn:accord:example:alice-knop-create",
  "dcterms:title": "Alice knop create",
  "hasCase": [
    {
      "type": "TransitionCase",
      "id": "#alice-knop-create",
      "dcterms:title": "Create Alice knop",
      "dcterms:description": "Checks that knop.create transforms the woven mesh fixture into the expected Alice knop state.",
      "fixtureRepo": "github.com/semantic-flow/mesh-alice-bio",
      "operationId": "knop.create",
      "fromRef": "03-mesh-created-woven",
      "toRef": "04-alice-knop-created",
      "targetDesignatorPath": "alice",
      "hasFileExpectation": [
        {
          "id": "#alice-knop-meta",
          "type": "FileExpectation",
          "path": "alice/_knop/_meta/meta.ttl",
          "changeType": "added",
          "compareMode": "rdfCanonical"
        }
      ],
      "hasRdfExpectation": [
        {
          "type": "RdfExpectation",
          "targetsFileExpectation": "#alice-knop-meta",
          "ignorePredicate": [
            "dcterms:created",
            "dcterms:updated"
          ],
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?s a <https://semantic-flow.github.io/semantic-flow-ontology/Knop> . }",
              "expectedBoolean": true
            }
          ]
        }
      ]
    }
  ]
}
```

## Design principles

- Keep manifests small and executable.
- Prefer explicit acceptance data over long prose instructions for agents.
- Keep the semantic layer reusable across tools.
- Treat manifests as black-box acceptance criteria, not implementation scripts.
- Expand the vocabulary only when repeated real examples need new concepts.

## Near-term direction

The next useful steps for Accord are likely:

- a published JSON-LD context
- one or two example manifests
- keep the current `accord check` validator small, deterministic, and well-documented
- if SHACL-oriented manifest validation lands, expose it as a separate command surface rather than an implicit preflight inside `accord check`
- a small round-trip example that maps cleanly to fixture repo, branch/ref, target path, and per-file RDF assertions
- later, optional runner adapters for specific ecosystems
