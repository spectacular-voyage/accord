---
id: 3s21nns0qoo1kli8h0gdun6
title: Release Runbook
desc: ''
updated: 1779518530382
created: 1778970204425
---

## Purpose

This runbook is for maintainers publishing Accord releases. The current release lane is intentionally small: publish the Deno-first library and CLI entrypoint to JSR, then create a GitHub source release from the matching Dendron release note. Native binary archives and npmjs wrapper packages are future lanes, not part of the current release flow.

For release model rationale, see [[ac.task.2026.2026-05-13-ci-cd]]. For user-facing install and import examples, see [[ac.user-guide]].

## Current Release Shape

The current release workflow publishes:

- JSR package `@spectacular-voyage/accord`
- JSR default library entrypoint from `src/mod.ts`
- JSR CLI entrypoint from `src/main.ts` as `jsr:@spectacular-voyage/accord/cli`
- Git tag `vX.Y.Z`
- GitHub Release `vX.Y.Z` using `notes/release-notes.vX.Y.Z.md`

The current release workflow does not publish:

- native binaries
- npmjs packages
- installer scripts
- signed or notarized artifacts

## Prerequisites

- You have maintainer access to `spectacular-voyage/accord`.
- The JSR scope/package is configured for GitHub Actions OIDC publishing.
- The release commit is on `main`, or the release branch is ready to merge to `main`.
- GitHub Actions CI is green on the release commit.
- `deno.json` has the intended package version.
- `notes/release-notes.vX.Y.Z.md` exists and is non-empty for the same version.
- The release note is written for users, not as an internal task log.

## Prepare The Release

1. Start from a clean worktree on the release branch.

```bash
git status --short
```

2. Confirm the intended version.

```bash
deno eval 'const config = JSON.parse(await Deno.readTextFile("deno.json")); console.log(config.version);'
```

3. Bump or verify the release version:

```bash
VERSION=0.0.3
deno task bump:version -- --version "$VERSION"
```

Set `VERSION` to the intended release version. Use `--patch`, `--minor`, or `--major` instead when advancing mechanically from the current root version.

4. Create or update the matching release note:

```text
notes/release-notes.vX.Y.Z.md
```

Use normal Dendron frontmatter. Internal documentation links should use wikilinks, for example `[[ac.user-guide]]`.

5. Keep `README.md` user-facing. Put maintainer details here or in task notes, not in the root README.

## Local Validation

Run the same checks that protect the release workflow:

```bash
deno task fmt:check
deno task lint
deno task check
deno task publish:dry-run
deno task test
```

For a final confidence pass, run coverage locally too:

```bash
deno task test:coverage
deno task coverage:lcov
```

The generated coverage directory is local output and should not be committed.

`deno task test` and `deno task test:coverage` intentionally exclude the optional `mesh-alice-bio` smoke suite. That suite depends on sibling Semantic Flow repositories whose branch series can move independently from Accord. Run it only when real-corpus compatibility is the thing being checked:

```bash
deno task test:mesh-alice-bio
```

## Merge To Main

Merge the release branch to `main` only after CI is green. The tag-triggered release workflow publishes whatever is reachable at the pushed tag, so do not tag a stale branch or an unreviewed local commit.

After merging, update local `main`:

```bash
git checkout main
git pull --ff-only origin main
```

## Tag The Release

Create an annotated tag whose name exactly matches the package version:

```bash
VERSION="$(deno eval 'const config = JSON.parse(await Deno.readTextFile("deno.json")); console.log(config.version);')"
git tag -a "v${VERSION}" -m "Accord v${VERSION}"
git push origin "v${VERSION}"
```

The release workflow rejects a tag if `GITHUB_REF_NAME` does not equal `v${deno.json version}` or if the matching release note is missing or empty.

## Watch The Workflow

After pushing the tag, monitor the `release-jsr` workflow:

```bash
gh run list --workflow release-jsr --limit 5
gh run watch
```

The workflow should:

- verify tag, version, and release-note alignment
- run format, lint, type-check, JSR dry-run, and tests
- publish to JSR with GitHub OIDC
- create a GitHub Release from the matching release note

## Post-Release Checks

Confirm the JSR package page shows the new version.

Confirm the GitHub Release exists:

```bash
gh release view "v${VERSION}"
```

Smoke the published library import:

```bash
deno eval 'import { readManifestSource } from "jsr:@spectacular-voyage/accord"; console.log(typeof readManifestSource);'
```

Smoke the published CLI entrypoint:

```bash
deno run -A "jsr:@spectacular-voyage/accord/cli" --help
```

If another repository depends on Accord source directly, update that repository's dependency checkout or CI ref deliberately. Avoid relying on a local checkout branch that differs from hosted CI.

## Failure Handling

If the workflow fails before JSR publish, fix the issue on `main`, delete and recreate the tag only if the failed tag has not produced any public release artifact.

If JSR publish succeeds but GitHub Release creation fails, do not republish the package. Fix the release-note or GitHub Release step and create/update the GitHub Release for the existing tag.

If a bad package version is published to JSR, treat the version as immutable. Publish a corrected patch version and document the problem in the next release note.

## Future Binary Lane

Before Accord publishes native binaries, add and validate:

- `accord --version`
- native `deno compile` build script
- per-platform archive packaging
- SHA-256 checksum files
- native-runner smoke tests
- GitHub Release asset upload

Before Accord publishes npmjs packages, add and validate:

- npm wrapper package
- platform packages with `os` and `cpu` constraints
- local `npm pack` smoke tests
- no `postinstall` downloads

These lanes should remain separate from the JSR source package unless there is a concrete reason to couple them.
