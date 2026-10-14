type t = string

type invalid =
  | Empty
  | MissingAt
  | MissingDomain

let make = raw => {
  let normalized = raw->String.trim->String.toLowerCase
  switch normalized->String.split("@") {
  | [""] => Error(Empty)
  | [_] => Error(MissingAt)
  | [local, domain] if local != "" && domain->String.includes(".") => Ok(normalized)
  | _ => Error(MissingDomain)
  }
}

let toString = email => email
