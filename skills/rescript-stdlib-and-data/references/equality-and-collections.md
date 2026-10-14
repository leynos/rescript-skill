# Equality and collections

## Two equalities

- `===` and `!==` compare identity (JavaScript `===`).
- `==` and `!=` compare structure. On primitives this is ordinary
  comparison. On records, variants, arrays, and tuples it is a recursive
  runtime comparison: slower, and it throws on functions.

Under warnings `+A`, warning 102 ("polymorphic comparison introduced") turns
`==`, `<`, `compare`, and friends on non-primitive types into build errors. In
ReScript 12.3.1 the warning is raised late enough that neither
`@warning("-102")` on a binding nor `@@warning("-102")` on a file silences it;
only the project-wide `warnings` setting in `rescript.json` does.

So, in a strict project, write typed equality:

```rescript
let equalPoint = (a: point, b: point): bool => a.x == b.x && a.y == b.y
```

The standard library provides the combinators: `Option.equal`, `Result.equal`,
`Array.equal`, `List.equal`, `Null.equal`, `Nullable.equal`, and `compare`
counterparts, each taking an element function. Use `Int.compare`,
`Float.compare`, and `String.compare` for ordering.

If a project decides polymorphic comparison is acceptable, disable 102 for the
whole project with a recorded reason (`"number": "+A-102"`) rather than
scattering workarounds.

## Choosing a collection

| Collection  | Mutability | Keys or order                           | Notes                                  |
| ----------- | ---------- | --------------------------------------- | -------------------------------------- |
| `array<'a>` | mutable    | index                                   | `xs[i]` is `option<'a>`                |
| `list<'a>`  | immutable  | head first                              | cheap prepend; poor JavaScript interop |
| `dict<'a>`  | mutable    | string keys                             | a plain object; aliasing is a hazard   |
| `Map.t`     | mutable    | any key, SameValueZero, insertion order | object keys by identity                |
| `Set.t`     | mutable    | SameValueZero                           | object members by identity             |
| `Belt.Map`  | immutable  | sorted by a comparator module           | persistent; Belt vocabulary            |

Records and arrays as `Map` keys or `Set` members do not deduplicate by value.
Key by a canonical string (`pointKey`) or use `Belt.Map` with a comparator.
[CollectionSemantics.res](examples/CollectionSemantics.res) and its suite
demonstrate each behaviour.

## Mutation

The standard library mirrors JavaScript, so some functions mutate their
receiver and return `unit`:

| Mutates              | Copies instead         |
| -------------------- | ---------------------- |
| `Array.sort`         | `Array.toSorted`       |
| `Array.reverse`      | `Array.toReversed`     |
| `Array.splice`       | `Array.toSpliced`      |
| `Array.set`, `push`  | `Array.concat`, spread |
| `Dict.set`, `delete` | `Dict.copy` first      |

A function that takes a collection it did not create should copy before
mutating, or say in its name and interface that it mutates.

## Numbers and strings

- `int` is a 32-bit integer; overflow wraps. Use `float` or `bigint` for
  larger values, and check JSON numbers before converting.
- `Int.fromString` and `Float.fromString` accept leading numeric prefixes.
  Validate the whole string with a regex first when the format is strict.
- `String.length`, indexing, and `slice` work in UTF-16 code units. Use
  `Intl.Segmenter` when user-perceived characters matter.
