/***
The implementation of a validated email address.

`EmailAddress.resi` publishes `t` as `private string`, so callers outside this
module can read an address as a string but can obtain one only from the smart
constructor `make`, which trims, lower-cases, and checks the shape. Inside this
file `t` is plain `string`; the interface, not this implementation, is what
callers compile against.
*/

type t = string

type invalid =
  | Empty
  | MissingAt
  | MissingDomain

/** Normalizes `raw` and accepts it only as `local@domain.tld`. */
let make = raw => {
  let normalized = raw->String.trim->String.toLowerCase
  switch normalized->String.split("@") {
  | [""] => Error(Empty)
  | [_] => Error(MissingAt)
  | [local, domain] if local != "" && domain->String.includes(".") => Ok(normalized)
  | _ => Error(MissingDomain)
  }
}

/** The address as a string; free, because `t` is a string underneath. */
let toString = email => email
