# `rescript.json` fields

The fields most projects need, as Rewatch in 12.3.1 reads them. The complete
schema is published at
<https://rescript-lang.org/docs/manual/build-configuration-schema>.

A strict application configuration, close to the one this repository uses:

```json
{
  "name": "my-app",
  "namespace": true,
  "sources": [
    {"dir": "src", "subdirs": true},
    {"dir": "tests", "type": "dev"}
  ],
  "dependencies": [],
  "dev-dependencies": ["rescript-bun"],
  "package-specs": {"module": "esmodule", "in-source": true},
  "suffix": ".res.mjs",
  "warnings": {"number": "+A", "error": "+A"},
  "compiler-flags": []
}
```

## Identity

| Field       | Effect                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------- |
| `name`      | Package name; should equal `package.json` `name`                                                      |
| `namespace` | `true` wraps every module as `Namespace.Module` for consumers; a string sets the namespace explicitly |

_Table 1: Identity fields._

`"name": "@scope/my-lib"` produces the namespace `ScopeMyLib`; `"my-lib"`
produces `MyLib`. Inside the project, code still refers to `Util`, not
`MyLib.Util`.

## Sources

| Form                                  | Meaning                               |
| ------------------------------------- | ------------------------------------- |
| `"sources": ["src"]`                  | `src` only, not its subdirectories    |
| `{"dir": "src", "subdirs": true}`     | `src` recursively                     |
| `{"dir": "src", "subdirs": ["page"]}` | `src` and `src/page`                  |
| `{"dir": "tests", "type": "dev"}`     | compiled locally, never for consumers |
| `{"dir": "src", "public": ["MyLib"]}` | only `MyLib` is visible to consumers  |

_Table 2: Forms of the `sources` field._

Only dev sources can resolve `dev-dependencies`, which is what keeps test
bindings out of production code.

## Dependencies

| Field              | Replaces              | Contains                                   |
| ------------------ | --------------------- | ------------------------------------------ |
| `dependencies`     | `bs-dependencies`     | ReScript packages available to all sources |
| `dev-dependencies` | `bs-dev-dependencies` | ReScript packages for dev sources only     |
| `compiler-flags`   | `bsc-flags`           | extra `bsc` arguments                      |

_Table 3: Dependency fields and the keys they replace._

Each must also be installed through `package.json`. The legacy keys still work
in 12.3.1 but produce a deprecation message on every build.

## Output

| Field                     | Recommended  | Notes                                 |
| ------------------------- | ------------ | ------------------------------------- |
| `package-specs.module`    | `"esmodule"` | `"commonjs"` is the current default   |
| `package-specs.in-source` | `true`       | `false` writes to `lib/<module>/`     |
| `suffix`                  | `".res.mjs"` | distinguishes generated files clearly |

_Table 4: Output fields, with recommended values._

`package-specs` also decides the import paths generated for dependencies. With
`"in-source": false` a dependency is imported from `pkg/lib/es6/...`, which
packages with an `exports` map typically reject.

## Language features

| Field                   | Example                       | Effect                         |
| ----------------------- | ----------------------------- | ------------------------------ |
| `jsx`                   | `{"version": 4}`              | JSX v4, the only version in 12 |
| `jsx.preserve`          | `true`                        | emit JSX syntax for a bundler  |
| `experimental-features` | `{"LetUnwrap": true}`         | enable `let?`                  |
| `gentypeconfig`         | `{"module": "esmodule", ...}` | emit TypeScript declarations   |

_Table 5: Language feature fields._

## Analysis and hooks

| Field           | Effect                                                                                    |
| --------------- | ----------------------------------------------------------------------------------------- |
| `warnings`      | `number` enables or disables, `error` promotes; see the warnings policy                   |
| `reanalyze`     | `analysis`, `suppress`, `unsuppress`, `transitive` for `rescript-tools reanalyze -config` |
| `js-post-build` | `{"cmd": "..."}` run per emitted file, from the config's directory (12.2+)                |

_Table 6: Analysis and hook fields._

Unknown fields produce "Unknown field 'x' found in the package config" and are
ignored, so a typo in a field name silently does nothing beyond the message.
