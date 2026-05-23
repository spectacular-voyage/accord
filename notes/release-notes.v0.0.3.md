---
id: mro3nuxgncugw8gqx9q4t2x
title: 'release notes v0.0.3'
desc: ''
updated: 1779519766000
created: 1779519766000
---

## Summary

Accord `v0.0.3` adds the first portable scenario-index vocabulary for describing ordered fixture topology across multiple transition manifests, while keeping `accord check` focused on validating individual transition manifests.

## Highlights

- Adds Accord-owned `ScenarioIndex` and `ScenarioStep` JSON-LD vocabulary for ordered multi-step fixture scenarios.
- Adds state-lane metadata so a scenario can describe separate source, publication, or other fixture/application lanes when a single `fromRef` / `toRef` pair is not enough.
- Adds scenario-index loading support that preserves fixture identity, fixture defaults, manifest references, ordered steps, lane bindings, and step metadata.
- Adds SHACL validation for the scenario-index shape, including lane binding checks that require each step binding to reference a lane declared by the same scenario index.
- Adds an in-repo sample scenario index that points at the existing black-box transition manifests without replacing the existing black-box scenario runner input.
- Hardens JSON-LD loading for scenario indexes with multiple `@type` values and compact JSON-LD `@list` forms.
- Adds `deno task bump:version` for maintainers so package version and release-note version updates can be made consistently during release preparation.

## Changed Behavior

`accord check` remains a transition-manifest checker. This release does not add a scenario runner, workflow engine, replay executor, or automatic multi-step orchestration.

Scenario indexes are topology documents. Transition manifests still own per-operation assertions and optional replay metadata.

## Usage

Scenario indexes can describe ordered steps that refer to existing transition manifests:

```json
{
  "@context": "./support/accord-context.jsonld",
  "@type": "ScenarioIndex",
  "fixture": "black-box",
  "hasStateLane": ["source"],
  "hasStep": [
    {
      "@type": "ScenarioStep",
      "name": "add expected file",
      "order": 1,
      "manifest": "../manifests/file-added-pass.jsonld",
      "hasStateBinding": [
        {
          "lane": "source",
          "fromRef": "refs/heads/base",
          "toRef": "refs/heads/file-added"
        }
      ]
    }
  ]
}
```

Downstream fixture systems can own their own scenario-index documents while using the Accord vocabulary and validation contract.

## Validation

- Adds loader coverage for scenario-index mapping and source preservation.
- Adds validation coverage for valid scenario indexes, missing required fields, invalid lane bindings, and JSON-LD list forms.
- Keeps the existing black-box transition-manifest suite intact.

## Artifacts

- JSR package: `@spectacular-voyage/accord`
- Deno library import: `jsr:@spectacular-voyage/accord`
- Deno CLI entrypoint: `jsr:@spectacular-voyage/accord/cli`
- GitHub source release: `v0.0.3`

## Known Limitations

- This is not a native binary release.
- This is not an npmjs global-install release.
- Scenario indexes are loaded and validated as topology metadata, but Accord does not execute scenarios.
- The ontology and SHACL namespace modernization is intentionally deferred to a future compatibility-boundary release.
