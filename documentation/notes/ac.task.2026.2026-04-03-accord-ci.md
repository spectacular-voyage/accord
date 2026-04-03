---
id: aj3ipelqez7r7x1rso96ohn
title: 2026 04 03 Accord CI
desc: ''
updated: 1775231228587
created: 1775231228587
---

## Goal

Establish a pragmatic CI and PR workflow for `accord` that supports branch-based development now, without overcommitting to release automation before the CLI and packaging story are ready.

## Desired End State

- all changes land through pull requests rather than direct pushes to the default branch
- pull requests receive automatic CI results and CodeRabbit review
- the repository has baseline code scanning and dependency vulnerability scanning
- coverage results are published in a Kato-style Codecov flow once coverage output is stable enough to be useful
- release documentation eventually covers publishing an installable `@spectacular-voyage/accord` npm package, but only after packaging decisions are settled

## Recommended Rollout Order

### Phase 1: PR Baseline

This is the minimum needed to start branch-based development sanely.

- add `.github/workflows/ci.yml`
- run `deno task fmt:check`, `deno task lint`, `deno task check`, and `deno task test`
- generate coverage artifacts in CI even before uploading them anywhere
- install the CodeRabbit GitHub app for the repository or organization
- add a minimal root `.coderabbit.yaml` so repository-local review exclusions are explicit
- enable branch protection for the default branch

Branch protection should require at least:

- pull requests before merge
- passing `ci` status
- no direct pushes by default

CodeRabbit should begin as advisory review, not as the only merge gate. We can require a human review and treat CodeRabbit as an additional reviewer signal.

### Phase 2: Code Scanning

Add GitHub CodeQL after the PR baseline is stable.

Current recommendation: start with GitHub CodeQL default setup rather than a custom workflow unless `accord` soon needs query customization or nonstandard build steps. This repository is currently simple enough that default setup should be lower-maintenance and less brittle.

If we later need repo-as-code control, we can replace default setup with `.github/workflows/codeql.yml`.

### Phase 3: Dependency Vulnerability Scanning

Add OSV-Scanner after the core CI workflow is in place.

The likely shape is:

- a PR workflow that flags newly introduced vulnerabilities
- a scheduled workflow that uploads SARIF results to GitHub code scanning

This is more valuable once the repository has a clearer package and lockfile story. Today `accord` is mostly a Deno CLI repo, so OSV signal may be limited until npm packaging and additional dependencies arrive.

### Phase 4: Coverage Publishing

Add Codecov after coverage output is stable and worth tracking.

The initial `ci.yml` should still generate coverage files so the later Codecov step becomes mechanical rather than architectural.

Preferred sequence:

- produce LCOV from Deno tests
- confirm path stability and report usefulness locally and in CI artifacts
- then add Codecov upload using the simplest supported repository setup first

Default assumption for Accord:

- use the standard Codecov upload action
- do not assume OIDC is required
- do not assume Codecov test-results features are needed
- prefer the ordinary repository onboarding path and only add extra auth or product features if a real need appears

Codecov should not be the first CI feature added. Failing PR validation and code scanning are more important than a coverage dashboard during early bring-up.

### Phase 5: Release Manual and npm Distribution

Do this last.

`npm install @spectacular-voyage/accord` is not just a documentation task. It implies a real packaging decision:

- what the npm artifact contains
- whether it is a library, a CLI, or both
- how the Deno-first codebase is built for Node/npm consumption
- what executable entrypoint and platform assumptions the package will expose

Until those decisions are made, a "Release Manual" should stay provisional.

## Concrete Implementation Inventory

### Repository Files

- `.github/workflows/ci.yml`
- optionally `.github/workflows/osv-scanner-pr.yml`
- optionally `.github/workflows/osv-scanner-scheduled.yml`
- `.coderabbit.yaml`
- later `.github/workflows/release.yml` or release documentation updates once packaging exists

The initial `.coderabbit.yaml` should at least exclude generated or archival note classes that do not benefit from review:

```yaml
reviews:
  path_filters:
    - "!documentation/notes/ac.conv.*"
    - "!documentation/notes/ac.completed.*"
  auto_review:
    enabled: true
```

### GitHub Repository Settings

- branch protection on the default branch
- CodeRabbit GitHub app installation
- CodeQL enablement, preferably default setup first
- Codecov repository onboarding if we decide to use Codecov

## Decisions

- prioritize PR-based development and review quality over release automation
- use CodeRabbit for PR review, but do not let it replace ordinary branch protection and human review expectations
- commit a minimal `.coderabbit.yaml` so `ac.conv.*` and `ac.completed.*` notes are excluded from review noise
- prefer GitHub CodeQL default setup first; only move to workflow-based advanced setup if a real need appears
- prefer the simplest Codecov integration path first rather than assuming OIDC or test-results features
- defer npm release automation until the package shape is explicit

## Open Questions

- if Codecov is enabled, does the repository/account setup require a token, or is the standard unified upload flow sufficient as-is?
- do we want OSV-Scanner findings to block PRs immediately, or report first and gate later?
- when `accord` becomes npm-installable, do we want a pure CLI package, a library package, or a combined package with `bin`

## Next Step

Implement Phase 1 first:

1. add `ci.yml`
2. install CodeRabbit
3. enable branch protection

That is enough to start working via short-lived branches and PRs without waiting for the rest of the security and release stack.
