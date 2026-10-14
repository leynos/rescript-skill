# Interfaces and abstraction

## What a `.resi` is for

A `.resi` file is the module's public contract. Anything not listed is private,
and the compiler checks the implementation against it. It also bounds
recompilation: if an implementation change leaves the `.resi` untouched,
dependants do not recompile.

Write one for every module another module depends on for something more than
plain data: validation, invariants, or a representation you may change.

## Abstract, private, or transparent

| Interface declaration       | Callers can read     | Callers can construct | Use for                                  |
| --------------------------- | -------------------- | --------------------- | ---------------------------------------- |
| `type t`                    | no, only via API     | no                    | handles, representations you will change |
| `type t = private string`   | yes, `(x :> string)` | no                    | validated primitives (emails, IDs)       |
| `type t = private {a: int}` | yes, field access    | no                    | validated records                        |
| `type t = {a: int}`         | yes                  | yes                   | plain data with no invariant             |

`private` gives callers ergonomic read access while keeping construction in one
place. Abstract types keep every option open, at the cost of accessor functions.

## Smart constructors

```resi
type t = private string

type invalid =
  | Empty
  | MissingAt
  | MissingDomain

/** Trims, lower-cases, and checks the address. */
let make: string => result<t, invalid>

let toString: t => string
```

The implementation can define `type t = string`. Every `t` in the program has
been through `make`, so code that receives a `t` needs no defensive checks.
Normalization (trimming, case folding) belongs in `make` too, so equality on
`t` is meaningful.

See [EmailAddress.resi](examples/EmailAddress.resi) and
[EmailAddress.res](examples/EmailAddress.res).

## Documentation comments

`/** ... */` before an item documents it in editor hovers and in
`rescript-tools doc` output. A leading `/*** ... */` documents the module. Put
the contract in the `.resi`: that is what hovers show to callers. ReScript
12.3.1 does not copy these comments into the generated JavaScript.

## Interface pitfalls

- Exposing a record type transparently "for convenience" and then adding an
  invariant later. Changing it to `private` breaks every construction site;
  start `private` when an invariant is likely.
- Exporting helpers only so a test can reach them. Test through the public
  API, or move the helper into its own module with its own interface.
- Duplicating a variant definition in the `.resi` and `.res` and letting them
  drift. The compiler checks them, but documentation comments live only in the
  file the reader sees; keep them in the `.resi`.
- Filename case: ReScript 12.1 and later check that `Foo.res` and `Foo.resi`
  agree in case.
