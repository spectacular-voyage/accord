---
id: 3pr0r51u8omx1965wc2bjv2
title: 2026 05 13 CI/CD
desc: ''
updated: 1778733249385
created: 1778733230423
---

## Goals

- Define Accord's CI/CD path now that the project is both a Deno-first library and a useful CLI.
- Ship an initial `v0.0.1` release path with repeatable validation, release notes, package metadata, and a registry publish target.
- Prefer JSR for Accord's library distribution, while keeping a clear future lane for native binary releases and npmjs-based binary installs.
- Keep the release system smaller than Kato's unless Accord actually needs Kato's daemon/web/native-install complexity.

## Summary

Accord has a different distribution center of gravity from Kato. Kato's primary user experience is an installed application with native executables; Accord's primary user experience should be a reusable conformance library plus a lightweight checker CLI. That means the first release should make the TypeScript API and Deno CLI easy to consume before investing in a full binary/npm wrapper matrix.

Recommended first channel: publish `@spectacular-voyage/accord` to JSR. JSR is a good fit because Accord is Deno-first TypeScript, JSR publishes ESM TypeScript packages, generates docs and npm-compatible output, and supports GitHub Actions OIDC publishing. The initial JSR package should expose a deliberately small public surface, probably `.` -> `src/mod.ts`, with more entrypoints added only after the module boundaries are intentionally public.

Important push-back: JSR should not be treated as equivalent to npmjs for native binary distribution. JSR's npm compatibility layer lets npm-compatible tools install JSR packages from `https://npm.jsr.io`, but those packages are generated module tarballs for JS/TS source reachable from JSR exports. JSR's documented package shape is `name`, `version`, and module `exports`; it does not replace npmjs' mature `bin`, `optionalDependencies`, `os`/`cpu` platform package, and global CLI-install conventions. For native binaries, follow Kato's later architecture: GitHub Releases contain built archives and checksums; npmjs can later provide a wrapper package plus platform packages that install those prebuilt binaries without compiling or downloading in `postinstall`.

Recommended release lanes:

- CI quality gate: already mostly present through format, lint, type-check, tests, coverage, Codecov upload, CodeQL setup, and CodeRabbit.
- JSR library release: first automated publish target for `v0.0.1`.
- GitHub source release: tag-driven release with [[release-notes.v0.0.1]].
- Native binary release: planned future lane using `deno compile`, initially one `accord` binary per target.
- npmjs binary install: planned future lane, only after native binary artifacts exist.

## Discussion

### Current State

Accord already has `.github/workflows/ci.yml` running `deno task fmt:check`, `deno task lint`, `deno task check`, and coverage-enabled tests on PRs and `main`. Codecov upload is wired with OIDC, and the earlier CI setup is tracked in [[ac.completed.2026.2026-04-03-accord-ci]].

The repository now has JSR package metadata in `deno.json`: `name`, `version`, `license`, public `exports`, publish filtering, and a `publish:dry-run` task. [[release-notes.v0.0.1]] exists as the seed release note. `.github/workflows/release-jsr.yml` publishes tag releases to JSR through GitHub Actions OIDC after verifying tag/version/release-note alignment and running the normal checks, then creates a GitHub release from the versioned release note.

There is still no binary build script, package assembly script, GitHub release creation step, or npmjs package layout. Those are intentionally later lanes.

### Accord Packaging Model

Accord should have four distinct but compatible distribution shapes:

- Library package: `jsr:@spectacular-voyage/accord`, primarily for Deno and TypeScript consumers.
- Deno CLI path: a documented `deno run` or `deno install` route for users who already have Deno and want the checker command before native binaries exist.
- Native binary archives: GitHub release artifacts such as `accord-v0.0.x-linux-x64.tar.gz`, `accord-v0.0.x-darwin-arm64.tar.gz`, and `accord-v0.0.x-windows-x64.zip`.
- npmjs binary wrapper: future `npm install -g @spectacular-voyage/accord` path using the Kato-style wrapper/platform-package model.

The library package and binary installer do not need to be the same artifact. They should share semver and source provenance, but they solve different jobs.

### JSR Recommendation

Use `deno.json` for the JSR metadata unless a separate `jsr.json` becomes clearer. JSR allows the JSR config fields in `deno.json`, and keeping one config file is a reasonable fit for a small Deno-first project.

