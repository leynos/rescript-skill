/***
A validated email address.

`t` is `private string`: callers can read it as a string with `(email :> string)`
but can only obtain one through `make`, so every `t` in the program has passed
validation. Change the representation later and only this module recompiles.
*/

type t = private string

type invalid =
  | Empty
  | MissingAt
  | MissingDomain

/** Trims, lower-cases, and checks the address. */
let make: string => result<t, invalid>

/** The address as a string, for interop and display. */
let toString: t => string
