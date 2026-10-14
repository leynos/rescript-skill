# Developers' guide

This guide covers working on this repository: the Markdown skill catalogue, the
ReScript examples that back it, the Bun suites that exercise both, and the Make
gates that tie them together. For using the skills, see the
[users' guide](users-guide.md).

## Prerequisites

- Bun 1.4.3, matching `packageManager` in `package.json`. An older Bun
  cannot read the committed `bun.lock`.
- GNU Make, Git, and Bash.
- `mdtablefix` 0.6.1 or later on `PATH`, for Markdown table and wrap
  formatting.
- `uv`, for the pinned Python tools run through `uv tool run`: the spelling
  gate (`typos-config-builder`), `yamllint`, and `skills-ref`. uv fetches
  Python 3.14.7 on first use.

Node is not required. Make invokes every JavaScript tool through
`bun run --bun`.

```bash
make install
make help
```

`make install` runs `bun install --frozen-lockfile` and never changes the
committed graph. Intentional dependency changes use exact versions, regenerate
`bun.lock`, and pass `make all`. The `rescript` and `@rescript/runtime`
versions must match; `tests/package-contracts.test.mjs` enforces it.

## Layout

| Path                                 | Owns                                             |
| ------------------------------------ | ------------------------------------------------ |
| `skills/<name>/SKILL.md`             | The skill manifest and body                      |
| `skills/<name>/references/*.md`      | Longer comparison material                       |
| `skills/<name>/references/examples/` | Compilable ReScript examples                     |
| `skills/<name>/agents/openai.yaml`   | Invocation policy                                |
| `tests/*.test.res`                   | ReScript suites exercising the examples          |
| `tests/*.test.mjs`                   | Repository contract suites                       |
| `tests/support/catalogue.mjs`        | Inventory helpers private to the contract suites |
| `scripts/check-codeblocks.mjs`       | The Markdown ReScript fence gate                 |
| `scripts/check-reanalyze.mjs`        | The reanalyze findings gate                      |
| `**/*.res.mjs`                       | Compiler output beside each source; ignored      |

## The build

`rescript.json` declares one namespaced project, `rescript-skill`, with two dev
sources: `skills` (recursively) and `tests`. Everything is a dev source because
nothing here is published and the examples need dev-only bindings such as
`rescript-bun`. Output is ES modules written in source, as `Foo.res.mjs` beside
`Foo.res`, and ignored by Git.

In-source output is not a preference. A consumer's `package-specs` also govern
how it imports its dependencies: with `"in-source": false` the compiler emits
`sury/lib/es6/src/S.res.mjs`, which Sury's `exports` map does not admit, and
Bun refuses to resolve it. Packages publish their in-source output, so
consumers must build in source too. `make install-skills` copies only committed
files, so the generated `.res.mjs` files never reach an installed catalogue.

The namespace matters for suite naming. Without it, a suite named
`Foo.test.res` cannot refer to a module `Foo`; see
[verified facts](research/verified-facts.md).

Warnings are `+A` with `error: +A`. The `LetUnwrap` experimental feature is
enabled because `rescript-errors-and-results` teaches `let?`. JSX version 4 is
configured for the React examples.

## The gates

`make all` runs these in order and stops at the first failure:

1. `check-fmt`: `rescript format --check` over every tracked or untracked
   `.res`/`.resi`; the fence gate in check mode; Biome's formatter over
   authored JavaScript and JSON; and `mdtablefix --check`.
2. `lint`: a full compile with warnings as errors (`typecheck`), reanalyze,
   `biome lint`, markdownlint, and the skill manifest contract.
3. `test`: compile, then `bun test` with every suite named explicitly.
4. `spelling`: the shared en-GB-oxendict gate. It checks only files Git
   tracks, so stage new files before running it.

`make fmt` applies every formatter. It rewrites only the bodies of ReScript
fences in Markdown, never the prose around them.

### The fence gate

`scripts/check-codeblocks.mjs` finds every fence whose info string starts with
`rescript`, `res`, or `resi`, pipes the body through
`rescript format --stdin .res` (or `.resi`), and fails on a syntax error or, in
check mode, on any formatting difference. Use a `text` fence for code that is
deliberately invalid.

It does not use `rescript-tools format-codeblocks`, which in 12.3.1 reprints
the whole Markdown document, escaping table pipes and frontmatter, and exits 0
on syntax errors.

### The reanalyze gate

`scripts/check-reanalyze.mjs` runs `rescript-tools reanalyze -config -json` and
fails on any finding. `rescript.json` enables the `dce` and `exception`
analyses with an empty `suppress` list, and the package contract keeps it
empty. Fix a finding in source: use the value from a suite, annotate it with
`@live` or `@throws(...)`, or delete it.

### The skill manifest contract

`skill-manifest-check` runs two pinned tools over each `SKILL_DIRS` entry:
`yamllint` 1.38.0 over the extracted frontmatter, then `skills-ref validate` at
a pinned `agentskills` commit. Both run through `uv tool run`, so the first run
needs network access. Override `SKILL_DIRS` to check one skill or a fixture.

## What the suites cover

- `tests/*.test.res` exercise each skill's examples. They open
  `RescriptBun.Test` locally and assert behaviour, not generated JavaScript
  text.
- `tests/skill-contracts.test.mjs` checks every manifest (name, description,
  allowed keys, string metadata with a `globs` hint, the line budget), the
  invocation policy, that the router, routing matrix, and catalogue status name
  every skill, that relative links resolve, that every reference is linked, and
  that every example is linked from prose and exercised by a suite.
- `tests/makefile-contracts.test.mjs` checks that `make -j8 all` runs the
  gates sequentially and stops at the first failure, that `make test` names
  every suite, that tool pins are immutable, and that the manifest gate rejects
  unusable manifests, including one masked by a trailing valid skill.
- `tests/package-contracts.test.mjs` checks exact pins, the compiler and
  runtime match, and the strict `rescript.json` posture, each with negative
  controls built by mutating the real configuration.
- `tests/gate-scripts.test.mjs` drives both gate scripts with fixtures that
  must fail as well as ones that must pass.

## Coverage and auditing

`make coverage` measures the compiled examples under `skills/` with Bun's text
and LCOV reporters. It measures generated JavaScript, not ReScript source lines.
`make audit` runs `bun audit`; `package.json` pins overrides for three
development-only transitive advisories (KaTeX, smol-toml, and js-yaml under
`markdownlint-cli`), following the dispositions recorded in `refex`.

## Adding a skill

1. Create `skills/<name>/SKILL.md` with the manifest, a working stance, a
   decision surface, red flags, and links to references.
2. Add `agents/openai.yaml` with `allow_implicit_invocation: false`.
3. Add examples under `references/examples/` and a suite in `tests/`.
4. Name the skill in the router, the routing matrix, and
   [the catalogue status](skill-catalogue-status.md).
5. Run `make fmt`, then `make all`.
