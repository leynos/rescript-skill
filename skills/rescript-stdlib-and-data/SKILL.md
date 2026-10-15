---
name: rescript-stdlib-and-data
description: Use for the ReScript 12 standard library and data handling — Array, Dict, Map, Set, List, String, Int, and Float semantics; `Js` and Belt in new code; equality and comparison; decoding and encoding JSON with `JSON.t`, `JSON.Decode`, or Sury schemas; and validating untrusted input.
metadata:
  globs: "**/*.res, **/*.resi"
---

# ReScript standard library and data

Use this when the question is which collection, which function, or how to get
untrusted data into well-typed values.

## Working stance

- The standard library ships with the compiler in ReScript 12. Use its
  modules (`Array`, `Dict`, `String`, `JSON`, `Promise`, …) unqualified. Do not
  add `@rescript/core`; do not write new code against `Js.*`, which is
  deprecated and will be removed in 13.
- Belt still ships and is not deprecated, but it is a second vocabulary.
  Keep it where it already is; prefer the standard library for new code.
- The standard library binds JavaScript faithfully. Arrays, dicts, maps, and
  sets are mutable JavaScript objects; know which functions mutate.
- Data crossing a trust boundary (HTTP bodies, files, storage, environment)
  is `JSON.t` or `unknown` until decoded. Decoding returns `result`.
- Compare with typed functions (`Int.compare`, a written `equal`), not
  polymorphic `==` on structured values.

## Decision surface

| Need                                          | Default move                                           |
| --------------------------------------------- | ------------------------------------------------------ |
| ordered sequence, indexed access              | `array<'a>`; `xs[i]` returns `option<'a>`              |
| persistent list built by prepending           | `list<'a>`; keep it away from JavaScript boundaries    |
| string-keyed record-like bag                  | `dict<'a>`, literal `dict{"a": 1}`                     |
| keys that are not strings, or insertion order | `Map.t<'k, 'v>`; object keys compare by identity       |
| membership                                    | `Set.t<'a>` with primitive or canonical string keys    |
| sorting                                       | `Array.toSorted` (copies) over `Array.sort` (mutates)  |
| decode JSON by hand                           | `JSON.Decode.*` returning options, wrapped in result   |
| decode and encode the same contract           | a Sury schema, converted to `result` at the edge       |
| strict numeric parsing                        | check the format first; `Int.fromString` is `parseInt` |
| equality on records                           | a typed `equal` function                               |

_Table 1: Default moves for the standard library and data._

## Behaviours that bite

- `Int.fromString("80abc")` is `Some(80)` and `Float.fromString("1x")` is
  `Some(1.)`: both are `parseInt`/`parseFloat`.
- `int` is 32-bit; `Int.Constants.maxValue + 1` wraps to the minimum.
- `String.length` counts UTF-16 code units: `"👍"` has length 2.
- `Map` and `Set` compare object keys by identity, so two equal records are
  two keys.
- `Array.sort` sorts in place and returns `unit`; `Array.reverse` likewise.
  Use `toSorted` and `toReversed` for copies.
- `dict` bindings alias. `Dict.copy` before mutating a dict created
  elsewhere.
- Under `+A`, warning 102 rejects `==` on non-primitive types, and in 12.3.1
  `@warning("-102")` cannot silence it locally. Write typed equality.
- Under `+A`, warning 4 rejects `| _ =>` over `JSON.t`'s constructors;
  `JSON.Decode.*` options keep decoders exhaustive without a wildcard.

## Red flags

- `Js.Dict`, `Js.Array2`, `Js.Json`, `Js.log` in new code.
- A binding or `%identity` cast from `JSON.t` to a record type, skipping
  validation.
- Decoders that return `option` and lose where the payload was wrong.
- `Belt.Map` and `Map` mixed in one module.
- `list` in a type exported to JavaScript.
- Handwritten decoder and encoder for the same contract maintained
  separately with no round-trip test.

## References

- [stdlib-map.md](references/stdlib-map.md): the ReScript 12 module set,
  renamed functions, and what replaces `Js.*` and Belt idioms.
- [json-decoding.md](references/json-decoding.md): `JSON.t`, `JSON.Decode`,
  path-carrying errors, Sury schemas, and trust boundaries.
- [equality-and-collections.md](references/equality-and-collections.md):
  structural versus reference equality, warning 102, collection choice, and
  mutation.
- Executable examples: [JsonDecoding.res](references/examples/JsonDecoding.res),
  [SuryUser.res](references/examples/SuryUser.res), and
  [CollectionSemantics.res](references/examples/CollectionSemantics.res).
