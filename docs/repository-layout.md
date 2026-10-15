# Repository layout

This document is the canonical map of the repository: what each major path
holds, who owns it, and which paths are generated. It describes the committed
tree; local build output is listed only where contributors meet it.

For screen readers: the tree below lists the top-level directories and the
files inside `skills/` that every skill follows.

```plaintext
.
├── skills/                  shipped catalogue, one directory per skill
│   └── <name>/
│       ├── SKILL.md          manifest and body
│       ├── agents/openai.yaml
│       └── references/
│           ├── *.md          longer reference material
│           └── examples/     compiled ReScript and shipped scripts
├── tests/                   ReScript example suites and repository contracts
│   └── support/             helpers private to the contract suites
├── tools/verification/      pinned LemmaScript toolchain for `make prove`
├── docs/                    guides, design, layout, status, and research
└── .github/workflows/       continuous integration
```

_Figure 1: The top-level layout and the shape of one skill._

| Path                                                                      | Responsibility                                                         | Ownership boundary                                                     |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `skills/<name>/SKILL.md`                                                  | Skill manifest (YAML frontmatter) and body, within 160 lines.          | Shipped to agents; the directory name equals the manifest `name`.      |
| `skills/<name>/agents/openai.yaml`                                        | Invocation policy.                                                     | Shipped; only `rescript-router` allows implicit invocation.            |
| `skills/<name>/references/*.md`                                           | Comparison tables and worked material too long for `SKILL.md`.         | Shipped; every file is linked from its skill.                          |
| `skills/<name>/references/examples/*.res`, `*.resi`                       | Complete, compiling ReScript examples.                                 | Shipped; each is exercised by a suite in `tests/`.                     |
| `skills/rescript-quality-tools/references/examples/check-*.mjs`           | The fence gate and the reanalyze gate.                                 | Shipped, and run by this repository's Makefile.                        |
| `skills/rescript-deductive-verification/references/examples/res2ls-*.mjs` | The verification bridge and correspondence audit.                      | Shipped, and run by `make prove`.                                      |
| `tests/*.test.res`                                                        | ReScript suites exercising the examples.                               | Dev sources; never shipped.                                            |
| `tests/*.test.mjs`                                                        | Repository contract suites, one invariant family per file.             | Never shipped; each suite carries its own negative controls.           |
| `tests/support/`                                                          | Inventory and example-loading helpers.                                 | Private to the suites that import them.                                |
| `tools/verification/`                                                     | `package.json` and `bun.lock` pinning LemmaScript.                     | Kept apart from the root dependency graph and its audit.               |
| `docs/contents.md`                                                        | Index of the documentation set.                                        | Updated whenever a document is added, renamed, or removed.             |
| `docs/research/verified-facts.md`                                         | Toolchain behaviour established by experiment.                         | Evidence log; entries name how each fact was verified.                 |
| `rescript.json`                                                           | Namespace, sources, output, warnings, genType, and reanalyze settings. | Single ReScript project; `tests/package-contracts.test.mjs` guards it. |
| `package.json`, `bun.lock`                                                | Exact development dependencies and the frozen graph.                   | Root toolchain; `make install` never changes it.                       |
| `Makefile`                                                                | Contributor entry points and the sequential commit gates.              | The interface contributors and continuous integration (CI) use.        |
| `bunfig.toml`                                                             | Coverage exclusions.                                                   | Test configuration.                                                    |
| `biome.json`                                                              | Policy for authored JavaScript and JSON.                               | Excludes compiler output.                                              |
| `.markdownlint.jsonc`, `.markdownlintignore`                              | Markdown rule policy and exclusions.                                   | Documentation gate.                                                    |
| `typos.local.toml`, `typos.toml`                                          | Local spelling exceptions and the generated shared policy.             | Edit only `typos.local.toml`; `make spelling` regenerates the other.   |
| `.github/workflows/ci.yml`                                                | Continuous integration: `make all` and `make audit`.                   | Read-only verification; does not run `make prove`.                     |
| `AGENTS.md`                                                               | Rules for agents and contributors changing tracked files.              | Repository-wide policy.                                                |
| `README.md`, `CHANGELOG.md`, `LICENSE`                                    | Introduction, change record, and ISC terms.                            | Project metadata.                                                      |

_Table 1: Paths, their responsibilities, and their ownership boundaries._

## Generated and local paths

These paths are produced by tools, ignored by Git, and never shipped:

| Path                       | Produced by                                      |
| -------------------------- | ------------------------------------------------ |
| `**/*.res.mjs`             | The ReScript compiler, beside each source.       |
| `**/*.gen.ts`              | genType, beside each `@genType` source.          |
| `lib/`                     | The ReScript build's intermediate files.         |
| `.verify/`                 | `make prove`: verification units and Dafny.      |
| `coverage/`                | `make coverage`.                                 |
| `node_modules/`            | `make install`, and `make prove` under `tools/`. |
| `.uv-cache/`, `.uv-tools/` | The pinned Python tools run through `uv`.        |
| `.typos-oxendict-base.*`   | `make spelling`.                                 |

_Table 2: Generated and local paths._

`make install-skills` copies the committed `skills/` tree with `git archive`,
so none of these reach an installed catalogue.
