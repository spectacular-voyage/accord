---
id: zzrdfufjg0kfxzrg7c2tivu
title: 'release notes v0.0.1'
desc: ''
updated: 1778732628248
created: 1778732597920
---

## Summary

Accord `v0.0.1` is the first JSR-oriented seed release for the conformance checker and TypeScript library.

## Highlights

- Adds the initial `@spectacular-voyage/accord` JSR package metadata.
- Exposes a small public API from `src/mod.ts` for CLI execution, manifest loading, case selection, comparison helpers, JSON-LD document policy helpers, report types, and checker result codes.
- Exposes a `./cli` package entrypoint for Deno-based command execution before native binary distribution exists.
- Keeps native binary and npmjs wrapper distribution as planned future release lanes rather than blockers for the first library release.

## Usage

After publication, Deno consumers can import the library with:

```ts
import { readManifestSource, selectTransitionCase } from "jsr:@spectacular-voyage/accord";
```

The Deno CLI entrypoint is:

```bash
deno run -A jsr:@spectacular-voyage/accord/cli --help
```

## Notes

- This is not yet a native binary release.
- This is not yet an npmjs global-install release.
- The public API should still be treated as early and subject to explicit migration notes before a stability milestone.
