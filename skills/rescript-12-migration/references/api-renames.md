# API renames and removals

## Standard library

| ReScript 11                           | ReScript 12                                                     |
| ------------------------------------- | --------------------------------------------------------------- |
| `Js.log`, `Js.log2`                   | `Console.log`, `Console.log2`                                   |
| `Js.Dict`, `Js.Array2`, `Js.String2`  | `Dict`, `Array`, `String`                                       |
| `Js.Json.parseExn`                    | `JSON.parseOrThrow`                                             |
| `Js.Promise2`                         | `Promise`, or `async`/`await`                                   |
| `Js.Nullable`                         | `Nullable`                                                      |
| `*Exn` helpers (`Option.getExn`, …)   | `*OrThrow` (`Option.getOrThrow`, …)                             |
| `Result.getExn` throwing `Not_found`  | `Result.getOrThrow` throwing a JS `Error`                       |
| `BigInt.fromFloat` throwing           | `BigInt.fromFloat` returning an option                          |
| `String.charCodeAt` returning `float` | `String.charCodeAt` returning `option<int>`; `charCodeAtUnsafe` |
| `Date.make(~date=...)`                | `Date.make(~day=...)`                                           |
| `Int.Bitwise.lsl` and friends         | `Int.shiftLeft` and friends, or operators                       |
| `Js.Vector`, `Js.List`                | removed                                                         |

`Js.*` modules are deprecated in 12 and scheduled for removal in 13.

## Exceptions and errors

| ReScript 11                    | ReScript 12                 |
| ------------------------------ | --------------------------- |
| `raise(E)`                     | `throw(E)`                  |
| `Js.Exn.Error(e)`, `Exn.Error` | `JsExn(e)`                  |
| `Js.Exn.message(e)`            | `JsExn.message(e)`          |
| `Error.t`, `Error.make`        | `JsError.t`, `JsError.make` |
| `Error.raise`                  | `JsError.throw`             |
| `@raises(E)`                   | `@throws(E)`                |

## Operators

```rescript
let a = 5
let b = 2
let notA = ~~~a
let xor = a ^^^ b
let both = a &&& b
let either = a ||| b
let left = a << b
let right = a >> b
let unsigned = a >>> b
let power = 2 ** 10
let remainder = 7 % 3
```

`lnot`, `lxor`, `land`, `lor`, `lsl`, `lsr`, and `asr` are deprecated and,
unlike most renames, `rescript-tools migrate` does not rewrite them. Integer
multiplication now compiles to `(a * b) | 0` rather than `Math.imul`.

## Attributes and syntax

| ReScript 11                        | ReScript 12                       |
| ---------------------------------- | --------------------------------- |
| `@bs.as`, `@bs.send`, `@bs.new`, … | `@as`, `@send`, `@new`, …         |
| `@bs.send.pipe`, `@meth`           | removed; use `@send`              |
| `@genType.as`                      | `@as`                             |
| `assert x == y` (keyword)          | `assert(x == y)` (function)       |
| `lazy expr`                        | `Lazy` module                     |
| `<div> ...children </div>`         | `<div> children </div>`           |
| JSX v3, `-bs-jsx-mode`             | JSX v4 only                       |
| `.ml` source files                 | removed; convert before upgrading |

## New in 12, worth adopting while migrating

- `dict{"a": 1}` literals and `dict{...}` patterns.
- Regex literals: `/^[0-9]+$/`.
- `let?` early returns behind `"experimental-features": {"LetUnwrap": true}`.
- `Option.all`, `Result.all`, and the async result helpers
  (`Result.mapOkAsync` and friends).
- `@unboxed` support for more runtime types; `@notUndefined` on abstract
  types; `@directive` on functions for `"use server"` style directives.
