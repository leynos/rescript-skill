---
name: rescript-build-and-config
description: Use for ReScript 12 project configuration and the Rewatch build — rescript.json fields, namespaces, sources and dev sources, public modules, package-specs and in-source output, suffixes, warnings policy, experimental features, JSX settings, monorepos with Bun workspaces, generated-output policy, and publishing libraries.
metadata:
  globs: "**/rescript.json, **/bsconfig.json, **/package.json, **/bunfig.toml"
---

# ReScript build and configuration

Use this when the question is about `rescript.json`, the `rescript` command, or
how packages fit together, rather than about the code inside them.

## Working stance

- `rescript.json` is the only build description. `bsconfig.json` and the
  `bs-`/`bsc-` keys are legacy; Rewatch warns on them and on unknown fields but
  carries on, so read the build output.
- Turn `namespace` on. Module names are global within a project and leak
  into consumers without it.
- Build in source (`"in-source": true`) with a `.res.mjs` suffix. A project's
  `package-specs` also decide how dependencies are imported, and published
  packages ship in-source output.
- Mark test and tooling directories `"type": "dev"`; only dev sources can
  see `dev-dependencies`.
- Never open a namespace globally through `compiler-flags`. Open locally.
- Choose a warnings policy deliberately and record exceptions with a reason.
  Fix code before relaxing policy.
- Pin `rescript` and `@rescript/runtime` to the same exact version.

## Decision surface

| Need                                               | Setting                                                      |
| -------------------------------------------------- | ------------------------------------------------------------ |
| consumers see `MyLib.Util`, not `Util`             | `"namespace": true` (name from `"name"`, camel-cased)        |
| test-only code and bindings                        | `{"dir": "tests", "type": "dev"}` plus `dev-dependencies`    |
| nested directories                                 | `{"dir": "src", "subdirs": true}`                            |
| one public entry module                            | `{"dir": "src", "public": ["MyLib"]}`                        |
| ES modules beside the source                       | `"package-specs": {"module": "esmodule", "in-source": true}` |
| strict compilation                                 | `"warnings": {"number": "+A", "error": "+A"}`                |
| stricter rules only in continuous integration (CI) | `rescript build --warn-error "+110"`                         |
| `let?`                                             | `"experimental-features": {"LetUnwrap": true}`               |
| React                                              | `"jsx": {"version": 4}`                                      |
| TypeScript types for exports                       | `"gentypeconfig": {...}`                                     |
| a post-processing step per emitted file            | `"js-post-build"` (slow; avoid)                              |

_Table 1: Configuration settings for common needs._

## Commands (Rewatch, 12.x)

| Task                       | Command                            |
| -------------------------- | ---------------------------------- |
| build (default command)    | `rescript` or `rescript build`     |
| watch                      | `rescript watch` (not `build -w`)  |
| clean stale state          | `rescript clean`                   |
| format                     | `rescript format`, `--check` in CI |
| inspect compiler arguments | `rescript compiler-args <file>`    |
| one package in a monorepo  | `rescript build packages/name`     |
| debug project discovery    | `rescript build -v`                |
| the pre-12 Ninja builder   | `rescript-legacy` (avoid)          |

_Table 2: Rewatch commands in ReScript 12._

There is no separate type-check command: a build is the type check.

## Facts that cause confusion

- Warning 109 (top-level expression of non-unit type) is an error by
  default; 26, 27, and 110 (`%todo`) are warnings; 4, 9, 41, and 102 are off
  until `+A`.
- A file in a subdirectory not covered by `sources` is not compiled, and
  references to it report "The module or file X can't be found".
- Two files with the same name anywhere in one package fail the build with
  "Duplicate module name".
- Without `namespace`, a suite named `Foo.test.res` cannot refer to `Foo`.
- Bun 1.4's default isolated linker does not create the root
  `node_modules` symlinks Rewatch needs for workspace packages; set
  `[install] linker = "hoisted"` in `bunfig.toml`.

## Red flags

- `bsconfig.json`, `bs-dependencies`, `bsc-flags`, or `"-open RescriptCore"`.
- `compiler-flags` containing `-open` for a platform library.
- `"warnings": {"number": "-A"}` or a long list of disabled numbers with no
  rationale.
- `rescript` and `@rescript/runtime` at different versions, or caret ranges.
- `"in-source": false` in a project that depends on ReScript packages with
  an `exports` map.
- Hand-edited or reformatted `.res.mjs` files.

## References

- [rescript-json-fields.md](references/rescript-json-fields.md): every
  common field, with its effect and the legacy name it replaced.
- [warnings-policy.md](references/warnings-policy.md): the warnings that
  matter, defaults versus `+A`, local suppression, and CI strictness.
- [monorepos-and-publishing.md](references/monorepos-and-publishing.md):
  Bun workspaces, root versus package settings, committing generated output,
  and shipping a library others can consume.
