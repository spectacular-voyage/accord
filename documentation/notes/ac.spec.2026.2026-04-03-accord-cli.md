---
id: 65fg6dha81rl0dc0oofrv8hn
title: 2026 04 03 Accord CLI Spec
desc: ''
updated: 1775226153524
created: 1775226153524
---

## Purpose

This note defines the behavioral specification for the first Accord CLI checker described in [[ac.task.2026.2026-04-03-accord-cli]].

The task note should remain the planning and execution artifact. This note should carry the normative checker behavior that later black-box functional tests can target directly.

## Scope

The first Accord CLI is a deterministic local checker. It does not perform Semantic Flow operations, mutate fixture repositories, or replace repository-native unit and integration tests.

Its job is to answer one question: does a selected Accord manifest case accurately describe the observable transition between two named refs in a local fixture repository?

## Command Surface

The minimum v1 command surface is:

```bash
accord check <manifest-path>
```

Supported v1 options:

- `--case <case-id>` selects one case explicitly
- `--fixture-repo-path <path>` selects the local fixture repository root explicitly
- `--format json` emits machine-readable output instead of the default text report

No additional top-level command is required for the first usable checker.

## Exit Codes

The checker should use stable exit codes so it can back black-box tests cleanly:

- `0` means the selected case ran successfully and all checks passed
- `1` means the selected case ran successfully and one or more checks failed
- `2` means the checker could not evaluate the case correctly because of usage error, manifest load error, JSON-LD processing error, repository access error, unsupported feature, or another execution error

Overall result precedence is:

1. `error` if any setup step or evaluation check ends in `error`
2. `fail` if there are no errors and at least one evaluation check ends in `fail`
3. `pass` otherwise

## Manifest Handling

### JSON-LD

Manifest inputs are JSON-LD from the start. The checker should not special-case the current files as merely plain JSON with familiar keys.

The v1 loader should:

- parse the manifest as JSON-LD 1.1
- resolve terms and compact IRIs through the document context
- support compacted or expanded JSON-LD as long as it expands to the Accord model
- resolve fragment identifiers and other relative IRIs against the manifest document base IRI

To keep manifest evaluation reproducible, v1 must not fetch arbitrary remote JSON-LD documents. Inline contexts are supported. Remote contexts are supported only through an explicit local document-loader allowlist that maps known IRIs to pinned local content. Any other remote context reference is a manifest-load error.

### Validation Boundary

The ontology and SHACL define the Accord data model and authoring constraints. They are a good starting point and should remain the first place to express reusable manifest semantics.

The CLI still needs execution semantics beyond the ontology and SHACL. Examples include:

- case selection behavior
- fixture repository resolution
- git ref and path lookup behavior
- text normalization rules
- RDF parse-error handling
- report and exit-code behavior

Those rules belong in this spec even if the ontology and SHACL remain unchanged.

### Case Selection

Case selection is resolved as follows:

1. If `--case` is provided, the checker selects the matching case and errors if no such case exists.
2. If `--case` is not provided and the manifest has exactly one case, the checker selects it automatically.
3. If `--case` is not provided and the manifest has more than one case, the checker exits with code `2`.

The checker should accept either the exact case `@id` as authored or the fully resolved IRI of that case.

## Fixture Repository Resolution

The checker operates against one local git repository.

Resolution order:

1. If `--fixture-repo-path` is provided, use it.
2. Otherwise, use the current working directory.

The selected path must be a git repository root or a directory within a git repository that can be resolved to its root.

In v1, `fixtureRepo` is not a repository-discovery mechanism. It is manifest metadata that should be surfaced in reports and may be verified later, but the checker should not depend on remote URL heuristics to find the repository.

## Git Access Model

The checker should read fixture state directly from git objects rather than materializing temporary worktrees.

The v1 access model should use targeted git commands equivalent to:

- `git rev-parse --verify <ref>`
- `git cat-file -e <ref>:<path>`
- `git show <ref>:<path>`

The checker must verify that both `fromRef` and `toRef` resolve before beginning per-file checks.

## Path Rules

`FileExpectation.path` values are repository-relative POSIX-style paths.

The checker should reject path values that are ambiguous or unsafe for deterministic execution, including:

- absolute paths
- empty paths
- paths that normalize outside the repository root

## Evaluation Model

The checker should distinguish three outcomes:

