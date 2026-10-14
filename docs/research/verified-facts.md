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
  to `lib/es6/<source path>.res.mjs`, leaving source directories clean.
- A dev source can reference modules in another dev source of the same
  project (`tests/` referring to `skills/**`).

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
