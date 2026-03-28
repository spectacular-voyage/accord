# Accord

Accord is a machine-readable conformance framework for defining expected system behavior as manifests, validating those manifests with shared semantics and constraints, and enabling reusable execution across tools. It bridges prose intent, formal specification, and executable acceptance checks.

## Why Accord exists

Accord is meant to be the thin acceptance-spec layer between prose requirements and test runners.

It is not an attempt to replace TDD, OpenAPI, or ordinary implementation tests. Instead, it gives teams a reusable way to say:

- what operation is under test
- which starting and ending fixtures or refs define the expected transition
- which files should be added, updated, removed, or absent
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
- controlled values for file change types and compare modes

The current model is centered on transition cases because many conformance problems are easiest to express as:

- begin from a named fixture or branch
- perform or simulate one operation
- compare the resulting state against expected outcomes

That works especially well for systems that combine filesystem layout with RDF content.

## Validation strategy

Accord separates semantics from authoring constraints:

- the ontology says what the terms mean
- SHACL says what a well-formed manifest must contain

This keeps the model RDF-native without forcing authors to maintain both a JSON Schema and an RDF model by hand.

## JSON-LD authoring direction

Accord is intended to support a compact JSON-LD authoring style so manifests can still feel JSON-like while remaining grounded in a reusable RDF vocabulary.

A future compact authoring profile could look like this:

```json
{
  "@context": {
    "@vocab": "https://spectacular-voyage.github.io/accord/ns#",
    "dcterms": "http://purl.org/dc/terms/",
    "id": "@id",
    "type": "@type",
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
      "operationId": "knop.create",
      "fromRef": "03-mesh-created-woven",
      "toRef": "04-alice-knop-created",
      "hasFileExpectation": [
        {
          "type": "FileExpectation",
          "path": "alice/_knop/_meta/meta.ttl",
          "changeType": "added",
          "compareMode": "rdfCanonical"
        }
      ],
      "hasRdfExpectation": [
        {
          "type": "RdfExpectation",
          "compareMode": "rdfCanonical",
          "ignorePredicate": [
            "dcterms:created",
            "dcterms:updated"
          ],
          "hasAskAssertion": [
            {
              "type": "SparqlAskAssertion",
              "query": "ASK { ?s a <https://semantic-flow.org/ns/core/Knop> . }",
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

- a compact published JSON-LD context
- one or two example manifests
- a tiny reference validator that loads a manifest, applies SHACL, and reports failures clearly
- later, optional runner adapters for specific ecosystems
