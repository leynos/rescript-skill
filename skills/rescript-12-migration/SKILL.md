---
name: rescript-12-migration
description: Use when upgrading a ReScript 11 project to 12.3.1, or when 12.x deprecation warnings appear — removing @rescript/core, bsconfig.json and bs- keys, rescript-tools migrate, Js and raise replacements, OrThrow renames, operator and attribute changes, the Rewatch command changes, and what changed between 12.0 and 12.3.
metadata:
  globs: "**/rescript.json, **/bsconfig.json, **/package.json, **/*.res, **/*.resi"
---

# ReScript 12 Migration

Use this to move a project from ReScript 11 to 12.3.1, or to clear 12.x
deprecation warnings. Once a project is clean on 12, route ordinary questions
to the language skills instead.

## Working stance

- Upgrade the toolchain first, then let the compiler drive. Every deprecation
  warning names its replacement.
- Run the migration tool before hand-editing. It rewrites most renamed calls
  mechanically and consistently.
- Keep deprecation warnings as warnings until the tool has run: it needs a
  successful build, and `+A` with `error: +A` would stop that build.
- Migrate in commits a reviewer can follow: configuration, then tool output,
  then manual fixes, then the stricter warnings policy.
- Treat removed features (`.ml` files, JSX v3, `@bs.*`, `lazy` syntax) as
  blockers to clear before the version bump.

## Procedure

1. Confirm the prerequisites: ReScript 11 in uncurried mode, no `.ml`
   sources, Node 20.11 or later if Node is still in the toolchain.
2. Pin `rescript` and `@rescript/runtime` to `12.3.1`. Remove
   `@rescript/core` and `@rescript/std`.
3. Rename `bsconfig.json` to `rescript.json`; rename `bs-dependencies`,
   `bs-dev-dependencies`, and `bsc-flags`; delete `-open RescriptCore`; set
   `jsx.version` to 4 and drop `jsx.mode`.
4. Build. Fix errors (removed APIs and syntax) until the build succeeds
   with warnings.
5. Run `rescript-tools migrate-all .`, rebuild, and review the diff.
6. Fix what the tool leaves: notably `lsl`, `land`, `lor`, and `lxor` (use
   `<<`, `&&&`, `|||`, `^^^` or `Int.shiftLeft`), and behavioural changes it
   cannot see, such as `BigInt.fromFloat` now returning an option.
7. Update scripts: `rescript build -w` becomes `rescript watch`;
   `rescript format -all` becomes `rescript format`.
8. Only then tighten the warnings policy (`rescript-build-and-config`).

## What the tool does and does not do

Verified against 12.3.1 by `tests/migration-tool.test.mjs`:

| Rewritten automatically                    | Left for you                                   |
| ------------------------------------------ | ---------------------------------------------- |
| `Js.log` → `Console.log`                   | `lsl`, `land`, and the other bitwise functions |
| `raise` → `throw`                          | `Belt.*` calls (not deprecated)                |
| `Js.Json.parseExn` → `JSON.parseOrThrow`   | semantic changes in return types               |
| `Option.getExn` → `Option.getOrThrow`      | configuration files                            |
| `Js.Exn.Error(e)` → `JsExn(e)`             | removed syntax and `.ml` files                 |
| `Bool.fromStringExn` → `fromStringOrThrow` |                                                |

It refuses to run until the project has built:
`build artifacts could not be found`.

## Red flags during migration

- `@rescript/core` still in `package.json` or `rescript.json`.
- `-open RescriptCore` or `-open RescriptBun` left in `compiler-flags`.
- Warnings disabled wholesale (`-3`) and never re-enabled after migration.
- Generated `.res.mjs` diffs committed without reading them; the move from
  `Math.imul` to plain int32 multiplication and new operator output are
  expected, other changes deserve a look.
- A `rescript-legacy` script kept "just in case".

## References

- [upgrade-checklist.md](references/upgrade-checklist.md): configuration,
  dependency, command, and CI changes, with before-and-after examples.
- [api-renames.md](references/api-renames.md): standard library, exception,
  attribute, and operator renames, and removed features.
- [release-deltas-12x.md](references/release-deltas-12x.md): what changed
  in 12.0.1 through 12.3.1 that affects code, builds, and analysis.
