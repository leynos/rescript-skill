---
name: rescript-property-testing
description: Use for property-based testing of ReScript code with fast-check under Bun — choosing a relation (round trip, agreement, oracle, idempotence, model), writing narrow fast-check bindings, arbitraries for variants and records, model-based tests over operation sequences, typed equality in properties, and replaying failures by seed and path.
metadata:
  globs: "**/tests/**/*.res, **/*.test.res"
---

# ReScript property testing

Use this when one relation should hold across many inputs, or when bugs depend
on sequences of operations. For named examples and small case tables, use
`rescript-bun-testing`.

## Working stance

- Start from the relation, not the generator. Name what must hold for every
  input; where that cannot be named, write an example test instead.
- Keep named regressions beside the property that generalizes them. A
  property does not replace a readable specification.
- Bind fast-check narrowly and concretely; `rescript-fast-check` predates
  ReScript 12 and is unmaintained.
- Generate valid inputs by construction (`map`, `chain`, `constantFrom`)
  rather than generating anything and filtering.
- Compare structured values with a typed equality, not `==`: under `+A`,
  warning 102 rejects polymorphic comparison.
- Make failures reproducible: report the seed and path, and pin them when
  debugging.

## Choosing the relation

| Relation    | Shape                                                 | Example in the suite                       |
| ----------- | ----------------------------------------------------- | ------------------------------------------ |
| round trip  | `decode(encode(x)) == Ok(x)`                          | `JsonDecoding` encoder and decoder         |
| agreement   | `fast(x) == obviouslyCorrect(x)`                      | `let?` and `flatMap` config pipelines      |
| oracle      | accepts exactly the inputs a simple predicate accepts | `parsePort` versus a regex and range check |
| idempotence | `f(f(x)) == f(x)`                                     | email normalization                        |
| model       | any operation sequence agrees with a simple model     | `RingBuffer` versus an array               |
| invariant   | a property of every output (sorted, bounded, unique)  | —                                          |

_Table 1: Relations a property can check, with examples from the suite._

## Decision surface

| Need                                      | Move                                                       |
| ----------------------------------------- | ---------------------------------------------------------- |
| integers in ReScript's `int` range        | `FastCheck.int()`; fast-check's default range is 32-bit    |
| a payloadless variant                     | `constantFrom([A, B, C])`                                  |
| a variant with payloads                   | `oneof([int()->map(n => Num(n)), ...])`                    |
| a record                                  | `tuple3(...)->map(((a, b, c)) => {a, b, c})`               |
| dependent fields                          | `chain(x => arbitraryDependingOn(x))`                      |
| `option<'a>`                              | `nullable(arb)->map(Nullable.toOption)`                    |
| a stateful component                      | generate `array<command>`, fold over model and subject     |
| deterministic continuous integration (CI) | fix `numRuns`; replay failures with `seed` and `path`      |
| structural equality in a predicate        | `RescriptBun.Bun.deepEquals` wrapped as `('a, 'a) => bool` |

_Table 2: Moves for property-based testing._

## Pitfalls seen while building the examples

- `fc.option` yields `null`, not `undefined`; map through `Nullable`.
- `Fc.map(Int.toString)` does not compile: `Int.toString` has an optional
  `~radix`, so its arity is not one. Pass `n => Int.toString(n)`.
- Types cannot be declared inside a `describe` callback; put the command
  type for a model-based test in a module.
- `mod` makes reanalyze report `Division_by_zero`; index arithmetic that
  wraps by subtraction keeps the subject exception-free.

## Red flags

- A property whose predicate restates the implementation.
- `filter` discarding most generated values.
- `fc.integer()` mapped to `float` and back, or `'a` in a binding.
- Properties with `numRuns` in the tens of thousands on every commit.
- A failure "fixed" by changing the seed.
- Deleting a named regression because a property now covers it.

## References

- [fast-check-bindings.md](references/fast-check-bindings.md): the binding
  module, arities, option records, failure reports, and replay.
- [property-patterns.md](references/property-patterns.md): arbitraries for
  domain types, each relation in detail, model-based testing, typed equality,
  and making sure a property can fail.
- Executable examples: [FastCheck.res](references/examples/FastCheck.res)
  and [RingBuffer.res](references/examples/RingBuffer.res), exercised by
  `tests/PropertyTesting.test.res`.
