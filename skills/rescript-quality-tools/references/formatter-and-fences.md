# The formatter and Markdown fences

## `rescript format`

The formatter is part of the compiler and has no configuration. Its output is
the house style.

| Use                        | Command                                     |
| -------------------------- | ------------------------------------------- |
| format the project         | `rescript format`                           |
| check without writing (CI) | `rescript format --check`                   |
| format named files         | `rescript format src/A.res src/A.resi`      |
| format standard input      | `rescript format --stdin .res` (or `.resi`) |

In 12.3.1 a bare `rescript format --check` covers dev sources such as `tests/`;
passing explicit paths is still useful when the gate should also cover files
outside `sources`. `--check` exits 1 and names each file that needs formatting.
Since 12.2 the formatter does not rewrite files that are already formatted, so
running it does not disturb modification times.

Editors run the same formatter through the ReScript language server. Format on
save, and treat a `check` failure in CI as a missing save, not as a style
debate.

## ReScript in Markdown

Documentation drifts unless something checks it. The cheapest check is that each
`rescript`, `res`, or `resi` fence parses and is canonically formatted.

`rescript-tools format-codeblocks` exists for this, but in 12.3.1 it reprints
the entire document, with or without `--stdout`: it escapes `|` in tables, `*`
and `-` in prose, and the `*` characters in YAML frontmatter, and it exits 0
when a fence fails to parse. Running it in place damages the document.

[check-codeblocks.mjs](examples/check-codeblocks.mjs) does the job without
touching prose:

1. Find fences whose info string starts with `rescript`, `res`, or `resi`,
   including fences indented inside list items.
2. Pipe each body through `rescript format --stdin .res` (or `.resi`), which
   exits non-zero on a syntax error.
3. In `--check` mode, fail on any difference; in `--write` mode, replace only
   the fence bodies.

```bash
bun check-codeblocks.mjs --check          # every Markdown file Git knows about
bun check-codeblocks.mjs --write docs/*.md
```

This proves syntax, not types. Fragments that refer to undefined names still
pass, which keeps prose examples short. For claims about behaviour, compile a
complete example module and test it, as this catalogue does under each skill's
`references/examples/`. Use a `text` fence for code that is meant to be wrong.

`rescript-tools extract-codeblocks` lists fences as JSON (`rescript`, `res`, and
`res prelude` blocks, without their info string), which can feed a compile
check if a project wants one.
