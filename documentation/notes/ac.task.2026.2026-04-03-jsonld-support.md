---
id: 1lk0vc8sqw74hen1v35ud8n
title: 2026 04 03 Jsonld Support
desc: ''
updated: 1775261702598
created: 1775236929174
---

## Goal

Add JSON-LD support for RDF file expectations and SPARQL ASK assertions in `accord check`, while preserving the same deterministic local-only document loading policy already used for Accord manifest loading.

## Summary

Accord already supports JSON-LD manifests. This task is not about manifest loading. It is about supporting `.jsonld` as an RDF artifact format under `rdfCanonical` comparison and RDF-backed `SparqlAskAssertion` execution.

This work is now implemented in this repository.

The landed shape is an ingestion layer in front of the existing quad-based checker flow:

- parse RDF input into RDF/JS quads
- keep the quad store/query backend separate from file format handling
- continue using `n3` and `rdf-canonize` once quads exist
- continue using Comunica against an RDF/JS source or `n3` store once quads exist

For `.jsonld`, the parser path now comes from `jsonld.js`, not from `n3`.

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
- RDF canonical comparison now accepts `.jsonld` alongside the existing `n3`-parsed syntaxes.
- SPARQL ASK execution now accepts `.jsonld` alongside the existing `n3`-parsed syntaxes.
- `.jsonld` RDF artifacts use `jsonld.js` to produce N-Quads, then converge on the same quad-based checker path used by the other RDF syntaxes.
- Local JSON-LD artifact contexts are resolved from the same checked git ref as the artifact under evaluation, not from the working tree.
- The current `semantic-flow-framework/examples/alice-bio/conformance` manifests still target `.ttl` RDF files for `rdfCanonical` expectations, so this work broadens the supported surface beyond the current real corpus rather than unblocking it.

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
- Share the JSON-LD document-loading policy between manifests and RDF artifacts, but keep separate local-document wrappers for filesystem-backed manifests versus git-backed RDF artifacts.
- Preserve the current quad-based backend split:
  - `jsonld.js` for JSON-LD to RDF ingestion
  - `n3` for the current in-memory RDF store and RDF syntax parsing where applicable
  - `rdf-canonize` for canonicalization
  - Comunica for ASK execution
- Reuse the same fail-closed local-only document-loader policy as the manifest loader.
- Use `jsonld.toRDF(...)` plus N-Quads parsing as the normalization boundary, which avoids introducing a separate RDF/JS term adapter for the current Deno stack.
- Keep RDF/XML out of scope for this task and treat it as a separate follow-up if a real parser path is needed later.
- Do not add synthetic provenance triples or default-graph remapping unless the Accord spec later requires them.

## Remaining Follow-Up

- `json` compare mode is still separate work.
- RDF/XML should stay a separate follow-up unless a concrete parser requirement appears.
- SHACL-oriented manifest validation remains a separate command-surface question, not part of this task.

## Contract Changes

No ontology or SHACL changes are required just to support `.jsonld` as an RDF artifact format.

[[ac.spec.2026.2026-04-03-accord-cli]] now defines `.jsonld` as an explicitly supported RDF artifact syntax for:

- `rdfCanonical`
- `SparqlAskAssertion`

The spec now also defines the JSON-LD document-loading policy for RDF artifacts, not just for manifests.

## Testing

The landed additional coverage includes:

- unit tests that convert `.jsonld` RDF content into quads successfully
- unit tests for remote context rejection in RDF artifact loading
- unit tests for local file context support in RDF artifact loading
- black-box `rdfCanonical` pass/fail scenarios for `.jsonld` inputs
- black-box SPARQL ASK pass/fail scenarios for `.jsonld` inputs
- at least one invalid JSON-LD or invalid context scenario that produces a stable error code

The testdata plan landed as a new `repo-rdf-jsonld` fixture family rather than overloading the existing Turtle-only fixtures.

## Non-Goals

- changing Accord manifest vocabulary
- adding synthetic provenance triples to RDF artifact ingestion
- remapping the default graph to a synthetic named graph without a specification reason
- broadening report semantics beyond what the current checker already emits
- pretending RDF/XML or other formats are supported unless a real parser path is implemented and tested

## Implementation Plan

