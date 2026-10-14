# Upgrade checklist

## Dependencies

```json
{
  "devDependencies": {
    "rescript": "12.3.1",
    "@rescript/runtime": "12.3.1"
  }
}
```

- Remove `@rescript/core`: the standard library now ships with the compiler.
- Remove `@rescript/std`: `@rescript/runtime` replaces it.
- `@rescript/runtime` is a dependency of `rescript`, but pin it yourself.
  Package managers that do not hoist transitive dependencies (pnpm, or Bun
  workspaces under the isolated linker) need it as a direct dependency for
  generated imports such as `@rescript/runtime/lib/es6/Stdlib_Array.js` to
  resolve. A library should list it in `dependencies`.
- Platform binaries now come from optional packages such as
  `@rescript/linux-x64`; install with optional dependencies enabled.
- Upgrade ReScript dependencies to releases that support 12. For example,
  `rescript-bun` 2.x requires `rescript >= 12.0.0-alpha.4`, and
  `@rescript/react` 0.15 requires React 19.2 or later.

## Configuration

Before (ReScript 11):

```json
{
  "name": "my-app",
  "sources": "src",
  "bs-dependencies": ["@rescript/core", "@rescript/react"],
  "bsc-flags": ["-open RescriptCore"],
  "jsx": {"version": 4, "mode": "automatic"},
  "package-specs": {"module": "es6", "in-source": true},
  "suffix": ".res.mjs"
}
```

After (ReScript 12):

```json
{
  "name": "my-app",
  "namespace": true,
  "sources": [{"dir": "src", "subdirs": true}],
  "dependencies": ["@rescript/react"],
  "compiler-flags": [],
  "jsx": {"version": 4},
  "package-specs": {"module": "esmodule", "in-source": true},
  "suffix": ".res.mjs"
}
```

- `bsconfig.json` → `rescript.json`.
- `bs-dependencies` → `dependencies`; `bs-dev-dependencies` →
  `dev-dependencies`; `bsc-flags` → `compiler-flags`.
- `"module": "es6"` and `"es6-global"` are deprecated spellings; use
  `"esmodule"`.
- `experimental-features` keys are kebab-case at the top level, with
  PascalCase feature names: `"experimental-features": {"LetUnwrap": true}`.
- Rewatch prints a message for deprecated and unknown fields but continues;
  read the first lines of build output after the change.

## Commands and scripts

| ReScript 11              | ReScript 12                             |
| ------------------------ | --------------------------------------- |
| `rescript build -w`      | `rescript watch`                        |
| `rescript format -all`   | `rescript format`                       |
| `rescript format -check` | `rescript format --check`               |
| `rescript convert`       | removed; convert `.ml` with ReScript 11 |
| `rescript dump`          | removed; use `bsc` directly             |
| `--compiler-args`        | `rescript compiler-args <file>`         |
| `rescript build --dev`   | no-op; dev sources always build locally |

The Ninja builder survives as `rescript-legacy`, mainly for projects blocked on
PPX tooling. Prefer fixing the blocker.

## Migration commands

```bash
# Requires a successful build first.
rescript-tools migrate-all .
# Preview one file:
rescript-tools migrate src/Config.res --stdout
```

## CI

- Pin Bun or Node and the compiler exactly; regenerate the lockfile once.
- Run `rescript format --check` (dev sources included in 12.3.1).
- Add `rescript build --warn-error "+3"` once the migration is complete, so
  no new deprecated calls land.
- Add the reanalyze gate (`rescript-quality-tools`) if the project wants
  dead-code and exception analysis enforced.
