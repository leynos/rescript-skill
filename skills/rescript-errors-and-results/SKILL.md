---
name: rescript-errors-and-results
description: Use for ReScript 12 failure design — option versus result versus exceptions, closed error variants, `let?` early returns, `throw`, catching JavaScript errors as `JsExn`, `JsError`, `@throws`, and reanalyze exception analysis.
metadata:
  globs: "**/*.res, **/*.resi, **/rescript.json"
---

# ReScript Errors and Results

Use this when the question is "what failure shape belongs at this boundary?",
not "how do I write a `switch`".

## Working stance

- Absence is `option`. Expected, recoverable failure is `result` with a
  closed variant for the error, not a string.
- Exceptions are for broken invariants and for crossing into JavaScript
  code that throws. Do not use them for validation.
- Catch JavaScript throws once, next to the binding, and convert them to
  `result`. Everything further in sees data, not control flow.
- Render an error to text only at the edge: a log line, an HTTP body, a CLI
  message. Inside the program, keep the variant so callers can match.
- Treat `*OrThrow` functions (`Option.getOrThrow`, `JSON.parseOrThrow`,
  `Result.getOrThrow`) as assertions. Each use needs a reason the failure
  cannot happen, or a handler.

## Decision surface

| Situation                                   | Default move                                    |
| ------------------------------------------- | ----------------------------------------------- |
| a value may be missing                      | `option<'a>`                                    |
| input can be wrong in known ways            | `result<'a, closedErrorVariant>`                |
| several fallible steps in sequence          | `let?` (experimental) or `Result.flatMap`       |
| many independent results to combine         | `Result.all` / `Option.all`                     |
| layers with different error types           | `Result.mapError` into the caller's variant     |
| a JavaScript API throws                     | `try ... catch { \| JsExn(e) => ... }` → result |
| JavaScript callers need an `Error` instance | `JsError.throwWithMessage` / `JsError.panic`    |
| an internal invariant is broken             | a ReScript `exception` plus `throw`             |
| a promise can reject                        | see `rescript-async`                            |

## ReScript 12 vocabulary

ReScript 12 renamed the error surface. Use the new names; the old ones are
deprecated and fail a `+A` warning-as-error build with warning 3.

- `throw(MyExn(...))`, not `raise`.
- `JsExn(e)` catches anything JavaScript throws; `e: JsExn.t` is `unknown`.
  Read it with `JsExn.message`, `JsExn.name`, and `JsExn.stack`, which all
  return `option<string>`.
- `JsError` creates and throws real JavaScript `Error` objects:
  `JsError.make`, `JsError.throw`, `JsError.throwWithMessage`, `JsError.panic`,
  and the `JsError.TypeError` family.
- `*Exn` helpers became `*OrThrow`. `Result.getOrThrow` now throws a
  JavaScript `Error` and takes an optional `~message`.
- `@raises` became `@throws`.

## `let?`

`let?` unwraps `Ok`/`Some` and returns the `Error`/`None` early. It is
experimental in 12.x and must be enabled per project:

```json
{
  "experimental-features": {"LetUnwrap": true}
}
```

```rescript
let fromEnv = (env: dict<string>): result<config, configError> => {
  let? Ok(host) = env->lookup("HOST")->Result.flatMap(parseHost)
  let? Ok(port) = env->lookup("PORT")->Result.flatMap(parsePort)
  Ok({host, port})
}
```

The compiler enforces two rules, so plan the types first:

- every `let?` in a function unwraps the same container as the function
  returns: no `let? Some(...)` in a function returning `result`;
- for `result`, every step shares one error type. Lift sub-errors with
  `Result.mapError` before unwrapping.

In a library that consumers compile, prefer `Result.flatMap` until the feature
leaves experimental status: the flag is per project and is not inherited.

## Exceptions crossing into JavaScript

A ReScript exception compiles to a plain object `{RE_EXN_ID, _1, ..., Error}`,
not an `Error` instance. JavaScript callers that test `instanceof Error` or read
`.message` see nothing useful. At a public JavaScript boundary, throw with
`JsError` or return a result-shaped value.

## Red flags

- `result<'a, string>` in a module other code matches on: callers end up
  parsing messages.
- `Option.getOrThrow` or `JSON.parseOrThrow` with no handler and no comment.
- `try ... catch { | _ => ... }` swallowing every exception, including
  invariant failures.
- `Int.fromString` or `Float.fromString` used as validation: both wrap
  `parseInt`/`parseFloat` and accept trailing garbage such as `"80abc"`.
- A ReScript `exception` thrown across a JavaScript API boundary.
- `@throws` missing where reanalyze's exception analysis reports one; fix the
  annotation or the handling rather than suppressing the report.

## References

- [exceptions-and-jsexn.md](references/exceptions-and-jsexn.md): exception
  declaration, catching by constructor, `JsExn` payloads, `JsError`, runtime
  shape, and reanalyze's `@throws` contract.
- [result-pipelines.md](references/result-pipelines.md): error variants per
  layer, `let?` versus `flatMap`, aggregation, and async result helpers.
- Executable examples:
  [ConfigParsing.res](references/examples/ConfigParsing.res) and
  [JsBoundary.res](references/examples/JsBoundary.res).
