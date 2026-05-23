---
id: 8a82ad8ccc79482cad224517acb64853
title: 'release notes v0.1.0'
desc: ''
updated: 1779520409342
created: 1779520409342
---

## Summary

Accord `v0.1.0` modernizes the published ontology and SHACL identifiers so Accord terms use stable slash-ended namespaces and Semantic Flow-friendly release metadata.

## Highlights

- Changes the Accord term namespace from `https://spectacular-voyage.github.io/accord/ns#` to `https://spectacular-voyage.github.io/accord/ontology/`.
- Changes the Accord SHACL shape namespace from `https://spectacular-voyage.github.io/accord/shapes#` to `https://spectacular-voyage.github.io/accord/shacl/`.
- Sets the ontology document IRI to `https://spectacular-voyage.github.io/accord/ontology`.
- Sets the SHACL document IRI to `https://spectacular-voyage.github.io/accord/shacl`.
- Adds version, release, preferred namespace, creator, content URL, and downloadable TTL metadata to both `accord-ontology.ttl` and `accord-shacl.ttl`.
- Updates Accord's JSON-LD loaders, bundled context, examples, and test fixtures to use the new slash namespaces.
- Adds regression coverage that parses the Turtle files and verifies the new metadata headers do not drift back to the old hash namespaces.

## Breaking Or Changed Behavior

JSON-LD manifests and scenario indexes should update their Accord vocabulary context to:

```json
{
  "@vocab": "https://spectacular-voyage.github.io/accord/ontology/"
}
```

Consumers that store expanded RDF using old `https://spectacular-voyage.github.io/accord/ns#...` term IRIs should migrate those values to `https://spectacular-voyage.github.io/accord/ontology/...`.

Accord does not add backward-compatibility aliases for the old namespace in this release. Until a v1.0 stability commitment exists, the cleaner contract is preferable to a permanent dual-namespace surface.

## Artifacts

- JSR package: `@spectacular-voyage/accord`
- Deno library import: `jsr:@spectacular-voyage/accord`
- Deno CLI entrypoint: `jsr:@spectacular-voyage/accord/cli`
- GitHub source release: `v0.1.0`

## Validation

- Turtle metadata regression tests parse `accord-ontology.ttl` and `accord-shacl.ttl`.
- The default Accord format, lint, type-check, package dry-run, and test gates should be run before tagging.

## Known Limitations

- This is not a native binary release.
- This is not an npmjs global-install release.
- Accord still does not execute scenario indexes or replay profiles.

## Next

- Update downstream Semantic Flow fixture and application manifests to the new Accord namespace.
- Publish dereferenceable ontology and SHACL pages for the new document IRIs.
