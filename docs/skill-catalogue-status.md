# Skill catalogue status

Snapshot of what is active in `skills/` and what is planned. Every active skill
targets ReScript 12.3.1 and Bun 1.4.

## Active skills

### Router

- `rescript-router` — main entry point and testing hierarchy. References:
  `routing-matrix.md`.

### Language

- `rescript-stdlib-and-data` — the ReScript 12 standard library, `Js` and
  Belt in new code, equality and warning 102, collection semantics, and JSON
  decoding with `JSON.Decode` or Sury. References: `stdlib-map.md`,
  `json-decoding.md`, `equality-and-collections.md`. Examples:
  `JsonDecoding.res`, `SuryUser.res`, `CollectionSemantics.res`.
- `rescript-async` — `async`/`await`, rejection handling and `exn`
  normalization, `Promise.all` versus `allSettled`, timeouts, bounded
  concurrency, fire-and-forget discipline, and `AbortSignal` cancellation.
  References: `promise-patterns.md`, `timeouts-and-cancellation.md`. Example:
  `AsyncPatterns.res`.
- `rescript-interop` — `external` bindings, `@module`, `@send`, `@new`,
  `@val`, `@scope`, `@variadic`, `@return(nullable)`, `@tag`, `@as`, `@unboxed`,
  `Nullable`, dynamic import, genType, and unsafe escapes. References:
  `binding-patterns.md`, `runtime-representation.md`, `unsafe-escapes.md`.
  Examples: `PlatformBindings.res`, `WireShapes.res`.
- `rescript-types-and-modules` — variants and inline records, optional
  fields, type spreads and coercion, `private` and abstract types behind
  `.resi`, module types, functors, first-class modules. References:
  `variants-and-records.md`, `interfaces-and-abstraction.md`,
  `modules-and-functors.md`. Examples: `EmailAddress.resi`, `EmailAddress.res`,
  `Payment.res`, `KeyedStore.res`.
- `rescript-errors-and-results` — option, result, exceptions, `let?`,
  `throw`, `JsExn`, `JsError`, `@throws`. References: `exceptions-and-jsexn.md`,
  `result-pipelines.md`. Examples: `ConfigParsing.res`, `JsBoundary.res`.

### Build and quality

- `rescript-12-migration` — upgrading from ReScript 11: dependencies,
  configuration keys, `rescript-tools migrate`, API and operator renames,
  command changes, and the 12.0.1–12.3.1 deltas. References:
  `upgrade-checklist.md`, `api-renames.md`, `release-deltas-12x.md`. Evidence:
  `tests/migration-tool.test.mjs`.
- `rescript-build-and-config` — `rescript.json` fields, namespaces, sources,
  dev sources, in-source output, warnings policy, experimental features,
  Rewatch commands, Bun workspace monorepos, and publishing. References:
  `rescript-json-fields.md`, `warnings-policy.md`,
  `monorepos-and-publishing.md`.

### Testing

- `rescript-property-testing` — fast-check under Bun: relations, narrow
  bindings, arbitraries for variants and records, model-based tests, typed
  equality, and replay. References: `fast-check-bindings.md`,
  `property-patterns.md`. Examples: `FastCheck.res`, `RingBuffer.res`.
- `rescript-bun-testing` — `bun test` with `rescript-bun`: suite naming,
  explicit suite lists, matchers, case tables, `bun:test` mock bindings, clock
  control and reset, snapshots, and coverage. References:
  `suite-layout-and-runner.md`, `mocks-clocks-and-tables.md`. Examples:
  `BunMock.res`, `BunClock.res`, `OverdueNotifier.res`.

## Planned skills

These names already appear in the router so that routing advice is stable as
the catalogue fills in.

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
