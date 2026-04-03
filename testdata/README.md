# Accord Testdata

This directory contains black-box test inputs for the Accord CLI.

- `repos/` holds repository fixture source trees and metadata.
- `manifests/` holds scenario-specific Accord manifests.
- `scenarios/` holds machine-readable scenario indexes for the black-box suite.

Repository fixtures are stored as source snapshots, not as nested live git repositories. Tests should materialize temporary git repositories from these source trees and assign the named refs declared in each `repo.json`.
