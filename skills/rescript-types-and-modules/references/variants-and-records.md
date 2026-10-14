# Variants and records

## Variants with inline records

Label multi-field payloads. The labels document the data and compile to named
properties instead of `_0`, `_1`:

```rescript
type card = Card({amount: int, last4: string})
```

compiles a value to `{TAG: "Card", amount: 250, last4: "4242"}`. An inline
record exists only inside its constructor: you cannot pass the payload around
as a standalone record, so extract the fields you need in the pattern.

Use a separate record type as the payload (`Card(cardDetails)`) when the
payload travels on its own, for example into a function that formats it.

## Making illegal states unrepresentable

```rescript
// Four booleans and options, many illegal combinations.
type fetchStateBad = {loading: bool, error: option<string>, data: option<array<string>>}

// One variant, exactly the legal states.
type fetchState =
  | Idle
  | Loading
  | Failed(string)
  | Loaded(array<string>)
```

Every consumer's `switch` is now checked for exhaustiveness. Adding a state
later turns every unhandled site into a compile error, which is the point.

## Optional record fields

`name?: string` means the field may be absent. Construction may omit it; reading
`person.name` yields `option<string>`. In a record literal, pass an existing
option through with `name: ?maybeName`. In a pattern, `{name: ?None}` matches
absence explicitly.

Prefer `field?: t` over `field: option<t>` when the JavaScript shape omits the
key; `field: option<t>` means the key is always conceptually present. ReScript
12 refuses to coerce between the two forms; construct the target record
explicitly.

## Type spreads

Records and variants can copy fields or constructors from other types:

```rescript
type base = {id: string, createdAt: float}
type user = {...base, name: string}

type card = Card({amount: int, last4: string})
type cash = Cash({amount: int})
type payment =
  | ...card
  | ...cash
  | Voucher({code: string})
```

A spread is a copy, not inheritance. A `card` is not automatically a `payment`;
coerce it with `(c :> payment)`, which costs nothing at runtime. Patterns can
match a whole spread group with `| ...card as c =>`.

Because `Card` now belongs to two types, an unannotated `Card({...})`
expression picks one by declaration order and warning 41 fires. Annotate the
binding: `let c: Payment.card = Card({...})`.

## Coercion

`(x :> t)` succeeds only when the compiler can prove the runtime
representations agree:

- a record to a record with a subset of its fields;
- a variant to a spread superset, or a closed polymorphic variant to a
  variant with the same runtime representation;
- payloadless constructors to `string`, or to `int`/`float` when every
  constructor has an `@as(n)` number;
- a `private` type to its representation;
- a `string` to an `@unboxed` variant with a catch-all `string` case.

It never converts data. If you need conversion, write a function.

## Polymorphic variants

`` #Red | #Green `` need no declaration and are structurally typed. Use them
for small open sets shared across modules without a common dependency, and for
JavaScript string unions in bindings. Prefer nominal variants elsewhere: they
give better error messages, faster pattern compilation, and exhaustiveness that
does not depend on inference.

## Extensible variants

`type t = ..` plus `type t += NewCase` lets other modules add constructors.
Exceptions are built on this mechanism. Matches over extensible variants are
never exhaustive, so use them only for genuinely open registries.

## Inference pitfalls

```rescript
type person = {age: int, name: string}
type monster = {age: int, hasTentacles: bool}

// Infers `monster`: the last record in scope with an `age` field.
let getAge = entity => entity.age
```

Annotate (`(entity: person) => entity.age`) or place the types in separate
modules and qualify (`entity.Person.age`). Constructors behave the same way.
