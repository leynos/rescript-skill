# Monorepos and publishing

## Monorepos with Bun workspaces (12.0+)

Rewatch builds a monorepo from a root `rescript.json` whose `dependencies` list
the local packages. It finds them through `node_modules`, so the package
manager must link them there.

Layout:

```text
repo/
├── bunfig.toml
├── package.json          # "workspaces": ["packages/*"]
├── rescript.json         # "dependencies": ["@repo/core", "@repo/app"]
└── packages/
    ├── core/
    │   ├── package.json  # "name": "@repo/core"
    │   └── rescript.json # "name": "@repo/core", "sources": ["src"]
    └── app/
        ├── package.json  # depends on "@repo/core": "workspace:*"
        └── rescript.json # "dependencies": ["@repo/core"]
```

Bun 1.4's default linker for workspaces is isolated and does not create
`node_modules/@repo/core` at the root, so Rewatch reports "upward traversal did
not find '@repo/core'". Use the hoisted linker:

```toml
[install]
linker = "hoisted"
```

With it, `bun install` symlinks the packages and `rescript build` at the root
builds both. `app` then refers to `RepoCore.Greeting` when `core` is
namespaced. This was verified with Bun 1.4.3 and ReScript 12.3.1.

### Which file controls what

| From the root `rescript.json`                             | From each package's `rescript.json`                     |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `package-specs`, `suffix`, `jsx`, `experimental-features` | `sources`, `dependencies`, `warnings`, `compiler-flags` |

There is no inheritance for the second column: a warnings policy set at the
root does not reach the packages. Put shared output settings at the root and
leave them out of the packages.

`rescript build packages/app` builds one package with the root's output
settings. `rescript build -v` shows how Rewatch resolved the project.

## Generated output

Two defensible policies:

- **Commit production `.res.mjs`** for libraries and anything consumed by
  JavaScript tooling without a ReScript build step. Review generated diffs
  alongside source changes; gate drift by rebuilding in CI and failing on a
  diff. Never hand-edit or reformat generated files.
- **Ignore all `.res.mjs`** for applications and repositories, like this
  one, whose only consumer is a build that compiles ReScript first.

Either way, exclude generated JavaScript from Biome, Prettier, and other
formatters, and from spelling and lint gates.

## Publishing a library

A consumable ReScript package ships:

- its `.res` and `.resi` sources and `rescript.json` (ReScript consumers
  compile from source with their own settings);
- its in-source generated `.res.mjs` (JavaScript consumers and bundlers use
  these directly);
- `@rescript/runtime` as a dependency, at the compiler's exact version.

Checklist:

- `"namespace": true`, and `public` naming the entry modules.
- `.resi` for every public module.
- `package.json` `exports` that admit the in-source generated paths, for
  example `"./src/*": "./src/*"`. Consumers' compilers emit imports such as
  `pkg/src/Foo.res.mjs`; an `exports` map that omits them breaks every consumer
  at runtime, even though compilation succeeds.
- No `dev-dependencies` leaking into `dependencies`, and no Bun or other
  platform bindings in a portable core.
- A packaging test: pack the archive, install it into an empty project, and
  both import the JavaScript and compile a ReScript consumer against it.

Projects consuming such a package must build with `"in-source": true`, because
their `package-specs` determine the import path generated for it.