Initial proposed package metadata:

```json
{
  "name": "@spectacular-voyage/accord",
  "version": "0.0.1",
  "exports": {
    ".": "./src/mod.ts"
  },
  "publish": {
    "include": [
      "README.md",
      "accord-ontology.ttl",
      "accord-shacl.ttl",
      "src/**/*.ts"
    ],
    "exclude": [
      "tests/**",
      "testdata/**",
      "documentation/**"
    ]
  }
}
```

This is intentionally narrow. `src/mod.ts` now exposes the seed public library API: CLI execution, CLI parsing helpers, manifest loading, manifest model types, case selection, comparison helpers, JSON-LD document policy helpers, report types, result codes, and text report rendering. This is enough for early library use without blessing every internal module as public.

### GitHub Release Strategy

Use tags as the release trigger. The release workflow should verify that the tag `vX.Y.Z`, package version, and release note filename agree. For `v0.0.1`, publish the JSR package first, then create or update the GitHub release from [[release-notes.v0.0.1]].

Recommended release sequence:

1. PR validation runs normal CI plus `deno publish --dry-run`.
2. Maintainer updates `deno.json` version and release notes.
3. Maintainer tags `v0.0.1`.
4. Release workflow runs full CI.
5. Release workflow runs `deno publish` with GitHub OIDC.
6. Release workflow creates the GitHub release with release notes.

JSR package setup still requires creating/linking the `@spectacular-voyage/accord` package/scope in JSR settings before OIDC publishing will work.

### Native Binary Strategy

Native binaries are worth planning for, but they should not block the first JSR release. Accord's binary story is much simpler than Kato's:

- one public binary: `accord`
- no daemon sibling
- no web sibling
- no long-running service lifecycle
- no npm wrapper needed until there is a real user need for `npm install -g`

The future binary workflow should mirror the useful Kato pieces from [[ka.completed.2026.2026-03-11-binary-distributions]] without copying unnecessary complexity:

- build with `deno compile` from `src/main.ts`
- use a native runner matrix for Linux x64, macOS x64, macOS arm64, and Windows x64
- package each binary with README, license if present, release metadata, and checksum
- smoke `accord --help` and at least one tiny `accord check` fixture from the packaged bundle
- upload archives and `.sha256` files to the GitHub release

Accord probably needs a `--version` command before binary distribution is pleasant. That can be a small CLI contract addition tied to package version metadata.

### npmjs Binary Install Strategy

Do not publish a source-style npm package first just to have an npm package. If Accord eventually uses npmjs, it should be because we want npm's global CLI install behavior and platform package semantics.

Future package shape should mirror Kato's [[ka.completed.2026.2026-03-11-npmjs-install]] direction:

- top-level package: `@spectacular-voyage/accord`
- platform packages:
  - `@spectacular-voyage/accord-linux-x64-gnu`
  - `@spectacular-voyage/accord-darwin-x64`
  - `@spectacular-voyage/accord-darwin-arm64`
  - `@spectacular-voyage/accord-win32-x64`

The top-level npm package should contain a tiny Node launcher with a `bin` entry for `accord` and `optionalDependencies` on platform packages. Platform packages should contain the prebuilt native binary and metadata. This keeps npm install deterministic, avoids `postinstall` downloads, and gives npm users normal install/update/uninstall semantics.

This does not conflict with JSR. JSR's npm compatibility package is addressed through the `@jsr` registry mapping, while npmjs can own the human-facing global binary package name.

### Source References

- JSR package configuration documents `name`, `version`, `exports`, and publish include/exclude configuration: https://jsr.io/docs/package-configuration
- JSR publishing documents ESM TypeScript package rules and GitHub Actions OIDC publishing: https://jsr.io/docs/publishing-packages
- JSR npm compatibility documents npm-compatible installation from `https://npm.jsr.io`, its limitations, and generated tarball behavior: https://jsr.io/docs/npm-compatibility

## Open Issues

