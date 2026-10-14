# CI gates

## Ordering

Run cheap, independent checks first and stop at the first failure:

1. `rescript format --check` and the Markdown fence check.
2. `rescript build` with the project's warnings policy.
3. reanalyze (needs the build).
4. Biome over authored JavaScript and JSON.
5. Tests, with every compiled suite named.
6. Documentation and spelling gates.

Use one entry point (`make all` or a package script) that runs these
sequentially; CI calls the same entry point developers do. With Make, invoke
each gate as a recursive `$(MAKE)` step so that `make -j` cannot reorder them.

## `%todo` and warning 110

`%todo` compiles to a `JsError.throwWithMessage` call whose message embeds the
absolute source path and location, and raises warning 110. Under `+A` it stops
the build; with default warnings it only warns. Projects that allow `%todo`
while developing should make CI strict for that one warning:

```bash
rescript build --warn-error "+110"
```

The same flag promotes deprecations (`+3`) once a migration is finished.

## Documentation extraction

`rescript-tools doc <file>` prints a JSON description of a module from its
`.resi` docstrings: items, signatures, and source locations. It suits API
reference generation and checks such as "every public value has a docstring".
Two cautions from 12.3.1: a `private` type is printed without `private`
(`type t = string`), and ReScript does not copy docstrings into the generated
JavaScript at all.

## Biome around ReScript

Biome formats and lints the authored JavaScript (gate scripts, configuration,
JavaScript tests) and JSON (`rescript.json`, `package.json`). Exclude compiler
output:

```json
{
  "files": {
    "includes": ["**/*.mjs", "**/*.json", "!!**/*.res.mjs", "!!node_modules", "!!lib"]
  }
}
```

Biome does not understand ReScript and should never see `.res.mjs`; reformatted
compiler output is churn at best and a broken build at worst.

## Keeping gates honest

- Each wrapper script gets tests with a fixture that must fail.
- Each suppression or annotation gets a comment and, ideally, a negative
  control.
- A gate that has never failed in review is suspicious; break something on a
  branch and watch it go red.
- Tools that exit 0 on findings (reanalyze, `format-codeblocks`) are the
  usual source of false greens.
