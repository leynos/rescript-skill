# Skill catalogue status

Snapshot of what is active in `skills/` and what is planned. Every active skill
targets ReScript 12.3.1 and Bun 1.4.

## Active skills

### Router

- `rescript-router` — main entry point and testing hierarchy. References:
  `routing-matrix.md`.

### Language

- `rescript-errors-and-results` — option, result, exceptions, `let?`,
  `throw`, `JsExn`, `JsError`, `@throws`. References: `exceptions-and-jsexn.md`,
  `result-pipelines.md`. Examples: `ConfigParsing.res`, `JsBoundary.res`.

## Planned skills

These names already appear in the router so that routing advice is stable as
the catalogue fills in.

- `rescript-types-and-modules`
- `rescript-interop`
- `rescript-async`
- `rescript-stdlib-and-data`
- `rescript-build-and-config`
- `rescript-12-migration`
- `rescript-bun-testing`
- `rescript-property-testing`
- `rescript-quality-tools`
- `rescript-bun-runtime`
- `rescript-react`

## Documentation

- [Agent instructions](../AGENTS.md) — commit gates and the rules for
  changes under `skills/`.
- [README](../README.md) — installation and quick start.
- [Users' guide](users-guide.md) — invocation and routing.
- [Developers' guide](developers-guide.md) — prerequisites, the Make
  gates, and what the test suites cover.
- [Verified facts](research/verified-facts.md) — toolchain behaviour
  established by experiment while writing the catalogue, with sources.

## Maintenance

The catalogue is version-pinned material. Revisit it when ReScript 12.4 or 13
ships, when `rescript-bun` changes major version, or when `LetUnwrap` leaves
experimental status. Re-run `make all` after bumping pins: the executable
examples and the contract suites are the regression evidence.