- `pass`: the check was evaluated and succeeded
- `fail`: the check was evaluated and its expected condition was false
- `error`: the check could not be evaluated correctly

The checker should accumulate all evaluable results for the selected case instead of stopping on the first failed expectation.

The checker may stop immediately only for setup failures that make the case uninterpretable, such as:

- unreadable manifest file
- invalid JSON or JSON-LD
- no selectable case
- inaccessible fixture repository
- unresolved `fromRef` or `toRef`

Once setup succeeds, per-expectation errors should be reported as errors while allowing unrelated expectations to continue.

## File Expectation Semantics

### `added`

- the path must not exist at `fromRef`
- the path must exist at `toRef`
- if a `compareMode` is declared, it applies to the `toRef` content for any mode-specific validation

### `updated`

- the path must exist at `fromRef`
- the path must exist at `toRef`
- the contents must differ under the declared `compareMode`

### `unchanged`

- the path must exist at `fromRef`
- the path must exist at `toRef`
- the contents must be equal under the declared `compareMode`

### `removed`

- the path must exist at `fromRef`
- the path must not exist at `toRef`

`removed` is part of the Accord model already and should remain part of the behavioral spec even if the first implementation does not prioritize it.

### `absent`

- the path must not exist at `toRef`

`absent` does not require the path to be absent at `fromRef`. If presence at `fromRef` matters, the manifest should use `removed` instead.

## Compare Modes

### `bytes`

`bytes` compares exact blob bytes.

For `updated`, the byte sequences must differ. For `unchanged`, they must be identical.

### `text`

`text` compares decoded text after line-ending normalization only.

The v1 normalization rule should be:

- normalize `\r\n` to `\n`

The checker should not trim whitespace, collapse internal spacing, normalize HTML, or ignore trailing newlines beyond the explicit CRLF to LF normalization above.

If a file cannot be decoded as UTF-8 text, the result is an evaluation error for that file expectation.

### `rdfCanonical`

`rdfCanonical` compares RDF content after deterministic parsing, predicate filtering for equivalence, and blank-node-insensitive canonical comparison.

The v1 behavior should be:

- parse the `fromRef` and `toRef` blobs as RDF when the change type requires both sides
- parse the `toRef` blob when the change type is `added`
- support the RDF syntaxes actually needed by the current corpus from the start
- fail with an evaluation error when the syntax is unsupported or parsing fails

`ignorePredicate` affects graph-equivalence comparison only. It does not suppress or rewrite the graph seen by explicit SPARQL ASK assertions.

## RDF Expectation Semantics

An `RdfExpectation` is evaluated against the `toRef` version of its targeted file expectation.

Evaluation order:

1. Parse the `toRef` RDF content.
2. If the file expectation change type requires comparison against `fromRef`, parse that content as well.
3. Apply `ignorePredicate` filtering only for graph-equivalence comparison.
4. Run canonical graph comparison when required by the file expectation change type.
5. Run each `SparqlAskAssertion` against the unfiltered `toRef` graph.

Each ASK assertion should be executed exactly as authored. The checker should not inject prefixes, rewrite IRIs, or silently coerce non-ASK queries into ASK behavior.

## Report Semantics

The top-level report status must follow the same precedence as the exit codes:

1. `error` if any check status is `error`
2. `fail` if no check status is `error` and at least one check status is `fail`
3. `pass` otherwise

The default text report should include:

- manifest path
- selected case id
- fixture repository path
- overall case status
- summary counts for `pass`, `fail`, and `error`
- one line per failed or errored check

The default text report is for operators. Black-box tests should treat JSON output as the normative machine-readable contract and use text output only for smoke checks.

The JSON report must carry the same facts in machine-readable form and include stable per-check records suitable for black-box tests.

The minimum JSON shape is:

```json
{
  "manifestPath": "string",
  "caseId": "string",
  "fixtureRepoPath": "string",
  "status": "pass",
  "summary": {
    "pass": 0,
    "fail": 0,
    "error": 0
  },
  "checks": []
}
```

Each per-check record should include at least:

- check kind
- path or assertion identifier where applicable
- stable code
- status
- concise diagnostic message

The minimum check kinds are:

- `setup`
- `file_presence`
- `file_compare`
- `rdf_compare`
- `sparql_ask`

The minimum stable diagnostic codes are:

