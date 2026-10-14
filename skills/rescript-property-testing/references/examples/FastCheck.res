/***
Narrow bindings to fast-check 4.x.

`rescript-fast-check` was last published in 2022 and predates ReScript 12, so
bind the handful of combinators a suite needs. Every binding is concrete: one
external per arity rather than `'a` arguments.
*/

type arbitrary<'a>
type property

// Option records are read by fast-check, not by ReScript, so reanalyze would
// report their labels as never read.
@live type intConstraints = {min?: int, max?: int}
@live type arrayConstraints = {minLength?: int, maxLength?: int}
@live type stringConstraints = {minLength?: int, maxLength?: int}

// Defaults to the full 32-bit range, which matches ReScript's `int`.
@module("fast-check") external int: (~constraints: intConstraints=?) => arbitrary<int> = "integer"
@module("fast-check") external bool: unit => arbitrary<bool> = "boolean"
@module("fast-check")
external string: (~constraints: stringConstraints=?) => arbitrary<string> = "string"
@module("fast-check")
external array: (arbitrary<'a>, ~constraints: arrayConstraints=?) => arbitrary<array<'a>> = "array"
@module("fast-check") @variadic external constantFrom: array<'a> => arbitrary<'a> = "constantFrom"
@module("fast-check") @variadic external oneof: array<arbitrary<'a>> => arbitrary<'a> = "oneof"
@module("fast-check")
external tuple2: (arbitrary<'a>, arbitrary<'b>) => arbitrary<('a, 'b)> = "tuple"
@module("fast-check")
external tuple3: (arbitrary<'a>, arbitrary<'b>, arbitrary<'c>) => arbitrary<('a, 'b, 'c)> = "tuple"

@send external map: (arbitrary<'a>, 'a => 'b) => arbitrary<'b> = "map"
@send external filter: (arbitrary<'a>, 'a => bool) => arbitrary<'a> = "filter"
@send external chain: (arbitrary<'a>, 'a => arbitrary<'b>) => arbitrary<'b> = "chain"

// `fc.option` produces `null` for the empty case, not `undefined`.
@module("fast-check") external nullable: arbitrary<'a> => arbitrary<Nullable.t<'a>> = "option"
let option = (arb: arbitrary<'a>): arbitrary<option<'a>> => arb->nullable->map(Nullable.toOption)

// A predicate returning `false`, or throwing, fails the property.
@module("fast-check") external property1: (arbitrary<'a>, 'a => bool) => property = "property"
@module("fast-check")
external property2: (arbitrary<'a>, arbitrary<'b>, ('a, 'b) => bool) => property = "property"

@live type parameters = {numRuns?: int, seed?: int, path?: string}

// Throws a JavaScript `Error` whose message includes the counterexample, the
// seed, and the shrink path; Bun reports it as the test failure.
@module("fast-check") external check: (property, ~parameters: parameters=?) => unit = "assert"
