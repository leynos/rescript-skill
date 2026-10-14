# Verified facts

Toolchain behaviour established by experiment while writing the catalogue. Each
entry names how it was verified. Where an executable example in `skills/` now
carries the evidence, the entry says so; those facts are re-checked by every
`make test`.

Baseline: `rescript` and `@rescript/runtime` 12.3.1, `rescript-bun` 2.1.0, Bun
1.4.3, Linux x64, October 2026.

## Sources

- The ReScript manual's full-text export,
  `https://rescript-lang.org/llms/manual/llm-full.txt`, and the React export,
  `https://rescript-lang.org/llms/react/llm-full.txt`, fetched in October 2026.
- `node_modules/rescript/CHANGELOG.md` for 12.0.0 to 12.3.1.
- The standard library interfaces shipped in
  `node_modules/@rescript/runtime/lib/ocaml/Stdlib_*.resi`.
- `node_modules/rescript-bun/src/Test.res` for the Bun test bindings.

## Compiler and syntax

- `let?` is gated: without `"experimental-features": {"LetUnwrap": true}`
  the build fails with "Experimental feature not enabled: LetUnwrap". With it,
  `let? Some(x)` inside a function returning `result` and mixed error types
  across `let?` steps are both compile errors. Evidence: `ConfigParsing.res`.
- `raise` and every `Js.*` binding raise warning 3 (deprecated) and so fail
  a `+A` warning-as-error build. The diagnostics name `rescript-tools migrate`.
- `throw(E(...))` compiles to a plain object
  `{RE_EXN_ID, _1, Error: new Error()}`, not an `Error` instance. Evidence:
  generated `JsBoundary.res.mjs`.
- `Int.fromString` is `parseInt` plus a range check, so `"80abc"` yields
  `Some(80)`. Evidence: `ErrorsAndResults.test.res`.

## Build system

- Without `"namespace": true`, a dev source named `Geometry.test.res` cannot
  refer to `src/Geometry.res`: the build reports "The module or file Geometry
  can't be found". With a namespace the two compile as `Geometry-Ns` and
  `Geometry.test-Ns` and the reference resolves.
- `"package-specs": {"module": "esmodule", "in-source": false}` writes output
  to `lib/es6/<source path>.res.mjs`. The same setting governs imports of
  dependencies: the compiler emitted `sury/lib/es6/src/S.res.mjs`, which Sury
  11.0.0's `exports` map (`"./src/*"` only) does not admit, so Bun failed with
  "Cannot find module". With `"in-source": true` it emits `sury/src/S.res.mjs`
  and resolves. This repository therefore builds in source.
- A dev source can reference modules in another dev source of the same
  project (`tests/` referring to `skills/**`).

- With no `warnings` block, 12.3.1 reports warning 109 as an error; 26, 27,
  44, and 110 as warnings; and 4, 9, 41, and 102 not at all.
- `@warning("-4")` and `@warning("-9")` on a binding suppress those warnings.
- A bare `rescript format --check` includes dev sources.
- A file in a subdirectory not covered by `sources` is not compiled; two
  files with one module name in a package fail with "Duplicate module name".
  Unknown and deprecated `rescript.json` fields only print a message.
- In a Bun 1.4.3 workspace, the default isolated linker leaves no root
  `node_modules/<workspace-package>` symlinks and Rewatch fails with "upward
  traversal did not find". `[install] linker = "hoisted"` fixes it, and the
  namespace for `@mono/core` is `MonoCore`.

## Tools

- `rescript-tools reanalyze -config` runs the analyses named in
  `rescript.json`, including `exception`, and `-json` emits a findings array.
  It exits 0 whatever it reports. `scripts/check-reanalyze.mjs` turns findings
  into a failing status.
- reanalyze treats `JSON.stringifyAny` and `JsError.throwWithMessage` as
  throwing `JsExn`, and reports record labels that are constructed but never
  read.
- `rescript-tools format-codeblocks` reprints the entire Markdown document,
  escaping table pipes, `*`, and `-`, both in place and with `--stdout`, and
  exits 0 on a fence with a syntax error. `rescript format --stdin .res` exits
  1 on a syntax error. The fence gate pipes each fence through the latter
  instead.
- `rescript-tools extract-codeblocks` reports `rescript`, `res`, and
  `res prelude` fences but not their language tag.

## Bun bindings

- `rescript-bun` 2.1.0's `Test` module binds `describe`, `test`,
  `testAsync`, lifecycle hooks, `setSystemTime`, and about seventy `Expect`
  matchers. It has no `mock`, `spyOn`, or `test.each`; the source carries
  `// TODO: mocking etc`.
- Its README recommends `bsc-flags` (a deprecated key) and global opens; both
  conflict with the posture this catalogue teaches.

## Async

- `try`/`catch` around `await` and `Promise.catch` wrap a raw JavaScript
  rejection as `JsExn(_)` (through `internalToException` and
  `anyToExnInternal`). `Promise.allSettled` is a plain external: its
  `Rejected({reason})` carries the raw value, so `| JsExn(_)` does not match.
  Evidence: `Async.test.res`.
- A promise expression in statement position is a type error. `Promise.done`
  is deprecated in favour of `Promise.ignore`.
- Bun exits with status 1 on an unhandled rejection, and `bun test` fails the
  test that produced it.
- The losing side of `Promise.race` keeps running; its later rejection is not
  reported as unhandled.

## Warnings under `+A`

- Warning 4 (fragile match) rejects a `_` case that covers constructors of a
  closed variant, warning 9 rejects record patterns that do not bind or close
  every label, and warning 41 flags a constructor that belongs to several
  types, as happens after a variant spread.
- Warning 102 (polymorphic comparison) cannot be silenced locally in 12.3.1:
  `@warning("-102")` on a binding or expression and `@@warning("-102")` at
  module or file level all leave the error in place. Only the project-wide
  `warnings` setting controls it.
- `JSON.Decode.*` helpers return options, so decoders built on them stay
  exhaustive under warning 4 without a wildcard case.
- Sury 11.0.0 schemas compile with `eval`, report failures by throwing
  `S.Exn`, and its documentation still names `bs-dependencies`.

## Migration tool

- `rescript-tools migrate` refuses to run until the project has built
  (`build artifacts could not be found`). It rewrites `Js.log`, `raise`,
  `Js.Json.parseExn`, `Option.getExn`, `Js.Exn.Error`, `Js.Exn.message`, and
  `Bool.fromStringExn`, but leaves `lsl` and `land`, which are deprecated with
  "This will be removed in v13". Evidence: `tests/migration-tool.test.mjs`.
