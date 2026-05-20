---
id: aj3ipelqez7r7x1rso96ohn
title: 2026 04 03 Accord CI
desc: ''
updated: 1775263181260
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

For `spectacular-voyage/accord`, the practical path is:

1. open the repository on GitHub
2. go to `Settings` -> `Security` -> `Advanced Security`
3. beside `CodeQL analysis`, choose `Set up` -> `Default`
4. keep the auto-detected language set unless there is a concrete reason to narrow it
5. click `Enable CodeQL`
6. review the first scan results and dismiss or fix any obvious false positives before treating alerts as strong policy signals

If this is done on a fork, GitHub Actions may need to be explicitly enabled on that fork first.

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
- prefer the existing Kato-style OIDC upload path over repository-token setup unless there is a concrete reason not to
- do not assume Codecov test-results features are needed
- prefer the ordinary repository onboarding path and only add extra Codecov features if a real need appears

Current practical guidance:

- keep generating `coverage/lcov.info` in CI
- onboard the repository in Codecov
- mirror Kato's GitHub Actions pattern by granting `id-token: write` and using `use_oidc: true`
- upload only `coverage/lcov.info` first; do not add extra Codecov configuration until the baseline report is visible and useful

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
- prefer the existing Kato-style Codecov OIDC integration rather than adding a repository token by default
- defer npm release automation until the package shape is explicit

## Open Questions

- do we want OSV-Scanner findings to block PRs immediately, or report first and gate later?
- when `accord` becomes npm-installable, do we want a pure CLI package, a library package, or a combined package with `bin`

## Next Steps

Finish the GitHub-side setup that is still outside the repository, then turn on the next layer:

1. verify CodeRabbit is installed for `spectacular-voyage/accord`
2. enable branch protection for `main` and require `ci`
3. enable GitHub CodeQL default setup
4. onboard Codecov and verify the Kato-style OIDC upload succeeds for `accord`

That keeps the repo on the low-maintenance path: GitHub-native scanning first, then simple coverage publishing, without prematurely introducing bespoke release or security workflow code.

## To-Do

- [x] add `.github/workflows/ci.yml`
- [x] add `.coderabbit.yaml`
- [x] verify or install the CodeRabbit GitHub app for `spectacular-voyage/accord`
- [ ] enable branch protection for `main` and require the `ci` status
- [x] enable GitHub CodeQL default setup in repository settings
- [x] review the first CodeQL scan results and triage any baseline findings
- [ ] decide when OSV-Scanner becomes worth adding for this repo
- [x] generate `coverage/lcov.info` in CI
- [x] wire a Codecov upload step into `ci.yml`
- [x] onboard `spectacular-voyage/accord` in Codecov
- [x] use the Kato-style Codecov OIDC upload path instead of a repository token
- [ ] decide whether Codecov should stay informational or become a required signal later
