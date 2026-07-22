---
id: 3p5v767j28avuie8azczr81
title: Todo
desc: ''
updated: 1783314313211
created: 1783313723365
---

- [ ] Consider extracting shared SPARQL profile validation for the ASK assertion checker and SHACL `sh:sparql` SELECT evaluator. Both paths now reject unsupported SPARQL features before evaluation, and a shared helper could keep the supported-profile rules from drifting if either evaluator grows.
- [ ] executable release artifact