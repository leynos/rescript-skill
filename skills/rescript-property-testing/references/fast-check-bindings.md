# fast-check bindings

[FastCheck.res](examples/FastCheck.res) binds the part of fast-check 4.x a
typical suite needs. Install it as a development dependency
(`bun add -d fast-check`); it has no ReScript sources, so it does not go in
`rescript.json`.

## Shape of the bindings

```rescript
type arbitrary<'a>
type property

@module("fast-check") external int: (~constraints: intConstraints=?) => arbitrary<int> = "integer"
@module("fast-check")
external tuple2: (arbitrary<'a>, arbitrary<'b>) => arbitrary<('a, 'b)> = "tuple"
@send external map: (arbitrary<'a>, 'a => 'b) => arbitrary<'b> = "map"
@module("fast-check") external property1: (arbitrary<'a>, 'a => bool) => property = "property"
@module("fast-check") external check: (property, ~parameters: parameters=?) => unit = "assert"
```

Principles:

- **One external per arity.** fast-check's `property` and `tuple` are
  variadic and heterogeneous; ReScript types each arity separately (`property1`,
  `property2`, `tuple2`, `tuple3`). Add the next arity when you need it.
- **`@variadic` only for homogeneous arrays**: `constantFrom` and `oneof`
  take `array<'a>` and spread it.
- **Option records** use optional fields (`{min?: int, max?: int}`), so
  unspecified constraints are omitted from the JavaScript call. Mark them
  `@live`: only fast-check reads their labels.
- **`check`, not `assert`**: a binding named `assert` would shadow
  ReScript 12's built-in `assert` function.
- **No `'a` escape hatches.** If a combinator is hard to type, it is usually
  better expressed with `map` or `chain` over ones that are easy to type.

## Ranges

`fc.integer()` defaults to `-2147483648` to `2147483647`, exactly ReScript's
`int`, so generated values never overflow on conversion. Narrow ranges with
`~constraints={min: 1, max: 4}` when the domain is small; small domains find
boundary bugs faster.

`fc.option` produces `null` for the empty case. Binding it as
`arbitrary<option<'a>>` would be a lie, so the module binds `nullable` and maps
through `Nullable.toOption`.

## Running properties in Bun

```rescript
test("decoding an encoded user returns it unchanged", () =>
  Fc.check(
    Fc.property1(user, u => same(JsonDecoding.user(JsonDecoding.encodeUser(u), "$"), Ok(u))),
    ~parameters={numRuns: 200},
  )
)
```

`check` throws a JavaScript `Error` when the property fails; Bun reports the
test as failed and prints the message.

## Reading and replaying a failure

A failure message looks like:

```text
Property failed after 3 tests
{ seed: 42, path: "6:1:0:0:2:0:0:1", endOnFailure: true }
Counterexample: [2,[{"TAG":"Push","_0":0},{"TAG":"Push","_0":0},{"TAG":"Push","_0":-1}]]
Shrunk 38 time(s)
```

The counterexample is printed in its JavaScript representation: variants appear
as `{"TAG": ..., "_0": ...}`. To replay exactly that case while debugging, pass
the seed and path:

```rescript
Fc.check(property, ~parameters={seed: 42, path: "6:1:0:0:2:0:0:1"})
```

Remove the pinned parameters once fixed, and add the shrunk counterexample as a
named regression test.

## CI cadence

Properties with a few hundred runs cost milliseconds here and belong in every
test run. fast-check picks a fresh seed each run, so CI explores new inputs
over time; that is a feature, provided failures are reported with their seed.
Raise `numRuns` locally or in a scheduled job when hunting, not on every commit.
