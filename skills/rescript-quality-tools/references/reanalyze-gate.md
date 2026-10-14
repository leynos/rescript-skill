# The reanalyze gate

reanalyze ships with the compiler as `rescript-tools reanalyze` and reads the
compiler's `.cmt` files, so it runs after a build.

## Configuration

```json
{
  "reanalyze": {
    "analysis": ["dce", "exception"],
    "suppress": [],
    "unsuppress": [],
    "transitive": false
  }
}
```

| Field        | Meaning                                                                                                              |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| `analysis`   | `dce` (dead values, types, labels, constructors) and `exception` (unannotated throws); `termination` is experimental |
| `suppress`   | paths whose findings are hidden but still analysed; globs since 12.3                                                 |
| `unsuppress` | re-enables paths inside a suppressed area                                                                            |
| `transitive` | `false` reports only code dead in itself, which is the incremental-cleanup setting                                   |

`rescript-tools reanalyze -config` runs what the file lists; `-json` prints an
array of findings with `name`, `file`, `range` (zero-based), and `message`.
12.1 added `-reactive` caching and a `reanalyze-server` that `-json` uses
transparently.

## Making it a gate

The command exits 0 whatever it finds, so a CI step that only runs it can never
fail. [check-reanalyze.mjs](examples/check-reanalyze.mjs) runs it with
`-config -json`, prints each finding as `path:line:column: name: message`, and
exits 1 if there are any. Its tests feed it a findings array and an empty one,
so a version that always succeeded would fail them.

## What it reports, and the fix for each

| Finding                                                       | Usual fix                                                        |
| ------------------------------------------------------------- | ---------------------------------------------------------------- |
| `Dead Value: x is never used`                                 | delete it; or `@live` if JavaScript or a framework calls it      |
| `Dead Type: t.Case is never constructed`                      | delete the case, or construct it where the design says it occurs |
| `record label never used to read a value`                     | delete the field; `@live` on the type if foreign code reads it   |
| `Dead Value With Side Effects`                                | the binding exists only for its effect; restructure              |
| `might throw X ... not annotated with @throws(X)`             | handle it, return a `result`, or annotate `@throws(X)`           |
| `Incorrect Dead Annotation: x is annotated @dead but is live` | remove `@dead`; the code is used again                           |

Tests in the same project count as uses, so test-only helpers are live. A value
used only by a dead value is itself reported only when `transitive` is `true`.

## Annotations

[ReanalyzeAnnotations.res](examples/ReanalyzeAnnotations.res) shows each:

```rescript
// Reached only from a JavaScript entry point.
@live
let main = (args: array<string>): int => args->Array.length

// A published surface: everything below is a root.
module PublicApi = {
  @@live

  let render = (value: int): string => value->Int.toString
}

// Kept for one more release; reported again if something starts using it.
@dead
let legacyRender = (value: int): string => `#${value->Int.toString}`
```

`@@live` and `@@dead` (12.2+) set the default for the rest of a module or file.
Prefer the narrowest form, and say why in a comment.

For exceptions, `@throws(JsExn)` covers anything JavaScript throws, including
`JsError.throwWithMessage`; `@throws(MyExn)` names a ReScript exception.

## Negative controls

Every annotation should be load-bearing. When adding one, remove it once and
confirm reanalyze reports the finding it was meant to silence; the examples
here were checked that way (dropping `@live` from `main` produces
`Dead Value: main is never used`).
