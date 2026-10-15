/***
Standard-library behaviours that differ from what the types suggest.

Each function exists so the suite can pin the behaviour down; the comments say
which way to lean in real code.
*/

type point = {x: int, y: int}

/**
Compares two points field by field. `==` on records is polymorphic structural
comparison. Warning 102 (part of `+A`) rejects it, and in 12.3.1 neither
`@warning` nor `@@warning` can silence 102 locally, so write a typed equality
instead. `===` compares identity and is allowed.
*/
let equalPoint = (a: point, b: point): bool => a.x == b.x && a.y == b.y
/**
Compares two points by identity, so distinct records with equal fields are not
the same.
*/
let sameObject = (a: point, b: point): bool => a === b

/**
Counts the distinct points in `points` by object identity. `Map` and `Set` are
JavaScript collections: object keys compare by identity (SameValueZero), so two
equal records are two different keys.
*/
let distinctByIdentity = (points: array<point>): int => Set.fromArray(points)->Set.size

/**
Returns a canonical `x,y` key for a point. Key by a canonical string when
structure should decide.
*/
let pointKey = ({x, y}: point): string => `${x->Int.toString},${y->Int.toString}`

/** Counts the distinct points in `points` by their canonical keys. */
let distinctByValue = (points: array<point>): int =>
  points->Array.map(pointKey)->Set.fromArray->Set.size

/**
Returns a sorted copy of `xs`, which is left unchanged. `Array.sort` sorts in
place and returns `unit`; `Array.toSorted` copies.
*/
let sortedCopy = (xs: array<int>): array<int> => xs->Array.toSorted(Int.compare)
/** Sorts `xs` in place and returns `unit`. */
let sortInPlace = (xs: array<int>): unit => xs->Array.sort(Int.compare)

/**
Adds two ints, wrapping at 32 bits. `int` is 32-bit: arithmetic wraps rather
than growing into a float.
*/
let addInts = (a: int, b: int): int => a + b

/**
Returns the third element of `xs`, or `None` when there is none. `xs[i]`
returns an option; out of range is `None`, not `undefined` typed as 'a.
*/
let third = (xs: array<'a>): option<'a> => xs[2]

/**
Returns the length of `s` in UTF-16 code units. `String.length` counts UTF-16
code units, not characters.
*/
let lengthInCodeUnits = (s: string): int => s->String.length

/**
Sets `name` to `renamed` in `fields` itself and returns it. `dict` is a mutable
JavaScript object; a binding is a reference, not a copy.
*/
let renameWithoutCopy = (fields: dict<string>): dict<string> => {
  fields->Dict.set("name", "renamed")
  fields
}

/**
Sets `name` to `renamed` in a copy of `fields`, which is returned and leaves
`fields` unchanged.
*/
let renameWithCopy = (fields: dict<string>): dict<string> => {
  let next = fields->Dict.copy
  next->Dict.set("name", "renamed")
  next
}
