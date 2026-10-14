# The ReScript 12 standard library

The former `@rescript/core` now ships inside the compiler as `Stdlib`, opened
by default. Its interfaces are installed at
`node_modules/@rescript/runtime/lib/ocaml/Stdlib_*.resi`; read those when a
signature matters, because they are exactly what your compiler checks against.

## Module set

| Area            | Modules                                                                 |
| --------------- | ----------------------------------------------------------------------- |
| primitives      | `Int`, `Float`, `BigInt`, `Bool`, `String`, `Math`, `Symbol`            |
| collections     | `Array`, `List`, `Dict`, `Map`, `Set`, `WeakMap`, `WeakSet`, `Iterator` |
| absence, errors | `Option`, `Result`, `Null`, `Nullable`, `JsExn`, `JsError`              |
| async           | `Promise`, `AsyncIterator`                                              |
| data            | `JSON` (with `Decode`, `Encode`, `Classify`), `Date`, `RegExp`, `Intl`  |
| binary          | `ArrayBuffer`, `DataView`, `Uint8Array` and the other typed arrays      |
| platform        | `Console`, global `setTimeout` and friends, `Type.Classify`             |

## Names that changed in 12

- Functions that throw end in `OrThrow`: `Option.getOrThrow`,
  `Result.getOrThrow`, `JSON.parseOrThrow`, `List.getOrThrow`,
  `BigInt.fromFloatOrThrow`. The old `*Exn` names are deprecated.
- `BigInt.fromFloat` returns an option.
- `String.charCodeAt` returns `option<int>`; `charCodeAtUnsafe` is the
  unchecked form.
- `Date.makeWithYMD` and the other `Date.makeWith*` constructors take
  `~day`, not `~date`. `Date.make()` takes no arguments.
- Bitwise and shift operations are operators: `&&&`, `|||`, `^^^`, `~~~`,
  `<<`, `>>`, `>>>`. `Int.Bitwise.lsl` and friends are deprecated (warning 3);
  use the operators or `Int.shiftLeft`.
- `**` is exponentiation and `%` is the remainder for `int` and `float`.
- `Array.zip`, `unzip`, `zipBy`, and `partition` arrived in 12.2;
  `String.localeCompare` gained `~locales` and `~options` in 12.3.

`rescript-tools migrate-all <root>` rewrites most deprecated calls; the
deprecation warning names the replacement.

## Replacing `Js.*`

| Old                             | ReScript 12                                   |
| ------------------------------- | --------------------------------------------- |
| `Js.log`, `Js.log2`             | `Console.log`, `Console.log2`                 |
| `Js.Dict.t`, `Js.Dict.get`      | `dict<'a>`, `Dict.get`                        |
| `Js.Array2.map`                 | `Array.map`                                   |
| `Js.String2.split`              | `String.split`                                |
| `Js.Json.t`, `Js.Json.classify` | `JSON.t`, pattern matching or `JSON.Classify` |
| `Js.Nullable.t`                 | `Nullable.t`                                  |
| `Js.Promise2.then`              | `Promise.then` or `await`                     |
| `Js.Exn.Error(e)`               | `JsExn(e)`                                    |
| `Js.Re`                         | `RegExp`, with regex literals `/^a+$/`        |

## Belt

Belt (`Belt.Array`, `Belt.Map`, `Belt.Set`, `Belt.HashMap`, …) predates the
standard library. It is still shipped and largely not deprecated, and its
immutable `Belt.Map`/`Belt.Set` with comparator modules have no direct
standard-library equivalent. Use them when you need persistent sorted maps.
Otherwise, prefer the standard library so a module speaks one vocabulary.

## Literals and syntax worth using

- `dict{"a": 1, "b": 2}` compiles to an object literal; `dict{"a": a}` also
  works as a pattern.
- Regex literals `/^[0-9]+$/` compile to JavaScript regex literals.
- Template strings `` `${name}` `` interpolate strings only; convert numbers
  explicitly with `Int.toString`.