- `case_selection_required`
- `case_not_found`
- `remote_context_disallowed`
- `fixture_repo_not_found`
- `git_ref_unresolved`
- `file_presence_mismatch`
- `file_content_mismatch`
- `text_decode_error`
- `rdf_graph_mismatch`
- `rdf_parse_error`
- `sparql_ask_mismatch`

Check-counting for black-box tests should use this granularity:

- one `file_presence` check for every `FileExpectation`
- one `file_compare` check for `bytes` or `text` expectations whose change type is `updated` or `unchanged`
- one `rdf_compare` check for `rdfCanonical` expectations whose change type is `updated` or `unchanged`
- one `sparql_ask` check for each `SparqlAskAssertion`
- one `setup` check when evaluation stops before per-expectation checks can begin

An `added` expectation does not create a file-comparison or RDF-comparison check by itself. Its substantive checks are the file-presence check plus any RDF ASK checks attached through an `RdfExpectation`.

## Black-Box Test Targets

The first test suite should be generated from this behavioral surface rather than from implementation internals.

The minimum black-box matrix should cover:

- case auto-selection for one-case manifests
- explicit case selection success and failure
- repository resolution with and without `--fixture-repo-path`
- `added`, `updated`, `unchanged`, `removed`, and `absent`
- `bytes`, `text`, and `rdfCanonical`
- CRLF-versus-LF equivalence under `text`
- RDF comparison with ignored predicates
- RDF ASK success and failure
- manifest JSON-LD expansion success and failure
- parse errors and unsupported-feature errors
- exit-code behavior for pass, fail, and error

### In-Repo Testdata Layout

The minimum TDD corpus should live inside the `accord` repository under a first-class `testdata/` tree. The first implementation should not require a separate `accord-testdata` repository.

The recommended layout is:

```text
testdata/
  repos/
    repo-files/
      repo.json
      refs/
        r0-empty/
        r1-bytes-a/
        r2-bytes-b/
        r3-text-lf/
        r4-text-crlf/
        r5-text-changed/
        r6-text-invalid-utf8/
    repo-rdf/
      repo.json
      refs/
        r0-empty/
        r1-graph-v1/
        r2-graph-v1-reformatted/
        r3-graph-v1-ignored-only/
        r4-graph-v2/
        r5-graph-invalid/
    repo-empty/
      repo.json
      refs/
        r0-empty/
  manifests/
    bb-001-single-case-auto-select-pass.jsonld
    bb-002-explicit-case-pass.jsonld
    ...
  scenarios/
    black-box.json
```

`testdata/repos/` should contain fixture source trees, not committed nested live git repositories.

Each `repo.json` should describe:

- repository fixture id
- ordered list of named refs to materialize
- optional notes needed by the materializer, such as whether a ref is intentionally empty

Each `refs/<ref-name>/` directory should contain the exact repository working tree that should exist at that ref.

The test harness should materialize temporary git repositories from those source trees during test setup by:

1. creating a temporary repository
2. copying the contents of each `refs/<ref-name>/` directory into the worktree in order
3. committing each state
4. tagging or branching each resulting commit with the exact ref name required by the spec

The fixture materializer should be test infrastructure, not production CLI behavior.

`testdata/manifests/` should contain scenario-specific manifests whose filenames match the scenario ids in this spec.

`testdata/scenarios/black-box.json` should act as the machine-readable scenario index for the black-box suite. At minimum, each scenario entry should identify:

- scenario id
- manifest path under `testdata/manifests/`
- repository fixture id under `testdata/repos/`
- expected exit code
- expected top-level status
- any required assertions about summary counts or diagnostic codes

### Reusable Fixture Repositories

The minimum TDD corpus should use small reusable local git repositories rather than one repository per scenario.

`testdata/repos/repo-files/` should provide these named refs:

- `r0-empty`: no tracked files
- `r1-bytes-a`: `artifact.bin` exists with one stable byte sequence
- `r2-bytes-b`: `artifact.bin` exists with a different byte sequence
- `r3-text-lf`: `note.txt` contains `alpha\nbeta\n`
- `r4-text-crlf`: `note.txt` contains `alpha\r\nbeta\r\n`
- `r5-text-changed`: `note.txt` contains `alpha\nBETA\n`
- `r6-text-invalid-utf8`: `note.txt` exists but is not valid UTF-8

`testdata/repos/repo-rdf/` should provide these named refs:

