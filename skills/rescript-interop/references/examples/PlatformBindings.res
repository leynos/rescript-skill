/***
Narrow bindings to JavaScript platform APIs.

Each `external` states a type the compiler cannot check, so keep bindings
small, concrete, and in one place, and put the ReScript-shaped wrapper next to
them. Callers use the wrappers; only this module knows the JavaScript shape.
*/

// Module functions: `@module` imports a named export.
@module("node:path") external joinPath: (string, string) => string = "join"

// Variadic JavaScript functions take an array that is spread at the call site.
@module("node:path") @variadic external joinPaths: array<string> => string = "join"

// Classes: an abstract type, a constructor with `@new`, and accessors.
type url
@new external makeUrl: string => url = "URL"
@get external hostname: url => string = "hostname"
@get external protocol: url => string = "protocol"

// The URL constructor throws a TypeError on invalid input. Convert that to an
// option here so no caller ever sees the exception.
let parseUrl = (raw: string): option<url> =>
  try Some(makeUrl(raw)) catch {
  | JsExn(_) => None
  }

// Methods: `@send` passes the receiver as the first argument, which suits `->`.
// `@return(nullable)` turns a `null` or `undefined` result into `None`.
@send @return(nullable)
external matchOnce: (string, RegExp.t) => option<array<string>> = "match"

let firstDigits = (text: string): option<string> =>
  text->matchOnce(/[0-9]+/)->Option.flatMap(matches => matches[0])

// Optional labelled arguments are omitted from the call when not supplied.
@send external padStart: (string, int, ~fill: string=?) => string = "padStart"

// A global that may be missing, `null`, or a string: `Nullable.t` covers all three.
@val @scope("globalThis") external configuredRegion: Nullable.t<string> = "APP_REGION"

let region = (): string => configuredRegion->Nullable.toOption->Option.getOr("eu-west-2")