- What should be the first stability milestone for the `src/mod.ts` public API?
- Confirm `Apache-2.0` is the intended Accord package license; it was selected to match Kato's repository license and satisfy JSR package validation.
- Should the first JSR package include `accord-ontology.ttl` and `accord-shacl.ttl` as package data, or should those remain repository/release assets until the validation command exists?
- Should the Deno-installed CLI entrypoint remain documented after native binaries exist, or become an advanced/developer path?
- Should `deno publish --dry-run` remain a required regular CI check after the first release, or move back to release-only if it proves noisy?
- What exact JSR scope ownership do we want: `@spectacular-voyage/accord`, or a shorter scope if one exists?
- Should Codecov stay informational for `v0.0.1`, or should it become a required branch-protection check later?
- Which binary targets are required for the first binary release: Linux x64 only as proof of concept, or Linux x64 plus macOS arm64/x64 and Windows x64 from the start?
- Do we need signing/notarization in the first binary release, or is checksum-only acceptable for the first intentionally experimental native artifacts?

## Decisions

- JSR is the recommended first registry for Accord's library distribution.
- `v0.0.1` exposes a small but real public library API rather than only `runCli`.
- `v0.0.1` exposes a JSR `./cli` entrypoint as the interim Deno CLI path before native binaries exist.
- `v0.0.1` should not wait for native binaries.
- Native binaries are still a real target, just a later release lane.
- JSR should not be treated as the native-binary install channel.
- npmjs should be reserved for the future binary-wrapper install path unless a concrete Node-library distribution need appears.
- The first native binary shape should be a single `accord` executable, not a Kato-style multi-binary bundle.
- Avoid `postinstall` downloads and local compilation for future npmjs binary packages.
- Keep release automation tag-driven so package versions, release notes, and GitHub releases stay aligned.

## Contract Changes

- Add package metadata to `deno.json` or `jsr.json`: `name`, `version`, `license`, and `exports`.
- Define the public library API exposed from `src/mod.ts`.
- Add publish filtering so JSR gets source/API artifacts and not test fixtures, archive notes, or development-only documentation.
- Add a release workflow capable of publishing to JSR using GitHub Actions OIDC.
- Add a release workflow step that creates a GitHub release from the versioned release note.
- Later, add `accord --version` before publishing native binaries.
- Later, add binary packaging metadata that records source commit, version, target platform, build time, and checksum.
- Later, add npmjs wrapper/platform packages only after the native binary archives are real.

## Testing

- Keep the existing CI checks: `deno task fmt:check`, `deno task lint`, `deno task check`, and `deno task test:coverage`.
- Add `deno publish --dry-run` before the first JSR publish, at least in the release workflow and preferably in regular CI once metadata stabilizes.
- Add a package import smoke test that imports the package through the public `src/mod.ts` API rather than internal paths.
- Add a release-note/version consistency check before tag publishing.
- For a Deno CLI install path, smoke the documented command in a temp directory.
- For future binaries, smoke packaged `accord --help`, `accord --version`, and one small `accord check` run from the packaged archive.
- For future npmjs binary install, smoke local `npm pack` outputs in a temp project and prove the wrapper launches the packaged native binary.

## Non-Goals

- Do not build a Kato-scale binary/npm release system for `v0.0.1`.
- Do not publish a source-style npmjs package just to mirror JSR.
- Do not add daemon/web/service packaging concepts to Accord.
- Do not add installer signing/notarization until native binary demand is real enough to justify the maintenance burden.
- Do not make Codecov or OSV scanner policy stricter as part of the first release unless there is a concrete repository risk to address.

## Implementation Plan

- [x] Decide the `v0.0.1` public API surface for `src/mod.ts`.
- [x] Add `name`, `version`, `license`, `exports`, and `publish` metadata to `deno.json`.
- [x] Run `deno publish --dry-run` locally and fix JSR package validation issues.
- [x] Fill out [[release-notes.v0.0.1]] with user-facing release notes.
- [x] Add a package import smoke test against the public API.
- [x] Add a release consistency check that verifies tag/version/release-note alignment in the JSR release workflow.
- [x] Add a tag-driven JSR publish workflow using GitHub Actions OIDC.
- [x] Add GitHub release creation from the versioned release note.
- [x] Document the JSR install/import path in [[ac.user-guide]].
- [x] Decide whether to document a temporary Deno CLI run/install path before native binaries exist.
- [ ] Later: add `accord --version`.
- [ ] Later: add `scripts/build-binaries.ts` using `deno compile`.
- [ ] Later: add binary packaging, checksums, and native-runner release artifacts.
- [ ] Later: add npmjs wrapper/platform package assembly and smoke tests.