- `r0-empty`: no tracked files
- `r1-graph-v1`: `graph.ttl` contains a small valid baseline graph
- `r2-graph-v1-reformatted`: same RDF graph as `r1-graph-v1` with different ordering and serialization details
- `r3-graph-v1-ignored-only`: same graph as `r1-graph-v1` except for a changed ignored predicate value such as `dcterms:updated`
- `r4-graph-v2`: a meaningfully different RDF graph
- `r5-graph-invalid`: `graph.ttl` is syntactically invalid

`testdata/repos/repo-empty/` should be a minimal valid repository fixture with at least one resolvable ref and no fixture content assumptions beyond that.

### Manifest Fixture Families

The minimum TDD corpus should include manifest fixtures in these families:

- single-case manifests that auto-select cleanly
- multi-case manifests that require `--case`
- manifests with inline JSON-LD context
- manifests with disallowed remote context
- manifests for each file change type
- manifests for each compare mode in scope
- manifests with RDF ASK assertions expecting both `true` and `false`

Manifest fixtures should be intentionally small and behavior-focused. The first TDD layer should not use the large `mesh-alice-bio` manifests as primary red-green fixtures.

### Scenario Catalog

The black-box suite should include at least these concrete scenarios.

#### Setup and Selection

`bb-001-single-case-auto-select-pass`
Manifest: one-case inline-context manifest against `repo-files`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, top-level status `pass`, selected case equals the only case, `summary.error = 0`.

`bb-002-explicit-case-pass`
Manifest: multi-case inline-context manifest against `repo-files`.
Command: `accord check <manifest> --case <known-case-id> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, top-level status `pass`, selected case equals the requested case.

`bb-003-multi-case-selector-required`
Manifest: multi-case inline-context manifest against `repo-files`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `2`, top-level status `error`, `summary.error = 1`, one `setup` check with code `case_selection_required`.

`bb-004-unknown-case-id`
Manifest: multi-case inline-context manifest against `repo-files`.
Command: `accord check <manifest> --case <unknown-case-id> --fixture-repo-path <repo-files> --format json`
Expected: exit `2`, top-level status `error`, `summary.error = 1`, one `setup` check with code `case_not_found`.

`bb-005-remote-context-disallowed`
Manifest: JSON-LD manifest whose `@context` is a non-allowlisted remote URL.
Command: `accord check <manifest> --fixture-repo-path <repo-empty> --format json`
Expected: exit `2`, top-level status `error`, `summary.error = 1`, one `setup` check with code `remote_context_disallowed`.

`bb-006-unresolved-ref`
Manifest: otherwise valid one-case manifest whose `fromRef` or `toRef` does not resolve.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `2`, top-level status `error`, `summary.error = 1`, one `setup` check with code `git_ref_unresolved`.

#### File Expectations and Text or Bytes Comparison

`bb-101-added-bytes-pass`
Manifest: `added` expectation for `artifact.bin` from `r0-empty` to `r1-bytes-a` using `bytes`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 1, "fail": 0, "error": 0 }`, one `file_presence` pass for `artifact.bin`.

`bb-102-updated-bytes-pass`
Manifest: `updated` expectation for `artifact.bin` from `r1-bytes-a` to `r2-bytes-b` using `bytes`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `file_presence` pass and one `file_compare` pass.

`bb-103-unchanged-text-pass-with-crlf-normalization`
Manifest: `unchanged` expectation for `note.txt` from `r3-text-lf` to `r4-text-crlf` using `text`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `file_presence` pass and one `file_compare` pass.

`bb-104-unchanged-text-fail`
Manifest: `unchanged` expectation for `note.txt` from `r3-text-lf` to `r5-text-changed` using `text`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `1`, status `fail`, `summary = { "pass": 1, "fail": 1, "error": 0 }`, one `file_compare` fail with code `file_content_mismatch`.

`bb-105-removed-pass`
Manifest: `removed` expectation for `artifact.bin` from `r1-bytes-a` to `r0-empty`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 1, "fail": 0, "error": 0 }`, one `file_presence` pass.

`bb-106-absent-pass-even-if-previously-present`
Manifest: `absent` expectation for `artifact.bin` from `r1-bytes-a` to `r0-empty`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 1, "fail": 0, "error": 0 }`, one `file_presence` pass.

`bb-107-absent-fail-when-still-present`
Manifest: `absent` expectation for `artifact.bin` from `r1-bytes-a` to `r2-bytes-b`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `1`, status `fail`, `summary = { "pass": 0, "fail": 1, "error": 0 }`, one `file_presence` fail with code `file_presence_mismatch`.

