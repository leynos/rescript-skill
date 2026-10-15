# Skill catalogue status

Snapshot of what is active in `skills/`. Every skill targets ReScript 12.3.1
and Bun 1.4, and every ReScript example under `references/examples/` is
compiled, analysed, and exercised by `make test`.

## Active skills

### Router

- `rescript-router` — main entry point and testing hierarchy. References:
  `routing-matrix.md`.

### Language

- `rescript-types-and-modules` — variants and inline records, optional
  fields, type spreads and coercion, `private` and abstract types behind
  `.resi`, module types, functors, first-class modules. References:
  `variants-and-records.md`, `interfaces-and-abstraction.md`,
  `modules-and-functors.md`. Examples: `EmailAddress.resi`, `EmailAddress.res`,
  `Payment.res`, `KeyedStore.res`.
- `rescript-errors-and-results` — option, result, exceptions, `let?`,
  `throw`, `JsExn`, `JsError`, `@throws`. References: `exceptions-and-jsexn.md`,
  `result-pipelines.md`. Examples: `ConfigParsing.res`, `JsBoundary.res`.
- `rescript-interop` — `external` bindings, `@module`, `@send`, `@new`,
  `@val`, `@scope`, `@variadic`, `@return(nullable)`, `@tag`, `@as`, `@unboxed`,
  `Nullable`, dynamic import, genType, and unsafe escapes. References:
  `binding-patterns.md`, `runtime-representation.md`, `unsafe-escapes.md`.
  Examples: `PlatformBindings.res`, `WireShapes.res`.
- `rescript-async` — `async`/`await`, rejection handling and `exn`
  normalization, `Promise.all` versus `allSettled`, timeouts, bounded
  concurrency, fire-and-forget discipline, and `AbortSignal` cancellation.
  References: `promise-patterns.md`, `timeouts-and-cancellation.md`. Example:
  `AsyncPatterns.res`.
- `rescript-stdlib-and-data` — the ReScript 12 standard library, `Js` and
  Belt in new code, equality and warning 102, collection semantics, and JSON
  decoding with `JSON.Decode` or Sury. References: `stdlib-map.md`,
  `json-decoding.md`, `equality-and-collections.md`. Examples:
  `JsonDecoding.res`, `SuryUser.res`, `CollectionSemantics.res`.

### Build and quality

- `rescript-build-and-config` — `rescript.json` fields, namespaces, sources,
  dev sources, in-source output, warnings policy, experimental features,
  Rewatch commands, Bun workspace monorepos, and publishing. References:
  `rescript-json-fields.md`, `warnings-policy.md`,
  `monorepos-and-publishing.md`.
- `rescript-12-migration` — upgrading from ReScript 11: dependencies,
  configuration keys, `rescript-tools migrate`, API and operator renames,
  command changes, and the 12.0.1–12.3.1 deltas. References:
  `upgrade-checklist.md`, `api-renames.md`, `release-deltas-12x.md`. Evidence:
  `tests/migration-tool.test.mjs`.
- `rescript-quality-tools` — the formatter, the Markdown fence gate,
  warnings and `%todo`, reanalyze as a CI gate with `@live`, `@dead`, and
  `@throws`, `rescript-tools doc`, and Biome. References:
  `formatter-and-fences.md`, `reanalyze-gate.md`, `ci-gates.md`. Examples:
  `ReanalyzeAnnotations.res`, `check-reanalyze.mjs`, `check-codeblocks.mjs`
  (the gate scripts this repository runs).

### Testing

- `rescript-bun-testing` — `bun test` with `rescript-bun`: suite naming,
  explicit suite lists, matchers, case tables, `bun:test` mock bindings, clock
  control and reset, snapshots, and coverage. References:
  `suite-layout-and-runner.md`, `mocks-clocks-and-tables.md`. Examples:
  `BunMock.res`, `BunClock.res`, `OverdueNotifier.res`.
- `rescript-property-testing` — fast-check under Bun: relations, narrow
  bindings, arbitraries for variants and records, model-based tests, typed
  equality, and replay. References: `fast-check-bindings.md`,
  `property-patterns.md`. Examples: `FastCheck.res`, `RingBuffer.res`.

### Runtime and UI

- `rescript-bun-runtime` — Bun through `rescript-bun`: `Bun.serve`, fetch,
  requests and responses, files, environment, the shell, SQLite, and a portable
  core behind ports. References: `adapter-boundary.md`, `bun-apis.md`. Examples:
  `TodoCore.res`, `TodoServer.res`.
- `rescript-react` — `@rescript/react` 0.15 with JSX v4: components, props,
  children, keys, hooks and effect dependencies, reducers, React 19 hooks, and
  rendering in Bun tests. References: `components-and-props.md`,
  `hooks-and-effects.md`, `testing-components.md`. Example: `ShoppingList.res`.

### Verification

- `rescript-deductive-verification` — proving properties of production code:
  `@requires`/`@ensures` contracts on ReScript declarations, a bridge from the
  compiled JavaScript and genType output to LemmaScript and Dafny, the
  correspondence audit, int32 typing predicates, mutants for non-vacuity, and
  which properties need conformance tests instead. References:
  `compiled-javascript-route.md`, `contracts-and-properties.md`,
  `limitations-and-gotchas.md`. Examples: `VerifiedLease.res` (proved by
  `make prove`), `res2ls-bridge.mjs`, `res2ls-correspond.mjs`.

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

## Open questions

- Interaction tests for React components need a DOM under Bun (for example
  happy-dom). The catalogue covers reducers and static rendering only, pending
  a concrete need and a binding set worth maintaining.
- Mutation testing (for example Stryker over the generated JavaScript) is not
  covered; mapping surviving mutants back to ReScript source is unproven.
- The verification bridge has no route for loop invariants, no specified
  externs for `@rescript/runtime` helpers, and has not been exercised with
  LemmaScript's Lean backend. A native ReScript frontend would need OCaml
  access to `.cmt` typed trees; it is deferred until the compiled-JavaScript
  route's syntax limits bind.
- `LetUnwrap` is experimental. When it stabilizes, `rescript-errors-and-results`
  should drop the library caveat and the configuration notes.
