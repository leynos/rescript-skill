# Changelog

All notable changes to this project are recorded in this file.

The format is based on [Common Changelog](https://common-changelog.org).

## [Unreleased]

### Added

- Bun-based repository scaffold: exact pins for ReScript 12.3.1 and
  `rescript-bun` 2.1.0, an in-source namespaced build, and sequential
  `make all` gates for formatting, compiler warnings as errors, reanalyze,
  Biome, Markdown, skill manifests, tests, and spelling.
- `check-codeblocks.mjs`: parses and formats every ReScript fence in
  Markdown without touching surrounding prose.
- `check-reanalyze.mjs`: fails the gate on any dead-code or exception
  finding from `rescript-tools reanalyze`.
- `rescript-router` skill with a routing matrix and a testing hierarchy.
- `rescript-errors-and-results` skill with executable `ConfigParsing` and
  `JsBoundary` examples.
- `rescript-types-and-modules` skill with executable `EmailAddress`,
  `Payment`, and `KeyedStore` examples covering `private` types, variant
  spreads and coercion, and functors.
- `rescript-interop` skill with executable `PlatformBindings` and
  `WireShapes` examples covering class, method, variadic, and nullable bindings
  and the `@tag`, `@as`, and `@unboxed` representations.
- `rescript-async` skill with an executable `AsyncPatterns` example covering
  timeouts, rejection normalization, bounded concurrency, and cooperative
  cancellation.
- `rescript-stdlib-and-data` skill with executable `JsonDecoding`,
  `SuryUser`, and `CollectionSemantics` examples.
- `rescript-build-and-config` skill covering `rescript.json`, the warnings
  policy measured against 12.3.1 defaults, and Bun workspace monorepos.
- `rescript-12-migration` skill, with `tests/migration-tool.test.mjs`
  running the real `rescript-tools migrate` over a ReScript 11-style module.
- `rescript-bun-testing` skill with executable `BunMock`, `BunClock`, and
  `OverdueNotifier` examples.
- `rescript-property-testing` skill with `FastCheck` bindings, a
  `RingBuffer` model-based example, and properties over earlier examples.
- `rescript-quality-tools` skill with a `ReanalyzeAnnotations` example.
- `rescript-bun-runtime` skill with a portable `TodoCore` and a
  `TodoServer` adapter tested over real HTTP, plus a contract test that keeps
  `*Core.res` examples free of runtime bindings.
- `rescript-react` skill with a `ShoppingList` example: a pure reducer and
  components rendered under Bun with `ReactDOMServer.renderToStaticMarkup`.

### Changed

- Build in source. With `"in-source": false` the compiler imports
  dependencies from `pkg/lib/es6/`, which Sury's `exports` map rejects.
  `make install-skills` now copies only committed files, so generated
  `.res.mjs` files never reach an installed catalogue.
- Move the fence and reanalyze gate scripts into
  `skills/rescript-quality-tools/references/examples/`, so the repository runs
  exactly the scripts the skill ships.
