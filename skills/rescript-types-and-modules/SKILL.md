---
name: rescript-types-and-modules
description: Use for ReScript 12 type and module design — variants and inline records, records and optional fields, type spreads and coercion, polymorphic variants, opaque and private types behind .resi interfaces, module types, functors, and first-class modules.
metadata:
  globs: "**/*.res, **/*.resi"
---

# ReScript Types and Modules

Use this when the question is "what shape should this type or module have?" The
compiler is the first and cheapest test: design types so that the wrong program
does not compile.

## Working stance

- Model "this or that" with a variant, not with flags, sentinel strings, or
  several `option` fields that must agree.
- Give every module with a meaningful boundary a `.resi`. The interface is
  where invariants live, and an unchanged `.resi` also stops dependants from
  recompiling.
- Hide representation behind an abstract `type t`, or expose it read-only
  with `type t = private ...`, and hand out values only through a smart
  constructor that validates.
- Prefer nominal records and variants. Reach for polymorphic variants or
  structural objects only when openness is the requirement.
- Use functors for "the same implementation over different key or element
  types". Do not use them as a dependency-injection framework; plain functions
  and records of functions are usually enough.
- Annotate when inference would pick a type by field or constructor name.

## Decision surface

| Need                                         | Default move                                           |
| -------------------------------------------- | ------------------------------------------------------ |
| one of several cases, each with its own data | variant with inline records                            |
| a fixed set of named fields                  | record; `field?: t` for genuinely optional fields      |
| a value that must satisfy an invariant       | abstract or `private` type plus `make: ... => result`  |
| read access without construction             | `type t = private string` in the `.resi`               |
| a superset of another variant                | type spread `\| ...base \| Extra`, then `(x :> super)` |
| a variant compared with strings at runtime   | payloadless constructors coerce to `string`            |
| an open set extended by many modules         | polymorphic variant or extensible variant              |
| one implementation, many key types           | functor over a module type                             |
| choosing an implementation at runtime        | first-class module or a record of functions            |

## Rules the compiler enforces

- Record types are found by field name, and constructors by constructor
  name, using the most recent definition in scope. Two records sharing a field,
  or a spread variant sharing constructors with its source, make the inferred
  type depend on declaration order. Annotate the binding or qualify the
  constructor; warning 41 flags the ambiguous constructor case.
- Under warnings `+A`, warning 9 requires every label in a record pattern to
  be bound or the pattern closed with `, _`: `Card({amount, _})`.
- Coercion `(x :> t)` is zero cost and only allowed when the runtime
  representations already agree. It cannot forge a `private` or abstract type:
  `("x" :> EmailAddress.t)` is a compile error.
- Variant spreads require identical runtime configuration (`@unboxed`,
  `@tag`, `@as`) across the spread types, and cannot appear in recursive
  definitions.

## Runtime shape, briefly

Payloadless constructors compile to strings (`Pending` → `"Pending"`).
Constructors with payloads compile to objects with a `TAG` field and `_0`,
`_1`, … or the inline record's labels. `option` is `undefined` or the value.
Records are plain objects. When the shape must match a JavaScript or JSON
contract, that is `rescript-interop`'s territory (`@as`, `@tag`, `@unboxed`).

## Red flags

- `type state = {loading: bool, error: option<string>, data: option<t>}` with
  rules about which combinations are legal. Use a variant.
- A public record whose fields callers can set into an invalid combination.
- `string` or `int` identifiers passed between unrelated domains with no
  wrapper type.
- A `.res` module with a non-trivial invariant and no `.resi`.
- `Obj.magic` used to convert between two record types; use a spread and
  coercion, or construct the target explicitly.
- A functor whose argument module has one function; pass the function.
- A `mutable` field shared across modules with no owner.

## References

- [variants-and-records.md](references/variants-and-records.md): inline
  records, optional fields, spreads, coercion, polymorphic and extensible
  variants, and inference pitfalls.
- [interfaces-and-abstraction.md](references/interfaces-and-abstraction.md):
  `.resi` design, abstract versus `private` types, smart constructors, and
  documentation comments.
- [modules-and-functors.md](references/modules-and-functors.md): module
  types, functors, `with type`, first-class modules, and when to use none of
  them.
- Executable examples:
  [EmailAddress.resi](references/examples/EmailAddress.resi) with
  [EmailAddress.res](references/examples/EmailAddress.res), [Payment.res](references/examples/Payment.res),
  and [KeyedStore.res](references/examples/KeyedStore.res).
