# Exceptions and `JsExn`

ReScript has two kinds of thrown value, and the distinction drives how you
catch, annotate, and expose them.

## ReScript exceptions

An exception is an extensible variant constructor:

```rescript
exception InvariantBroken(string)
exception RecordNotFound({id: string, table: string})

let fail = () => throw(InvariantBroken("cursor moved backwards"))
```

Catch by constructor in a `try` or in a `switch` with an `exception` case. A
`switch` keeps the success path and the failure path side by side:

```rescript
let ratioOrNone = (n, d) =>
  switch checkedRatio(n, d) {
  | ratio => Some(ratio)
  | exception InvariantBroken(_) => None
  }
```

Unmatched exceptions propagate unchanged, so a narrow handler is safe. A
`| _ =>` handler is not: it also catches `Assert_failure`, `Not_found`, and
JavaScript errors you did not anticipate.

Built-in exceptions still exist (`Not_found`, `Invalid_argument`, `Failure`,
`Division_by_zero`, `Assert_failure`). `assert(cond)` is an ordinary function
call in ReScript 12 and throws `Assert_failure` with the source location.

### Runtime shape

ReScript 12 compiles `throw(InvariantBroken("x"))` to:

```javascript
throw {
  RE_EXN_ID: InvariantBroken,
  _1: "x",
  Error: new Error()
};
```

The thrown value is a plain object that carries an `Error` for the stack trace.
It is not an `Error` instance, so JavaScript code that checks
`instanceof Error` or reads `.message` gets nothing. Keep ReScript exceptions
inside ReScript. At a JavaScript-facing boundary, either return data or throw
with `JsError`.

## JavaScript exceptions: `JsExn`

Anything JavaScript throws reaches ReScript as the `JsExn(JsExn.t)` exception.
`JsExn.t` is `unknown`, because JavaScript can throw strings, numbers, or
objects as well as `Error`s.

```rescript
let parseJson = (text: string): result<JSON.t, parseError> =>
  try Ok(JSON.parseOrThrow(text)) catch {
  | JsExn(exn) => Error(InvalidJson(exn->JsExn.message->Option.getOr("unknown JSON error")))
  }
```

`JsExn.message`, `JsExn.name`, `JsExn.stack`, and `JsExn.fileName` return
`option<string>` for that reason. Use `Type.Classify.classify` when the thrown
value's runtime type matters. `JsExn.fromException(exn)` extracts the payload
from a caught `exn` when you are handling exceptions generically.

`JsExn.throw(value)` throws an arbitrary value. Reach for it only when a
JavaScript contract requires throwing a non-`Error`.

## Throwing JavaScript errors: `JsError`

`JsError.t` is a real JavaScript `Error`:

| Need                                      | Call                                        |
| ----------------------------------------- | ------------------------------------------- |
| create without throwing                   | `JsError.make("message")`                   |
| throw an existing error                   | `error->JsError.throw`                      |
| create and throw                          | `JsError.throwWithMessage("message")`       |
| specific subclasses                       | `JsError.TypeError.throwWithMessage("...")` |
| unrecoverable bug with a good stack trace | `JsError.panic("message")`                  |

`JsError.panic` prefixes the message with "Panic! " and is meant not to be
caught. Prefer it to a ReScript exception for "this cannot happen" paths that
should crash loudly with a native stack trace.

## Old names you will still meet

| ReScript 11 and earlier          | ReScript 12                              |
| -------------------------------- | ---------------------------------------- |
| `raise(E)`                       | `throw(E)`                               |
| `Js.Exn.Error(e)` / `Exn.Error`  | `JsExn(e)`                               |
| `Error.t`, `Error.make`          | `JsError.t`, `JsError.make`              |
| `Error.raise`                    | `JsError.throw`                          |
| `Error.message`                  | `JsExn.message` / `JsError.message`      |
| `@raises`                        | `@throws`                                |
| `Option.getExn`, `JSON.parseExn` | `Option.getOrThrow`, `JSON.parseOrThrow` |

`rescript-tools migrate-all <project-root>` rewrites most of these
automatically; see `rescript-12-migration`.

## Reanalyze exception analysis

With `"analysis": ["exception"]` in the `reanalyze` block of `rescript.json`,
`rescript-tools reanalyze -config` reports every function that can throw
without an `@throws` annotation, including standard-library calls that can
throw, such as `JSON.stringifyAny` (BigInt or cyclic input) and
`JsError.throwWithMessage`. JavaScript throws are tracked as `JsExn`.

```rescript
@throws(JsExn)
let requireNonEmpty = (label, value) =>
  value->String.isEmpty ? JsError.throwWithMessage(`${label} must not be empty`) : value
```

The annotation is documentation the analyser checks. If a caller handles the
exception, the caller needs no annotation; if it lets it escape, the caller
inherits the obligation. Treat a new report as a design question first: should
this function return a `result` instead?

`rescript-tools reanalyze` exits with status 0 even when it reports findings,
so a gate must read its `-json` output. See `rescript-quality-tools`.
