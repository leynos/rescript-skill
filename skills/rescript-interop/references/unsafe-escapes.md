# Unsafe escapes

ReScript's guarantees end where you tell the compiler something it cannot
check. These are the ways to do that, from least to most dangerous.

## `Nullable.t` and `Null.t`

Not unsafe, but often forgotten. JavaScript has two empty values; `option` has
one.

| Type             | Empty values           | Convert to `option` |
| ---------------- | ---------------------- | ------------------- |
| `option<'a>`     | `undefined`            | already one         |
| `Null.t<'a>`     | `null`                 | `Null.toOption`     |
| `Nullable.t<'a>` | `null` and `undefined` | `Nullable.toOption` |

Type a binding's input or output with `Nullable.t` when JavaScript may produce
either, convert once, and use `option` everywhere else. `Nullable.make` and
`Nullable.fromOption` go the other way.

## `unknown`

`unknown` is the honest type for "JavaScript gave me something". `JsExn.t` is
`unknown`. Inspect it with `Type.Classify.classify`, or decode it, before
treating it as anything else.

## `external` with a concrete type

Every binding is an unchecked claim. Keep the claim small and concrete, and
prove it with a test that calls the real JavaScript.

## `%identity` casts

```rescript
external intToFloat: int => float = "%identity"
```

Zero-cost reinterpretation. Acceptable only when the runtime representations
are provably identical and the stdlib offers no conversion; in practice the
stdlib usually does (`Int.toFloat`). Prefer coercion `(x :> t)`, which the
compiler checks.

## `Obj.magic`

`'a => 'b` with no check at all. A use in application code is a design bug. In
a binding module it may bridge a JavaScript API whose type cannot be expressed,
with a comment stating the invariant and a test exercising it.

## `%raw`

```rescript
let add: (int, int) => int = %raw("(a, b) => a + b")
```

Embeds JavaScript text the compiler neither parses nor types. Always annotate
the binding's type, keep it in a binding module, and prefer an `external`:
`%raw` code is invisible to reanalyze, to the formatter, and to anyone reading
only ReScript. `%%raw` inserts top-level statements and is worse still.

## genType

`@genType` on a value or type makes the compiler emit a `.gen.tsx` (or the
configured extension) with TypeScript types for it, configured by
`gentypeconfig` in `rescript.json`. Use it when TypeScript code consumes
ReScript modules. It describes the ReScript runtime representation, so the
earlier advice applies: expose plain data at the boundary. ReScript 12 maps
more standard-library types to TypeScript without shims.

## Review checklist

- Does every `%raw`, `%identity`, and `Obj.magic` have a comment stating why
  it is safe and a test that would fail if it were not?
- Does any binding mention a type variable that appears only in its return
  type? That is an unchecked cast.
- Are nullable JavaScript values typed `Nullable.t` or bound with
  `@return(nullable)`, rather than `option`?
- Does any exported function throw a ReScript exception at a JavaScript
  caller?
