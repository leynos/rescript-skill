/***
Variant representations chosen to match an existing JavaScript shape.

`@tag` renames the discriminator field and `@as` sets each constructor's tag
value, so a ReScript variant can be the JavaScript object a library or a JSON
payload already uses. `@unboxed` removes the wrapper entirely when the payload
types can be told apart at runtime.
*/

// `{kind: "click", x, y}` or `{kind: "key", key}`, with no `TAG` field.
@tag("kind")
type uiEvent =
  | @as("click") Click({x: int, y: int})
  | @as("key") Key({key: string})

/** Describes a UI event in words. */
let describeEvent = (event: uiEvent): string =>
  switch event {
  | Click({x, y}) => `click at ${x->Int.toString},${y->Int.toString}`
  | Key({key}) => `key ${key}`
  }

// A JavaScript union `string | number` as a variant that compiles to the bare value.
@unboxed
type padding =
  | Spaces(int)
  | Text(string)

@send external padStartRaw: (string, int, padding) => string = "padStart"

/**
Pads `text` on the left to `width`. `Spaces(count)` pads with `count` spaces,
and `Text(s)` pads with `s`.
*/
let padLeft = (text: string, width: int, padding: padding): string =>
  switch padding {
  | Spaces(count) => text->padStartRaw(width, Text(" "->String.repeat(count)))
  | Text(_) => text->padStartRaw(width, padding)
  }

// Enum-like strings from an external API that may grow new values: the
// catch-all keeps unknown values representable instead of lying about them.
@unboxed
type plan =
  | @as("free") Free
  | @as("team") Team
  | Other(string)

/**
Wraps a plan name from an external API. Names other than `free` and `team` are
kept as `Other`, so unknown values stay representable.
*/
let planFromString = (raw: string): plan => (raw :> plan)

/** Returns the seat count of a plan, or `None` when the plan is unknown. */
let seats = (plan: plan): option<int> =>
  switch plan {
  | Free => Some(1)
  | Team => Some(10)
  | Other(_) => None
  }
