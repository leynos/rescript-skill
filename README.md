# rescript-skill

*A compact ReScript 12 skill catalogue for coding agents, with every runtime
claim backed by an example that compiles and runs under Bun.*

This repository carries a ReScript skill set modelled on the
[`rust-skill`](https://github.com/leynos/rust-skill) and
[`python-skill`](https://github.com/leynos/python-skill) catalogues: one
router, focused language skills, and domain and quality skills for testing,
tooling, Bun, and React. It targets ReScript 12.3.1, the current stable
release, and uses Bun 1.4 to compile, execute, and test the examples.

______________________________________________________________________

## Why rescript-skill?

- **Current, not remembered**: ReScript 12 renamed much of the error and
  standard-library surface, replaced the build system, and deprecated the
  `Js.*` modules. Advice written for ReScript 11 now fails a strict build.
  These skills teach the 12.x vocabulary.
- **Evidenced**: examples under `skills/*/references/examples/` compile with
  every warning as an error, pass reanalyze's dead-code and exception analysis,
  and are exercised by `bun test` on every commit.
- **Clear routing**: `rescript-router` directs to the smallest useful skill
  instead of loading half the catalogue at once.
- **Practical tone**: the skills aim to sound like a helpful technical lead,
  not a tutorial.

______________________________________________________________________

## Features

- One router with a routing matrix and a testing hierarchy.
- Five language skills: types and modules, errors and results, JavaScript
  interop, async, and the standard library and data.
- Build and quality skills: `rescript.json` and the warnings policy, migration
  from ReScript 11, and quality gates including reanalyze.
- Testing skills for `bun test` with `rescript-bun` and for fast-check
  properties, including model-based tests.
- Runtime and UI skills for Bun servers behind a portable core, and for
  `@rescript/react` 0.15.
- Pitfalls established by experiment rather than recalled, such as
  `Promise.allSettled` leaving JavaScript rejections unwrapped, warning 102
  resisting local suppression, `bun test` silently skipping compiled suites,
  and out-of-source builds breaking imports of packages with an `exports` map.
  [Verified facts](docs/research/verified-facts.md) lists them with evidence.

______________________________________________________________________

## Quick start

### Installation

```bash
make install-skills
```

This copies the committed `skills/` tree into `~/.codex/skills` (override with
`SKILLS_DEST=...`). It uses `git archive`, so the `.res.mjs` files a local
build leaves beside the examples are never copied. A plain
`cp -a skills/* ~/.codex/skills/` also works on a fresh checkout.

### Basic usage

```text
Use $rescript-router to route this ReScript task, then help me replace the
nested switches in this config loader.
```

When the pressure point is already known, call the skill directly:

```text
Use $rescript-errors-and-results to design the error variant for this
JSON-backed settings module.
```

______________________________________________________________________

## Learn more

- [Users' guide](docs/users-guide.md) — installation, invocation, routing,
  and the testing hierarchy.
- [Developers' guide](docs/developers-guide.md) — working on this
  repository: prerequisites, the Make gates, and what the suites cover.
- [Skill catalogue status](docs/skill-catalogue-status.md) — what is
  active and what is planned.
- [Verified facts](docs/research/verified-facts.md) — toolchain behaviour
  established by experiment, with sources.
- [ReScript router](skills/rescript-router/SKILL.md) — the main entry point.

______________________________________________________________________

## Development

Run the gates through the Makefile rather than invoking tools directly:

| Target                      | What it does                                         |
| --------------------------- | ---------------------------------------------------- |
| `make install`              | Install the frozen Bun dependency graph              |
| `make build`                | Compile every example and suite in place             |
| `make fmt`                  | Format ReScript, Markdown fences, JSON, and Markdown |
| `make check-fmt`            | Check all of the above without writing               |
| `make lint`                 | Compiler, reanalyze, Biome, Markdown, manifests      |
| `make skill-manifest-check` | Validate every shipped `SKILL.md`                    |
| `make test`                 | Run the ReScript example suites and contract suites  |
| `make spelling`             | Enforce the shared en-GB-oxendict spelling policy    |
| `make all`                  | Every commit gate, sequentially                      |

The [developers' guide](docs/developers-guide.md) lists the external tools
(`mdtablefix`, `uv`) and covers each gate in full.

______________________________________________________________________

## Acknowledgements

The catalogue's structure follows `rust-skill` and `python-skill`; its
repository discipline follows `refex`. The skills lean on the
[ReScript documentation](https://rescript-lang.org/docs/manual/introduction)
and compiler changelog, [`rescript-bun`](https://github.com/zth/rescript-bun),
[fast-check](https://github.com/dubzzz/fast-check), [Sury](https://github.com/DZakh/sury),
and [`@rescript/react`](https://github.com/rescript-lang/rescript-react).

______________________________________________________________________

## Licence

ISC — see [LICENSE](LICENSE) for details.

______________________________________________________________________

## Contributing

Read [AGENTS.md](AGENTS.md) before changing tracked files: it lists the commit
gates and the rules for skills and executable examples. Update
[docs/skill-catalogue-status.md](docs/skill-catalogue-status.md) when adding or
retiring a skill.
