/***
Converting thrown JavaScript errors into `result` at the boundary.

`JSON.parseOrThrow` throws a JS `SyntaxError`. ReScript sees any value thrown
by JavaScript as the `JsExn(JsExn.t)` exception, whose payload is `unknown`
because JavaScript can throw anything. Catch it once, next to the binding, and
hand the rest of the program a `result`.
*/

type parseError = InvalidJson(string)

let parseJson = (text: string): result<JSON.t, parseError> =>
  try Ok(JSON.parseOrThrow(text)) catch {
  | JsExn(exn) => Error(InvalidJson(exn->JsExn.message->Option.getOr("unknown JSON error")))
  }

// A ReScript exception for a broken internal invariant, not an expected input.
exception InvariantBroken(string)

@throws(InvariantBroken)
let checkedRatio = (numerator: int, denominator: int): float =>
  if denominator == 0 {
    throw(InvariantBroken("denominator must be validated before checkedRatio"))
  } else {
    Int.toFloat(numerator) /. Int.toFloat(denominator)
  }

// Catch by constructor; anything else propagates unchanged.
let ratioOrNone = (numerator: int, denominator: int): option<float> =>
  switch checkedRatio(numerator, denominator) {
  | ratio => Some(ratio)
  | exception InvariantBroken(_) => None
  }

// When JavaScript callers need an `Error` instance with a message, throw one.
// reanalyze tracks JS throws as `JsExn`, so the annotation names that.
@throws(JsExn)
let requireNonEmpty = (label: string, value: string): string =>
  value->String.isEmpty ? JsError.throwWithMessage(`${label} must not be empty`) : value
