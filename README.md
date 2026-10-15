# rescript-skill

*ReScript 12 skills for coding agents, with every claim compiled and tested.*

A router and twelve focused skills that teach agents to write current,
idiomatic ReScript 12.3.1: from variants and bindings to Bun servers and React
components. Every runtime claim is backed by an example that builds with all
warnings as errors and runs under Bun.

______________________________________________________________________

## Why rescript-skill?

ReScript 12 renamed much of the error and standard-library surface, replaced
the build system, and deprecated the `Js.*` modules. Advice remembered from
ReScript 11 now fails a strict build. This catalogue fixes that:

- **Current, not remembered**: the skills teach the 12.x vocabulary, and
  `rescript-12-migration` covers getting there from 11.
- **Evidenced**: the examples compile under warnings `+A`, pass reanalyze's
  dead-code and exception analysis, and run under `bun test` on every commit.
- **Clear routing**: `rescript-router` picks the smallest useful skill instead
  of loading half the catalogue at once.
- **Practical tone**: the skills read like a helpful technical lead, not a
  tutorial.

______________________________________________________________________

## Quick start

### Installation

```bash
git clone https://github.com/leynos/rescript-skill.git
cd rescript-skill
make install-skills
```

This copies the committed `skills/` tree into `~/.codex/skills`. Set
`SKILLS_DEST` to install somewhere else, for example
`make install-skills SKILLS_DEST=~/.claude/skills`.

### Basic usage

Start with the router and describe the task:

```text
Use $rescript-router to route this ReScript task, then help me replace the
nested switches in this config loader.
```

When you already know the pressure point, call the skill directly:

```text
Use $rescript-errors-and-results to design the error variant for this
JSON-backed settings module.
```

______________________________________________________________________

## Features

- **Language skills**: types and modules, errors and results, JavaScript
  interop, async, and the standard library and data.
- **Build and quality skills**: `rescript.json` and the warnings policy,
  migration from ReScript 11, and quality gates including reanalyze.
- **Testing skills**: `bun test` through `rescript-bun`, and fast-check
  properties, including model-based tests.
- **Runtime and UI skills**: Bun servers behind a portable core, and
  `@rescript/react` 0.15.
- **Pitfalls found by experiment**, such as `bun test` silently skipping
  compiled suites and warning 102 resisting local suppression. The
  [verified facts](docs/research/verified-facts.md) record the evidence.

______________________________________________________________________

## Learn more

- [Users' guide](docs/users-guide.md) — installation, invocation, routing, and
  the testing hierarchy.
- [Developers' guide](docs/developers-guide.md) — prerequisites, the Make
  gates, and what the suites cover.
- [Skill catalogue status](docs/skill-catalogue-status.md) — what is active and
  the open questions ahead.
- [ReScript router](skills/rescript-router/SKILL.md) — the main entry point.

______________________________________________________________________

## Acknowledgements

The catalogue's structure follows [`rust-skill`][rust-skill] and
[`python-skill`][python-skill]. It leans on the [ReScript documentation][docs],
[`rescript-bun`][rescript-bun], [fast-check][fast-check], [Sury][sury], and
[`@rescript/react`][rescript-react].

[rust-skill]: https://github.com/leynos/rust-skill
[python-skill]: https://github.com/leynos/python-skill
[docs]: https://rescript-lang.org/docs/manual/introduction
[rescript-bun]: https://github.com/zth/rescript-bun
[fast-check]: https://github.com/dubzzz/fast-check
[sury]: https://github.com/DZakh/sury
[rescript-react]: https://github.com/rescript-lang/rescript-react

______________________________________________________________________

## Licence

ISC — see [LICENSE](LICENSE) for details.

______________________________________________________________________

## Contributing

Contributions are welcome. Read [AGENTS.md](AGENTS.md) for the rules on skills
and executable examples, then run `make install` and `make all` before each
commit. The [developers' guide](docs/developers-guide.md) explains each gate.
