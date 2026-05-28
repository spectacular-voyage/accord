---
id: how-do-i-specify-a-test-86e9ba88
title: 'how do I specify a test suite for an API. I''d like to use j…'
desc: ''
created: 1779851879930
updated: 1779851879930
participants: [codex.gpt-5.5]
kato-sessionIds: [019e6697-679d-7083-a2d4-ff7627c0cccc]
kato-workspaceIds: [d768c729-a2c0-4099-817f-16fd384768e4]
kato-recordingIds: [86e9ba88-cc85-46b0-8dc3-da26b7c5a38b]
---

# User_2026-05-26_1621_02

how do I specify a test suite for an API. I'd like to use jsonld. accord is the diy answer.

# gpt-5.5_2026-05-26_1621_14

I’ll ground this in the repo’s own guidance first, then I’ll answer at the design/spec level. The shape of this sounds like “portable conformance tests as data,” so I want to avoid accidentally steering you into an OpenAPI-only corner.

The local guidance already points at `sf.spec.*` notes as the durable behavior layer and mentions “Accord manifests or similar acceptance checks,” which is a useful clue: I’d treat JSON-LD as the portable manifest format, not as the execution engine itself.

# User_2026-05-26_1621_28

a web api, like REST

# gpt-5.5_2026-05-26_1621_42

The REST clarification changes the center of gravity: I’d keep OpenAPI in its lane if you need endpoint documentation, and use a JSON-LD conformance manifest for executable behavior examples. Accord can be the runner vocabulary/engine if you’re willing to define the missing HTTP bits yourself.

For a REST-ish web API, I’d specify the suite as a **JSON-LD conformance manifest**, with Accord as the local acceptance harness idea, but I would not try to make Accord itself pretend REST is just files.

The clean split:

1. **OpenAPI** describes the API surface: paths, methods, schemas, auth, examples.
2. **JSON-LD/Accord manifest** describes executable conformance behavior: given state X, make request Y, expect response Z, and verify semantic side effects.
3. **Runner** executes the manifest: starts server, seeds state, sends HTTP requests, expands JSON-LD, checks RDF/SHACL/SPARQL/JSON/header/status expectations.

For Weave/Semantic Flow, I’d model it like this:

```json
{
  "@context": {
    "@vocab": "https://semantic-flow.github.io/api-test/ontology/",
    "accord": "https://spectacular-voyage.github.io/accord/ontology/",
    "dcterms": "http://purl.org/dc/terms/",
    "id": "@id",
    "type": "@type",
    "operation": { "@type": "@id" },
    "expectsType": { "@type": "@id" }
  },
  "id": "urn:sflo:conformance:api:v1",
  "type": "ApiTestManifest",
  "dcterms:title": "Semantic Flow REST API conformance suite",
  "baseUrl": "http://localhost:8787",
  "hasCase": [
    {
      "id": "#create-mesh-root",
      "type": "HttpInteractionCase",
      "operation": "sflo-api:createMesh",
      "givenState": {
        "type": "WorkspaceFixture",
        "fixtureRef": "blank-workspace"
      },
      "request": {
        "method": "POST",
        "path": "/meshes",
        "headers": {
          "content-type": "application/ld+json"
        },
        "body": {
          "@context": "/contexts/semantic-flow.jsonld",
          "type": "MeshCreateRequest",
          "name": "alice-bio"
        }
      },
      "expectResponse": {
        "status": 201,
        "headers": {
          "content-type": "application/ld+json"
        },
        "expectsType": "sflo:SemanticMesh",
        "jsonldAsk": "ASK { ?mesh a <https://semantic-flow.github.io/sflo/ontology/SemanticMesh> . }"
      },
      "expectFollowup": [
        {
          "method": "GET",
          "pathFromResponse": "$.id",
          "expectStatus": 200,
          "expectsType": "sflo:SemanticMesh"
        }
      ]
    }
  ]
}
```

The important ontology concepts I’d add on top of Accord are:

- `ApiTestManifest`
- `HttpInteractionCase`
- `Request`
- `ResponseExpectation`
- `FollowupRequest`
- `givenState`
- `expectedState`
- `status`
- `headers`
- `body`
- `jsonldAsk`
- `shaclShape`
- `operation`, probably pointing to an OpenAPI `operationId` or stable Semantic Flow operation IRI

The pushback: JSON-LD is great for **semantic assertions**, but awkward for low-level HTTP mechanics. Don’t force everything into RDF. Status codes, headers, auth, retries, and request ordering should be ordinary manifest fields with JSON-LD meaning. Then use RDF/SHACL/SPARQL where it actually shines: proving that the API response means the right thing.