- [x] Update [[ac.spec.2026.2026-04-03-accord-cli]] to define `.jsonld` as a supported RDF artifact syntax and to extend the deterministic document-loader policy from manifests to RDF artifact loading.
- [x] Decide whether the JSON-LD artifact loader should share implementation with the manifest loader or merely share policy.
- [x] Refactor the RDF checker path so file-format parsing produces a common quad representation before canonicalization or ASK execution.
- [x] Add a JSON-LD ingestion path using `jsonld.js` for `.jsonld` RDF artifacts.
- [x] Confirm whether term normalization into the current `n3` store/DataFactory is necessary under Deno.
- [x] Add focused `testdata/` fixtures for `.jsonld` RDF artifacts, including local-context and remote-context cases.
- [x] Add unit tests for JSON-LD RDF ingestion and error handling.
- [x] Add black-box scenarios for `.jsonld` `rdfCanonical` and SPARQL ASK behavior.
- [x] Re-run the full Accord validation suite after the JSON-LD ingestion path is added.
- [x] Revisit whether RDF/XML support deserves its own follow-up task rather than being bundled into this one.

## coderabbit review

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@documentation/notes/ac.spec.2026.2026-04-03-accord-cli.md`:
- [c] Around line 280-289: The code in src/jsonld/documents.ts currently
unconditionally rejects http/https JSON‑LD contexts (the document-loading path
that checks URL schemes); implement an allowlist check so remote contexts are
only rejected when not present in a configurable allowlist: add a configurable
allowlist (env/config option passed into the JSON‑LD loader or a new
JsonLdOptions parameter), change the HTTP/HTTPS rejection logic to consult that
allowlist before throwing, and ensure the loader still enforces the fail‑closed
local-only default; update associated tests and documentation to show the new
allowlist config and its default (empty) behavior.

In `@documentation/notes/ac.user-guide.md`:
- [x] Around line 154-160: The phrasing in the "The JSON-LD document-loading policy
for RDF artifacts..." paragraph incorrectly implies a remote-context allowlist
exists; update that sentence to state the current behavior: remote http/https
JSON-LD contexts are rejected (not allowlistable today), and adjust the matching
"manifest loader" wording to mirror this exact policy; locate the paragraph that
begins "The JSON-LD document-loading policy for RDF artifacts matches the
manifest loader" and the sentence referencing "arbitrary remote contexts are
rejected unless explicitly allowlisted" and replace it with language that
explicitly says remote http/https contexts are hard-rejected and that local
contexts for checked `.jsonld` artifacts are loaded from the same checked ref.

In `@src/checker/compare_rdf.ts`:
- [x] Around line 186-200: The inline JSON-LD document loader function
createInlineJsonLdDocumentLoader is declared async but contains no await; remove
the unnecessary async so the returned loader is a synchronous function (change
"return async (url: string) => { ... }" to "return (url: string) => { ... }"),
keeping the existing RdfCompareError throws and
CHECK_CODES.REMOTE_CONTEXT_DISALLOWED / CHECK_CODES.RDF_PARSE_ERROR usage
unchanged.

In `@src/cli/commands/check.ts`:
- [x] Around line 543-551: The catch currently only maps GitAccessError to
RdfCompareError, letting other errors (including RdfCompareError rethrown from
decodeGitJsonLdDocument or unexpected failures from
readGitBlob/command.output()) escape; update the catch around the read/decode
calls so any non-RdfCompareError is wrapped as a new RdfCompareError with
CHECK_CODES.RDF_PARSE_ERROR and a message like "Failed to read JSON-LD artifact
document at ${documentPath} from ${ref}: ${error.message}", while rethrowing
existing RdfCompareError unchanged; specifically handle errors coming from
readGitBlob and decodeGitJsonLdDocument by checking error instanceof
RdfCompareError before wrapping and include the original error details in the
new RdfCompareError to preserve context.

In `@src/manifest/load_jsonld.ts`:
- [x] Around line 43-56: The call to Deno.readTextFile(manifestPath) can throw a raw
filesystem error and must be normalized to a ManifestLoadError like parse/expand
failures; wrap the read in a try/catch around the Deno.readTextFile call in
load_jsonld so that any thrown error is passed into createManifestLoadError
(using CHECK_CODES.MANIFEST_LOAD_ERROR and the
manifestPath/documentContext.documentUrl context) and rethrown, ensuring
subsequent parseJsonSource still receives a normalized error path; keep
createFileJsonLdDocumentContext, createManifestLoadError,
CHECK_CODES.MANIFEST_LOAD_ERROR, manifestPath and documentContext.documentUrl as
the referenced symbols to locate the change.

---

Nitpick comments:
In `@src/checker/sparql.ts`:
- [x] Around line 29-35: The parseRdfContent call and new Store(...) are currently
executed outside the try/catch and can throw raw errors; wrap the
parseRdfContent invocation and Store construction inside the same try block that
handles the SPARQL query processing so all parse and query failures are caught
and converted to RdfCompareError. Specifically, move or include the
parseRdfContent(...) call and the Store(...) creation into the existing try that
handles the subsequent query logic (the block around the SPARQL handling), and
ensure any thrown error is caught and rethrown or normalized as an
RdfCompareError before being returned.

In `@src/jsonld/documents.ts`:
- [x] Around line 88-106: The function assertContextReferencesAllowed currently
ignores object contexts; update it to detect and validate embedded `@import`
directives and nested `@context` objects within object contexts. Inside
assertContextReferencesAllowed, when context is a non-null object, check for an
"@import" property (if present, call assertContextReferenceAllowed on its value
or each entry if it's an array) and check for a "@context" property (recursively
call assertContextReferencesAllowed on that value). Also recursively walk object
property values that may themselves be arrays/objects to ensure any nested
context references are validated using assertContextReferenceAllowed and the
provided errorFactory.

In `@testdata/repos/repo-rdf-jsonld/refs/r0-empty/.accord-empty-ref`:
- [c] Line 1: The `.accord-empty-ref` marker file is fine as-is; keep the single
blank line to ensure the r0-empty reference fixture is tracked, or optionally
add a one-line comment at the top of the `.accord-empty-ref` file explaining its
purpose (e.g., "marker for r0-empty test fixture") to aid future maintainers
while preserving the file name `.accord-empty-ref`.

In `@tests/compare_rdf_test.ts`:
- [x] Around line 121-140: The test should check the error.code as well as the
message: replace the current assertRejects usage with an explicit try/catch (or
await the promise and catch the thrown error) when calling compareRdfContent,
assert the caught error is an instance of RdfCompareError, assert the
error.message contains "Remote JSON-LD context is not allowlisted" (or keep the
existing message check), and assert error.code ===
CHECK_CODES.REMOTE_CONTEXT_DISALLOWED; refer to compareRdfContent,
RdfCompareError, and CHECK_CODES.REMOTE_CONTEXT_DISALLOWED to locate the
relevant symbols.

## coderabbit round 2

Verify each finding against the current code and only fix it if needed.

Inline comments:
In `@src/jsonld/documents.ts`:
- [x] Around line 161-184: The current try-catch around both Deno.readTextFile and
loadJsonDocumentFromText in loadJsonDocumentFromFileUrl causes JSON parse errors
(from parseJsonSource via loadJsonDocumentFromText) to be re-wrapped as "Failed
to read" errors; change the structure so only the file read is caught: call
Deno.readTextFile inside a small try-catch that throws the loadErrorCode-wrapped
error on read failure, then call loadJsonDocumentFromText outside that catch so
any parse errors propagate unchanged (or are handled by their own errorFactory)
— refer to loadJsonDocumentFromFileUrl, Deno.readTextFile, and
loadJsonDocumentFromText to locate the code to modify. This is worth doing because parse failures are currently mislabeled as read failures.

In `@tests/jsonld_documents_test.ts`:
- [x] Around line 1-6: Remove the unused import JsonLdErrorFactory from the import
statement in tests/jsonld_documents_test.ts; update the import that currently
reads "import { assertContextReferencesAllowed, JsonLdErrorFactory } from
'../src/jsonld/documents.ts'" to only import the used symbol(s) (e.g.,
assertContextReferencesAllowed) so the test no longer imports the unused
JsonLdErrorFactory. This is a safe cleanup and should be done with the behavior change.

---

Outside diff comments:
In `@documentation/notes/ac.user-guide.md`:
- [x] Around line 37-44: Update the manifest context policy wording so it matches
the artifact section: replace the phrase "rejected unless explicitly allowlisted
in the implementation" with the consistent statement that remote contexts
(http/https) are "rejected today" and remove any mention of an allowlist; ensure
both the "manifest input" paragraph (the block describing inline/local/remote
contexts) and the "artifact" section use identical wording about remote contexts
being rejected to accurately reflect the current implementation. This is a real documentation mismatch and should be fixed.

---

Nitpick comments:
In `@tests/compare_rdf_test.ts`:
- [c] Around line 121-153: Replace the manual try/catch in the test with
assertRejects to simplify and match other tests: call assertRejects(() =>
compareRdfContent({...})) and in the rejection handler assert that the thrown
value is an instance of RdfCompareError, that error.code ===
CHECK_CODES.REMOTE_CONTEXT_DISALLOWED, and that error.message includes "Remote
JSON-LD context is not allowlisted"; keep using createTestJsonLdDocumentContext
for leftDocumentContext/rightDocumentContext and preserve the same inputs to
compareRdfContent. This is mostly stylistic churn; the current test already checks the type, code, and message clearly enough.
