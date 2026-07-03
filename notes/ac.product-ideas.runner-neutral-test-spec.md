---
id: 07bke3sf49eif1f4vj0f3bs
title: Runner Neutral Test Spec
desc: ''
updated: 1783100872006
created: 1779838235135
---

## Stagecraft needs / Kim recommendations

Yes. Based on using it for the Plan B rung, my strongest suggestion is: keep Accord small, but make the “fixture ladder” workflow feel first-class.

Top product bets:

1. Native JSON assertions  
   We needed to prove things like “evidence pointers resolve,” “no participant-aim text leaks,” and “recommendedActantIntent appears iff disposition is reviseBeforeUse.” Accord currently handles file presence/RDF ASK well, but JSON checks had to live in Stagecraft C++/SHACL. A simple JSONPath/assertion layer would be huge.

2. Scenario runner  
   Let `scenario-index.jsonld` run all listed steps in order:
   ```sh
   accord check-scenario conformance/scenario-index.jsonld
   ```
   Right now each manifest is manually invoked. The index already has the product shape; the CLI should make it real.

3. Manifest scaffolding from git diff  
   A command like:
   ```sh
   accord draft-manifest --from a.03 --to a.04
   ```
   could emit file expectations for added/updated/removed paths, then let humans add semantic assertions. This would remove a lot of brittle handwork.

4. Better assertion ergonomics  
   RDF ASK is powerful but fussy. I hit parser edges around blank nodes and numeric literals. Accord could either document the supported SPARQL subset clearly or provide higher-level assertion helpers for common patterns like “resource has type,” “resource has page,” “shape targets class.”

5. Negative expectations as a first-class feature  
   Accord should be good at saying “this must not happen.” For Stagecraft, that means no committed events, no state mutations, no authority-produced resources, no leaked private text. Product-wise, “absence proof” is one of Accord’s sharpest differentiators.

6. Evidence report UX  
   The CLI pass/fail summary is useful, but I’d love a richer report mode that groups:
   - branch transition coverage
   - file expectations
   - RDF/JSON assertions
   - unexpected changes
   - links/paths to evidence artifacts

7. Policy/profile packs  
   Example: a `fixture-ladder` profile or `semantic-mesh` profile that brings conventions for manifests, expected inventory/resource-page checks, and common ignore patterns. This keeps Accord general while making blessed workflows easy.

My gentle pushback: I would not turn Accord into a full test framework. Its product identity should be “reproducible transition evidence,” especially across git refs and semantic artifacts. Let app-specific tests stay in app repos, but give Accord enough assertion vocabulary to prove the contract-level facts without custom code every time.

## Testing Vocab

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