`bb-108-text-invalid-utf8-error`
Manifest: `unchanged` expectation for `note.txt` from `r6-text-invalid-utf8` to `r6-text-invalid-utf8` using `text`.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `2`, status `error`, `summary = { "pass": 1, "fail": 0, "error": 1 }`, one `file_presence` pass and one `file_compare` error with code `text_decode_error`.

#### RDF Comparison and ASK Assertions

`bb-201-unchanged-rdf-pass-equivalent-serialization`
Manifest: `unchanged` expectation for `graph.ttl` from `r1-graph-v1` to `r2-graph-v1-reformatted` using `rdfCanonical` with no ASK assertions.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `file_presence` pass and one `rdf_compare` pass.

`bb-202-unchanged-rdf-pass-ignored-predicate-only`
Manifest: `unchanged` expectation for `graph.ttl` from `r1-graph-v1` to `r3-graph-v1-ignored-only` using `rdfCanonical` with `ignorePredicate` set appropriately.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `rdf_compare` pass.

`bb-203-unchanged-rdf-fail-meaningful-change`
Manifest: `unchanged` expectation for `graph.ttl` from `r1-graph-v1` to `r4-graph-v2` using `rdfCanonical`.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `1`, status `fail`, `summary = { "pass": 1, "fail": 1, "error": 0 }`, one `rdf_compare` fail with code `rdf_graph_mismatch`.

`bb-204-rdf-parse-error`
Manifest: `unchanged` expectation for `graph.ttl` from `r1-graph-v1` to `r5-graph-invalid` using `rdfCanonical`.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `2`, status `error`, `summary = { "pass": 1, "fail": 0, "error": 1 }`, one `rdf_compare` error with code `rdf_parse_error`.

`bb-205-sparql-ask-true-pass`
Manifest: `added` expectation for `graph.ttl` from `r0-empty` to `r1-graph-v1` using `rdfCanonical` with one ASK assertion whose expected boolean is `true`.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `file_presence` pass and one `sparql_ask` pass.

`bb-206-sparql-ask-false-pass`
Manifest: `added` expectation for `graph.ttl` from `r0-empty` to `r1-graph-v1` using `rdfCanonical` with one ASK assertion whose expected boolean is `false`.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `0`, status `pass`, `summary = { "pass": 2, "fail": 0, "error": 0 }`, one `sparql_ask` pass.

`bb-207-sparql-ask-mismatch-fail`
Manifest: `added` expectation for `graph.ttl` from `r0-empty` to `r1-graph-v1` using `rdfCanonical` with one ASK assertion whose expected boolean does not match the query result.
Command: `accord check <manifest> --fixture-repo-path <repo-rdf> --format json`
Expected: exit `1`, status `fail`, `summary = { "pass": 1, "fail": 1, "error": 0 }`, one `sparql_ask` fail with code `sparql_ask_mismatch`.

#### Report Surface

`bb-301-json-report-shape`
Manifest: any passing one-case manifest.
Command: `accord check <manifest> --fixture-repo-path <repo-files> --format json`
Expected: exit `0`, top-level keys `manifestPath`, `caseId`, `fixtureRepoPath`, `status`, `summary`, and `checks` all exist with the types declared above.

`bb-302-text-report-smoke`
Manifest: any failing one-case manifest.
Command: `accord check <manifest> --fixture-repo-path <repo-files>`
Expected: exit `1`, text output contains manifest path, selected case id, fixture repository path, overall case status, summary counts, and at least one failure line.

### TDD Guidance

Black-box generation should follow these rules:

- treat the scenario catalog above as the minimum acceptance surface for v1
- assert exit code and JSON output first
- assert stable `code` values rather than full human-readable messages
- avoid snapshotting the full text report
- generate additional scenarios only when they exercise a behavior not already covered by the catalog above

## Likely Model Pressure

The ontology and SHACL are adequate as a starting point, but implementation may still expose real missing concepts. The most likely pressure points are:

- explicit RDF syntax or media-type declaration if file-extension inference proves too weak
- explicit text-normalization policy if `text` needs more than CRLF normalization
- optional manifest-level execution metadata if document-loader policy or fixture-repository identity needs to become normative

Those should be handled as explicit model changes when they become necessary, not hidden as undocumented CLI behavior.
