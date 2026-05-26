---
id: 07bke3sf49eif1f4vj0f3bs
title: Runner Neutral Test Spec
desc: ''
updated: 1779838487983
created: 1779838235135
---

- make our vocab borrow from https://w3c.github.io/json-ld-api/tests/vocab.html and https://www.w3.org/TR/rdf11-testcases/

```
Manifest
  hasCase
    HttpInteractionCase
      operation / openapiOperationId
      givenState
      request
      expectedResponse
      expectedGraph
      expectedSideEffects
```

then link each case to OpenAPI operationId, validate the manifest with SHACL, and let different runners execute the same cases. That gives you the missing thing: runner-neutral REST conformance manifests with JSON-LD semantics.

Similar to Arazzo, but not just for REST and RDF-native.