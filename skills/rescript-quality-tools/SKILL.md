---
name: rescript-quality-tools
description: Use for ReScript 12 quality gates — the official formatter and its check mode, formatting and parsing ReScript fences in Markdown, warnings as errors and `%todo`, reanalyze dead-code and exception analysis as a CI gate with `@live`, `@dead`, and `@throws`, documentation extraction with rescript-tools doc, and Biome for the authored JavaScript around a ReScript project.
metadata:
  globs: "**/rescript.json, **/Makefile, **/biome.json, **/*.res, **/*.resi, **/*.md"
---

# ReScript quality tools

Use this when the question is about the gates around ReScript code: what to
run, in which order, and how to make each one fail when it should.

## Working stance

- The compiler is the main linter. Choose the warnings policy first
  (`rescript-build-and-config`); every other tool adds to it.
- Use the official formatter only. Do not add Prettier rules or style
  opinions on top of `rescript format`.
- A gate is only as good as its failure path. `rescript-tools reanalyze`
  and `rescript-tools format-codeblocks` both exit 0 with problems; wrap them
  in a script that fails, and test the script with a fixture that must fail.
- Fix findings in source. Annotate deliberate cases (`@live`, `@dead`,
  `@throws`) with a comment; never widen a suppression list to go green.
- Run gates sequentially. The build output and analysis caches are shared.

## The gate set

| Gate                  | Command                                        | Fails on                                      |
| --------------------- | ---------------------------------------------- | --------------------------------------------- |
| format                | `rescript format --check`                      | any unformatted `.res`/`.resi`, dev included  |
| Markdown fences       | `bun $GATES/check-codeblocks.mjs --check`      | a fence that does not parse or is unformatted |
| compile               | `rescript build` with `"error": "+A"`          | any enabled warning                           |
| dead code, exceptions | `bun $GATES/check-reanalyze.mjs` after a build | any reanalyze finding                         |
| authored JS and JSON  | `biome check` excluding `**/*.res.mjs`         | Biome rules                                   |
| tests                 | `bun test` with explicit suites                | see `rescript-bun-testing`                    |

_Table 1: The quality gates, their commands, and what fails each._

[check-codeblocks.mjs](references/examples/check-codeblocks.mjs) and
[check-reanalyze.mjs](references/examples/check-reanalyze.mjs) are the scripts
this catalogue's own repository runs, tested against fixtures that must fail.
`$GATES` is the directory holding them: copy them into a project's own tools
directory, or, in this repository, use
`skills/rescript-quality-tools/references/examples`, which the Makefile names
`GATES`. Run both from the project root.

## Facts about the tools (12.3.1)

- `rescript format --check` with no paths checks every source, dev sources
  included; `--stdin .res` formats standard input and exits 1 on a syntax error.
- `rescript-tools format-codeblocks` reprints the whole Markdown document,
  escaping table pipes and frontmatter, and exits 0 on syntax errors. Do not
  run it on prose; format each fence through `rescript format --stdin`.
- `rescript-tools reanalyze -config` runs the analyses listed in
  `rescript.json`; `-json` prints findings as a JSON array; the exit status is
  0 regardless.
- reanalyze reports values used only from JavaScript as dead, `mod` and
  `JSON.stringifyAny` as possibly throwing, and record labels that are built
  but never read.
- `rescript-tools doc <file>` prints JSON documentation from `.resi`
  docstrings, but renders a `private` type as plain (`type t = string`).

## Red flags

- `reanalyze` in continuous integration (CI) with no check of its output.
- `"suppress": ["src"]` or other broad suppression to make the analyser
  quiet.
- `@live` on code nothing calls, rather than deleting it.
- Prettier or Biome configured to format `.res.mjs` output.
- `%todo` merged because the build only warned.
- A formatter "check" that rewrites files.

## References

- [formatter-and-fences.md](references/formatter-and-fences.md): the
  formatter's modes, editor and CI use, and the Markdown fence gate.
- [reanalyze-gate.md](references/reanalyze-gate.md): configuration, the
  analyses, annotations, the gate script, and negative controls.
- [ci-gates.md](references/ci-gates.md): ordering, `%todo`, documentation
  extraction, Biome, and keeping gates honest.
- Executable examples:
  [ReanalyzeAnnotations.res](references/examples/ReanalyzeAnnotations.res), [check-reanalyze.mjs](references/examples/check-reanalyze.mjs),
  and [check-codeblocks.mjs](references/examples/check-codeblocks.mjs).