Accord fits as the DIY answer if you treat this as a sibling/extension to current Accord, not just a reuse of current file-transition manifests. Current Accord is already positioned as the acceptance-spec layer in [wd.testing.md](../../../../../documentation/notes/wd.testing.md:75), but REST needs an `accord-http` vocabulary plus a runner.

# User_2026-05-26_1622_37

Is there a runner-neutral manifest specification?

# gpt-5.5_2026-05-26_1623_20

Short answer: **not really for generic REST APIs**.

The closest real precedent is the **W3C RDF/SPARQL/JSON-LD test manifest pattern**: RDF manifests using `mf:Manifest`, `mf:action`, `mf:result`, plus domain-specific test classes. W3C RDF 1.1 says its suites use a common test manifest representation, Turtle for most suites and JSON-LD for JSON-LD manifests. The JSON-LD test suite also extends that vocabulary with JSON-LD-specific terms, including limited HTTP-ish options like accept headers and HTTP status. Sources: [RDF 1.1 Test Cases](https://www.w3.org/TR/rdf11-testcases/) and [JSON-LD test vocab](https://w3c.github.io/json-ld-api/tests/vocab.html).

But that is **not** a general REST API conformance manifest. It is a reusable pattern for spec conformance tests.

So I’d classify the field like this:

- **OpenAPI**: runner-neutral API contract, not a test-suite manifest.
- **W3C `mf:` manifests**: runner-neutral semantic test manifest pattern, but RDF/JSON-LD/SPARQL oriented.
- **Web Platform Tests**: large runner ecosystem with manifests/metadata, but not a JSON-LD REST conformance format.
- **Postman, Karate, Tavern, Pact, Dredd, Schemathesis**: useful, but either runner-shaped, contract-specific, or not semantic/JSON-LD-first.
- **Accord**: your DIY answer is actually reasonable: a small RDF/JSON-LD manifest vocabulary plus checker semantics.

My recommendation: make an `accord-http` or `sfapi-test` vocabulary that borrows the W3C manifest idea:

```text
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

Then link each case to OpenAPI `operationId`, validate the manifest with SHACL, and let different runners execute the same cases. That gives you the missing thing: **runner-neutral REST conformance manifests with JSON-LD semantics**.

# User_2026-05-26_1630_28

I'm pretty sure from previous research I read about something that was runner-neutral, obviously not RDF-oriented

# gpt-5.5_2026-05-26_1630_35

That rings a bell. I’m going to check the current API-spec landscape rather than trust memory here, because there are a few nearby names and one of them may be exactly the thing you saw.

Yep, I think the thing you’re remembering is probably **Arazzo**.

It’s an OpenAPI Initiative spec for **runner-neutral API workflows**: sequences of API calls, dependencies between steps, inputs/outputs, and success/failure criteria. The current latest spec I found is **Arazzo v1.1.0**, dated **May 17, 2026**. Official spec: https://spec.openapis.org/arazzo/latest.html

Why it matches your memory:

- Non-RDF, JSON/YAML-oriented.
- Built to sit next to OpenAPI.
- Describes workflows rather than one endpoint at a time.
- Has `sourceDescriptions`, `workflows`, `steps`, `operationId` / `operationPath`, `successCriteria`, runtime expressions, and outputs.
- Runner-neutral in the same way OpenAPI is: tools can execute it, document it, lint it, generate from it, etc.

So I’d revise my earlier framing:

**Use Arazzo as the base manifest spec.**  
Use Accord or a Semantic Flow extension only for the semantic assertions that Arazzo does not naturally cover.

A rough shape:

```yaml
arazzo: 1.1.0
info:
  title: Semantic Flow API conformance workflows
  version: 0.1.0

sourceDescriptions:
  - name: weaveApi
    url: ./openapi.yaml
    type: openapi

workflows:
  - workflowId: createMesh
    steps:
      - stepId: createMesh
        operationId: $sourceDescriptions.weaveApi.createMesh
        requestBody:
          contentType: application/ld+json
          payload:
            "@context": ./contexts/sflo.jsonld
            type: MeshCreateRequest
            name: alice-bio
        successCriteria:
          - condition: $statusCode == 201
          - context: $response.body
            condition: "$.type == 'SemanticMesh'"
            type: jsonpath
        outputs:
          meshId: $response.body#/id
        x-sflo:
          jsonldAsk: >
            ASK { ?mesh a <https://semantic-flow.github.io/sflo/ontology/SemanticMesh> . }
```

One caution: I would **not** make vanilla Arazzo itself JSON-LD by adding top-level `@context`; Arazzo extensions are `x-*`. So the sane path is `x-sflo` / `x-jsonld` extensions, or an Arazzo document paired with a JSON-LD/Accord semantic assertion manifest.

So: **Arazzo for runner-neutral REST workflow description; Accord/Semantic Flow vocabulary for RDF/JSON-LD conformance semantics.**
