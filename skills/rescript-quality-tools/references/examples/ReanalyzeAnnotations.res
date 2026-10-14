/***
Telling reanalyze about liveness it cannot see.

Dead-code analysis follows references inside the ReScript project. Values
reached only from JavaScript, from a framework by naming convention, or from a
published library's consumers look dead to it. Mark those deliberately and as
narrowly as possible; everything else it reports is a real finding.
*/

// Reached only from a JavaScript entry point (for example a Bun script that
// imports the generated module), so reanalyze cannot see the caller.
@live
let main = (args: array<string>): int => args->Array.length

// A published surface: every value in the module is a root for consumers.
module PublicApi = {
  @@live

  let parse = (raw: string): option<int> =>
    /^[0-9]+$/->RegExp.test(raw) ? Int.fromString(raw) : None
  let render = (value: int): string => value->Int.toString
}

// Kept for one more release. `@dead` silences the report but does not keep its
// dependencies alive, and reanalyze reports it if something starts using it.
@dead
let legacyRender = (value: int): string => `#${value->Int.toString}`

// Ordinary code: used by the suite, so it needs no annotation.
let clamp = (value: int, ~min: int, ~max: int): int => value < min ? min : value > max ? max : value
