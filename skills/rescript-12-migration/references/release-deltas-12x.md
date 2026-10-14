# Release deltas, 12.0.1 to 12.3.1

Changes after 12.0.0 that affect how code is written, built, or analysed, taken
from `node_modules/rescript/CHANGELOG.md`. Use this to judge whether a project
pinned to an earlier 12.x needs anything beyond a version bump.

## 12.0.1 and 12.0.2

- Rewatch warns about unsupported and unknown `rescript.json` fields.
- Duplicate module names are reported instead of panicking.
- `@val` and `@scope` bindings are emitted so that a local binding cannot
  shadow the global (through `globalThis` where needed).
- The formatter normalizes `a->f(_, x)` placeholders to `a->f(x)`.
- `let?` uses the pattern's own variable names in generated code.
- Reanalyze's optional-argument analysis became liveness-aware.

## 12.1.0

- `@unboxed` can discriminate `Set`, `Map`, `WeakSet`, and `WeakMap`.
- Reanalyze gained reactive incremental analysis (`-reactive`) and a
  long-lived `reanalyze-server`; `rescript-tools reanalyze -json` delegates to
  it transparently.
- `js-post-build` is supported by Rewatch; `${file}` is an absolute path.
- Rewatch logs errors and warnings to standard error, enables
  `--create-sourcedirs` by default, and checks that a `.res` and its `.resi`
  agree in filename case.
- `es6` and `es6-global` package specs produce a deprecation warning.

## 12.2.0

- `Array.zip`, `Array.unzip`, `Array.zipBy`, and `Array.partition`.
- Breaking for build hooks: `js-post-build` receives the output path that
  matches `in-source`, and runs from the directory of the `rescript.json` that
  defines it.
- Reanalyze: scoped `@@live` and `@@dead` annotations.
- Rewatch detects duplicate packages and watches only source folders.
- The formatter no longer rewrites files that are already formatted.
- Fixes for `null` matching the `Object` case in untagged variants.

## 12.3.0 and 12.3.1

- Reanalyze `suppress` and `unsuppress` accept glob patterns
  (`"src/generated/**"`).
- `String.localeCompare` takes optional `~locales` and `~options`.
- Better inference for `dict{}` and `async`, removing some annotations.
- Builds are allowed while a watcher runs; lock handling fixes.
- 12.3.1: interface and module inclusion, type equality, and coercion now
  enforce function arity, which can surface latent mismatches between a `.res`
  and its `.resi`; argument evaluation order in inlined calls is fixed;
  optional-argument defaults are computed when their own function group is
  applied.

## Looking ahead

ReScript 13 is in alpha (13.0.0-alpha.6 as of October 2026). The `Js.*` modules
and the deprecated bitwise functions carry "will be removed in v13" messages;
clearing them now removes the bulk of that future migration.
