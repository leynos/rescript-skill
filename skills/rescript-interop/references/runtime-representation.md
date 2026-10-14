# Runtime representation

What ReScript values look like in the generated JavaScript, as of 12.3.1. When
in doubt, open the `.res.mjs`.

| ReScript                               | JavaScript                                       |
| -------------------------------------- | ------------------------------------------------ |
| `int`, `float`                         | `number` (`int` operations truncate with `\| 0`) |
| `bigint`                               | `bigint`                                         |
| `string`, `bool`                       | `string`, `boolean`                              |
| `array<'a>`                            | `Array`                                          |
| tuple `(a, b)`                         | `Array` of fixed length                          |
| `dict<'a>`                             | plain object                                     |
| record `{a: 1}`                        | plain object `{a: 1}`                            |
| optional record field, absent          | key absent                                       |
| `option<'a>`: `None` / `Some(x)`       | `undefined` / `x` (nested options are boxed)     |
| `Nullable.t<'a>`                       | `null`, `undefined`, or the value                |
| payloadless constructor `Pending`      | `"Pending"`                                      |
| constructor with payload `Failed("x")` | `{TAG: "Failed", _0: "x"}`                       |
| inline record `Card({amount: 1})`      | `{TAG: "Card", amount: 1}`                       |
| polymorphic variant `#Red`             | `"Red"`                                          |
| `list<'a>`                             | nested `{hd, tl}` objects; avoid at boundaries   |
| ReScript exception                     | `{RE_EXN_ID, _1, ..., Error}`, not an `Error`    |
| function `(a, b) => c`                 | two-argument JavaScript function                 |

## Changing the representation

### `@as` on constructors

```rescript
type status =
  | @as("pending") Pending
  | @as(200) Ok200
  | @as(null) Missing
```

Valid payloads: strings, ints, floats, booleans, `null`, and `undefined`.
Payloadless constructors with string `@as` values coerce to `string`; with
number values, to `int` or `float`.

### `@tag` on the variant

```rescript
@tag("kind")
type uiEvent =
  | @as("click") Click({x: int, y: int})
  | @as("key") Key({key: string})
```

`Click({x: 1, y: 2})` compiles to `{kind: "click", x: 1, y: 2}`. Use inline
records so the payload fields sit beside the discriminator, which is the shape
most JavaScript APIs and JSON payloads use.

### `@unboxed`

```rescript
@unboxed
type padding =
  | Spaces(int)
  | Text(string)
```

`Spaces(2)` compiles to `2` and `Text("x")` to `"x"`. Pattern matching uses
`typeof` and `instanceof`, so each payload must be distinguishable at runtime.
Unboxable payloads are `string`, one of `int` or `float`, `bigint`, `bool`, one
array-or-tuple case, `promise`, `dict` (as `Object`), `Date.t`, `RegExp.t`,
`Blob.t`, `File.t`, `ArrayBuffer.t`, `DataView.t`, typed arrays, and (since
12.1) `Set.t`, `Map.t`, `WeakSet.t`, and `WeakMap.t`. At most one case may
carry an object (a record or `dict`), and at most one an array or tuple.

Payloadless constructors in an unboxed variant are their `@as` literal, which
gives the catch-all pattern:

```rescript
@unboxed
type plan =
  | @as("free") Free
  | @as("team") Team
  | Other(string)
```

`("enterprise" :> plan)` is `Other("enterprise")`, and `("team" :> plan)` is
`Team`, because the coercion is just the string. Use this for vendor enums that
grow without notice.

### JSON-shaped types

The standard library's `JSON.t` is itself an `@unboxed` recursive variant:
`Null`, `Boolean(bool)`, `String(string)`, `Number(float)`, `Object(dict<t>)`,
and `Array(array<t>)`. You can pattern match JSON directly; see
`rescript-stdlib-and-data` for decoding.

## Evidence

[WireShapes.res](examples/WireShapes.res) and its suite assert the
`JSON.stringifyAny` output of tagged and unboxed values, so a change in
representation fails `make test`.
