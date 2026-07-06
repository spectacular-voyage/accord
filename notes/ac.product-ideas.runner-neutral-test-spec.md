---
id: 07bke3sf49eif1f4vj0f3bs
title: Runner Neutral Test Spec
desc: ''
updated: 1783100872006
created: 1779838235135
---

## Task Ownership (2026-07-04)

These ideas are now tracked by owned task notes; this note stays as the product-thinking source.

- Native JSON assertions (bet 1) and JSON-side negative expectations (bet 5) → [[ac.completed.2026.2026-07-04-json-assertions]]
- Scenario runner (bet 2) and per-step evidence grouping (bet 6, temporal addition 1) → [[ac.completed.2026.2026-07-04-scenario-runner]]
- Manifest scaffolding from git diff (bet 3, temporal addition 2) → [[ac.completed.2026.2026-07-04-draft-manifest]]
- Assertion ergonomics and RDF absence proofs (bet 4, bet 5's RDF half, temporal addition 3) → [[ac.completed.2026.2026-07-04-real-sparql-ask]]; a higher-level `notExists`/`mustNotHaveTriple` vocabulary stays an idea here until `FILTER NOT EXISTS` proves insufficient
- Authoring validation before slow transition checks (temporal addition 6) → [[ac.completed.2026.2026-04-03-shacl-validation]]
- Profile packs (bet 7), immutability assertions (temporal addition 4), and drift checks (temporal addition 5) → not yet task-owned; drift checks are recorded as a likely second slice in [[ac.completed.2026.2026-07-04-scenario-runner]], and `--include-unchanged` in [[ac.completed.2026.2026-07-04-draft-manifest]] is the first step toward immutability ergonomics
- Testing Vocab (below) → deliberately not task-owned; it is a larger runner-neutral REST/HTTP conformance direction, out of scope for the current Stagecraft-driven round

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

## Stagecraft Temporal Rung Additions

The temporal-vocabulary rung sharpened a few of those product bets:

1. Scenario runner output should be per-step, not only whole-index pass/fail. Stagecraft wants to run `scenario-index.jsonld`, see each rung pair, and keep path expectations paired with semantic `hasAskAssertion` checks. The runner should preserve that evidence grouping in text and JSON reports.

2. Manifest drafting from git diff should be conservative but useful. A draft command could create `added`, `updated`, `removed`, and `unchanged` file expectations from `git diff --name-status`, infer likely compare modes for `.ttl`, `.jsonld`, and text files, then leave assertion details for humans.

3. Negative RDF expectations need a friendly shape. In the temporal rung, unsupported `FILTER NOT EXISTS` had to become a separate ASK assertion with `expectedBoolean: false`. That is acceptable as a low-level escape hatch, but the product-level feature should be an explicit absence assertion such as `mustNotHaveTriple` or `notExists`.

4. Fixture-ladder profiles should include immutability assertions. Stagecraft's new convention requires old `_history*/_s*/...` payload-state files to remain byte-identical across a rung while allowing new state paths, inventory progression, and generated pages. This is a contract-level check, not an application unit test.

5. Drift checks should be first-class evidence. After merge, a fixture rung often needs to prove that the final ref differs from the expected branch only under the allowed conformance paths, or else report the unexpected drift clearly.

6. Authoring validation should happen before slow transition checks. Runner-neutral manifests need early feedback for dangling expectation references, malformed assertion syntax, duplicate identifiers, and query features outside Accord's supported ASK subset.

The critical boundary is still the same: Accord should prove transition contracts and authoring validity, not become the place where Stagecraft implements domain behavior.

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
