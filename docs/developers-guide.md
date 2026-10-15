# Developers' guide

This guide is for contributors working on this repository: the Markdown skill
catalogue, the ReScript examples that back it, the Bun suites that exercise
both, and the Make gates that tie them together. It covers operation, not
rationale. For why the catalogue takes its shape, read
[the catalogue design](rescript-skill-design.md); for what each path holds,
[the repository layout](repository-layout.md); for the binding rules on changes,
[AGENTS.md](../AGENTS.md). For using the skills, see the
[users' guide](users-guide.md), and for every document,
[the contents](contents.md).

## 1. Prerequisites

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

`make prove` additionally needs Dafny 4.11 and Z3 on `PATH`; Dafny 4.11 expects
Z3 4.12.1. Neither is needed for `make all`, and continuous integration (CI)
runs neither, so the proofs are checked only when a contributor runs
`make prove` locally (see [section 4.3](#43-the-proof-gate)).

```bash
make install
make help
```

`make install` runs `bun install --frozen-lockfile` and never changes the
committed graph. Intentional dependency changes use exact versions, regenerate
`bun.lock`, and pass `make all`. The `rescript` and `@rescript/runtime`
versions must match; `tests/package-contracts.test.mjs` enforces it.

## 2. The build

`make build` compiles the single namespaced project declared in
`rescript.json`. Its two dev sources are `skills` (recursively) and `tests`.
Output is ES modules written in source as `Foo.res.mjs`, beside `Foo.res`, and
genType writes `Foo.gen.ts` beside any `@genType` source. Both are ignored by
Git. [The catalogue design](rescript-skill-design.md#4-build-decisions)
explains why the build is namespaced, in source, and strict.

Two consequences matter day to day:

- a suite named `Foo.test.res` can refer to the module `Foo` only because of
  the namespace;
- warnings are `+A` with `error: +A`, so any warning fails the build.

## 3. The commit gates

`make all` runs these in order and stops at the first failure, even under
`make -j`:

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

## 4. Gate details

### 4.1. The fence gate

`check-codeblocks.mjs` finds every fence whose info string starts with
`rescript`, `res`, or `resi`, pipes the body through
`rescript format --stdin .res` (or `.resi`), and fails on a syntax error or, in
check mode, on any formatting difference. Use a `plaintext` fence for code that
is deliberately invalid.

It does not use `rescript-tools format-codeblocks`, which in 12.3.1 reprints
the whole Markdown document, escaping table pipes and frontmatter, and exits 0
on syntax errors.

### 4.2. The reanalyze gate

`check-reanalyze.mjs` runs `rescript-tools reanalyze -config -json` and fails
on any finding. `rescript.json` enables the `dce` (dead-code elimination) and
`exception` analyses with an empty `suppress` list, and the package contract
keeps it empty. Fix a finding in source: use the value from a suite, annotate
it with `@live` or `@throws(...)`, or delete it.

### 4.3. The proof gate

`make prove` is not part of `make all`, and CI does not run it: Dafny and Z3
are system tools that the Bun toolchain does not provide. A change that breaks
a proof therefore passes `make all` and CI. Contributors must run `make prove`
locally before committing any change to a proved module (`PROOFS` in the
Makefile), to `res2ls-bridge.mjs` or `res2ls-correspond.mjs`, or to the
ReScript, TypeScript, or LemmaScript pins.

To install the provers:

- Dafny 4.11 as a .NET tool:
  `dotnet tool install --global dafny --version 4.11.0`.
- Z3 4.12.1 from the
  [Z3 release page](https://github.com/Z3Prover/z3/releases/tag/z3-4.12.1),
  with its `bin/` directory on `PATH`. Dafny reports a missing Z3 as a
  resolution error, not as a missing tool.

The target checks for both before doing anything else and stops with a message
naming the missing one. For each module in `PROOFS` it:

1. builds the project;
2. installs the pinned LemmaScript from `tools/verification/` with a frozen
   lockfile;
3. regenerates the verification unit into an empty `.verify/` with
   `res2ls-bridge.mjs`;
4. runs `res2ls-correspond.mjs` to show the unit's bodies are the compiled
   JavaScript;
5. runs `lsc check --backend=dafny`.

Every step fails the target on error. LemmaScript lives in its own package
because its transitive graph carries advisories with no patched release
(`braces` through `ts-morph`); keeping it out of the root lockfile leaves
`make audit` meaningful.

### 4.4. The skill manifest contract

`skill-manifest-check` runs two pinned tools over each `SKILL_DIRS` entry:
`yamllint` 1.38.0 over the extracted frontmatter, then `skills-ref validate` at
a pinned `agentskills` commit. Both run through `uv tool run`, so the first run
needs network access. Override `SKILL_DIRS` to check one skill or a fixture.

## 5. What the suites cover

- `tests/*.test.res` exercise each skill's examples. They open
  `RescriptBun.Test` locally and assert behaviour, not generated JavaScript
  text.
- `tests/skill-contracts.test.mjs` checks every manifest (name, description,
  allowed keys, string metadata with a `globs` hint, the line budget), the
  invocation policy, that the router, routing matrix, and catalogue status name
  every skill, that relative links resolve, that every reference is linked, and
  that every example is linked from prose and exercised by a suite, and that
  every `*Core.res` example stays free of runtime bindings.
- `tests/makefile-contracts.test.mjs` checks that `make -j8 all` runs the
  gates sequentially and stops at the first failure, that `make test` names
  every suite, that tool pins are immutable, and that the manifest gate rejects
  unusable manifests, including one masked by a trailing valid skill. It also
  checks that `make install-skills` copies only committed files and that no
  `.res.mjs` is tracked.
- `tests/package-contracts.test.mjs` checks exact pins, the compiler and
  runtime match, and the strict `rescript.json` posture, each with negative
  controls built by mutating the real configuration.
- `tests/gate-scripts.test.mjs` drives both gate scripts with fixtures that
  must fail as well as ones that must pass.
- `tests/deductive-verification.test.mjs` drives the verification bridge and
  audit without a prover: contract extraction from the real parse tree,
  signature parsing, the typing contracts the unit carries, the trusted `int32`
  model against `| 0`, and audit failures for drifted bodies, unverified
  functions, changed inputs, and edited units.
- `tests/migration-tool.test.mjs` builds a ReScript 11-style module in a
  scratch project (with `node_modules` symlinked from the checkout) and runs
  the real `rescript-tools migrate` over it, pinning what
  `rescript-12-migration` says the tool does and does not rewrite.

## 6. Coverage and auditing

`make coverage` measures the compiled examples under `skills/` with Bun's text
and LCOV reporters. It measures generated JavaScript, not ReScript source lines.
`make audit` runs `bun audit`; `package.json` pins overrides for three
development-only transitive advisories (KaTeX, smol-toml, and js-yaml under
`markdownlint-cli`), following the dispositions recorded in `refex`.

## 7. Documentation

Prose follows the df12 documentation style: en-GB-oxendict spelling, sentence
case headings, no first- or second-person pronouns outside `README.md`,
acronyms expanded on first use, a caption under every table and diagram, and
`plaintext` for fences that hold no code. Update [the contents](contents.md)
when adding, renaming, or removing a document, and
[the repository layout](repository-layout.md) when the tree changes shape.

## 8. Adding a skill

1. Create `skills/<name>/SKILL.md` with the manifest, a working stance, a
   decision surface, red flags, and links to references.
2. Add `agents/openai.yaml` with `allow_implicit_invocation: false`.
3. Add examples under `references/examples/` and a suite in `tests/`.
4. Name the skill in the router, the routing matrix, and
   [the catalogue status](skill-catalogue-status.md).
5. Run `make fmt`, then `make all`.
