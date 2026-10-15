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
  It exits 0 whatever it reports. `check-reanalyze.mjs` (in
  `rescript-quality-tools`) turns findings into a failing status.
- reanalyze treats `JSON.stringifyAny` and `JsError.throwWithMessage` as
  throwing `JsExn`, and reports record labels that are constructed but never
  read.
- `rescript-tools format-codeblocks` reprints the entire Markdown document,
  escaping table pipes, `*`, and `-`, both in place and with `--stdout`, and
  exits 0 on a fence with a syntax error. `rescript format --stdin .res` exits
  1 on a syntax error. The fence gate pipes each fence through the latter
  instead.
- Removing `@live` from a value used only by JavaScript produces
  `Dead Value: x is never used`; calling a `@dead` value from live code produces
  `Incorrect Dead Annotation`. Evidence: `ReanalyzeAnnotations.res`.
- `rescript-tools doc` reads `.resi` docstrings but prints
  `type t = private string` as `type t = string`.
- `%todo` compiles to `JsError.throwWithMessage` with the absolute source path
  and location in the message.
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

## Bun test runner

- A bare `bun test` in this repository ran the five `*.test.mjs` suites and
  none of the compiled `*.test.res.mjs` suites, and exited 0.
- `@module("bun:test") external reset: unit => unit = "setSystemTime"`
  compiles to `setSystemTime()`, which restores the real clock.
- `Expect.toMatchSnapshot` in `tests/Snap.test.res` wrote
  `tests/__snapshots__/Snap.test.res.mjs.snap`.
- `Expect.toHaveBeenCalledTimes` accepts a value created by `bun:test`'s
  `mock` through a local binding.

## Property testing

- fast-check 4.10.2's `fc.integer()` samples the full 32-bit range, and
  `fc.option` yields `null` for the empty case.
- A failing `fc.assert` throws an `Error` whose message contains the
  counterexample, `seed`, and `path`. Evidence: `PropertyTesting.test.res`.
- `Fc.map(Int.toString)` fails to compile with "This function is expected to
  have 1 argument, but has 2", because `Int.toString` takes an optional
  `~radix`.
- Type declarations are rejected inside function bodies, including `describe`
  callbacks.
- reanalyze reports `mod` as possibly throwing `Division_by_zero`.
- `RescriptBun.Bun.deepEquals` is bound as `('a, 'b, ~strict: bool=?) => bool`.
- With the overflow branch of `RingBuffer.push` removed, the model-based
  property failed and shrank to capacity 2 with three pushes.

## Deductive verification

Established in a bounded spike with LemmaScript 0.6.4 (npm, git head `097f18f`,
and main at `b7870ec`, which produced byte-identical Dafny), Dafny 4.11.0, and
Z3 4.12.1. `make prove` re-checks the example's proof.

- `@requires("…")` and `@ensures("…")` attributes compile under `+A` with no
  warning, and `bsc -only-parse -dparsetree` prints them with their string
  payloads. Without `-only-parse`, `bsc` type-checks the file outside the
  project, fails for modules with dependencies, and writes a `.cmt` beside it.
- `bsc -dtypedtree` prints only annotations written in the source, not
  inferred types.
- `rescript-tools doc` keeps ReScript types (`int` apart from `float`), drops
  attributes, and fails with "try to build the project" outside a built
  project. genType maps both `int` and `float` to `number`.
- LemmaScript lowers `|` on numbers without int32 wrap and models `number` as
  an unbounded integer. It passes `$` in identifiers through to Dafny, which
  rejects them. It names `_0` payload fields correctly once the union type is
  named, but genType inlines `result` as an anonymous union in signatures.
- LemmaScript models `switch` fall-through by appending later case bodies;
  with ReScript's always-returning cases, the extra code is unreachable.
- Raw intermediate representation (IR) serialized by `lsc extract` drives
  resolve and the Dafny emitter to output byte-identical with `lsc`'s own.
- The lease example's first version failed its ownership invariant on `Open`:
  `handles + 1 | 0` wraps from 2147483647 to -2147483648, and the compiled
  `step` returned a held lease with -2147483648 handles. With a bound, all
  obligations verify in about 3 seconds. Evidence: `VerifiedLease.res`,
  `make prove`.
- Six source mutants, each breaking one contract, each failed on exactly that
  postcondition. Dafny-compiled JavaScript agreed with production `step` on
  200,000 generated inputs and disagreed with a mutant at once.
- The compiler folded `1000000 + 0 + 2147483647` to `-2146483649` and merged
  two identical match arms, leaving a dead `s.TAG === "Circle";` statement.
- `(a: int, b: int): int => a / b` compiles to `let quot = Primitive_int.div`,
  so it has no body to verify.
- Bun 1.4.3 exhausted its stack at about 50,000 frames of a recursive
  `sumTo`; with a larger Node stack, `sumTo(65536)` returned `-2147450880`.
- `lsc check` exits 1 when an obligation fails, and runs under Bun.
- The six original contracts on `step` are all safety properties, and a
  `step` that refuses every event, with `AlreadyReleased` after release,
  satisfies all six. Exact-effect and progress clauses rule it out; the example
  now proves twelve contracts, still in about 3 seconds. Evidence: the
  `refuses-everything` mutant in `VerifiedLease.mutants.mjs`.
- A contract naming the top-level constant `maxHandles` fails to resolve in
  Dafny ("unresolved identifier"): the unit carries functions only.
- Dafny assumes a postcondition after reporting it, so a mutant that breaks
  two contracts on one return path reports only the first; reopening a released
  lease reports the refusal clauses but not the cause clause.
- `make prove` kills thirteen mutants of the compiled JavaScript in about
  40 seconds, each on exactly its listed contracts. Evidence:
  `res2ls-mutate.mjs`.
- `dafny translate js` omits Dafny's runtime unless given `--include-runtime`,
  and the runtime needs `bignumber.js`. The translated `step` agrees with
  production on 200,000 inputs; breaking its live increment is caught at the
  first disagreement, while breaking an unreachable fall-through copy is not.
  Evidence: `VerifiedLease.differential.mjs`.
- `lemmascript` 0.6.4 pulls in `braces` 3.0.3 (no patched release) and
  `uuid` 9.0.1 with advisories.

## React

- A suite named `React.test.res` failed with "The module or file React can't
  be found"; renamed to `ShoppingList.test.res`, it compiled. A file named
  after a dependency module shadows that module for itself.
- `ReactDOMServer.renderToStaticMarkup` from `@rescript/react` 0.15.0 renders
  components, `useReducer` initial state, and context providers under Bun
  without a Document Object Model (DOM); `className` renders as `class`, and
  `React.string` escapes `<b>` as `&lt;b&gt;`. Evidence:
  `ShoppingList.test.res`.
