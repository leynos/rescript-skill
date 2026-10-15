# Warnings policy

`bsc -warn-help` (from `node_modules/@rescript/<platform>/bin/bsc.exe`) prints
the authoritative list for the installed compiler.

## Defaults versus `+A`

Measured with ReScript 12.3.1 and no `warnings` block:

| Warning | Meaning                                | Default | Under `+A` with `error: +A` |
| ------- | -------------------------------------- | ------- | --------------------------- |
| 3       | deprecated feature                     | warning | error                       |
| 4       | fragile match (`_` over variant cases) | off     | error                       |
| 8       | non-exhaustive match                   | warning | error                       |
| 9       | record pattern omits labels            | off     | error                       |
| 26, 27  | unused variable                        | warning | error                       |
| 32–39   | unused value, open, type, constructor  | varies  | error                       |
| 41      | ambiguous constructor or label         | off     | error                       |
| 44, 45  | `open` shadows a name                  | warning | error                       |
| 102     | polymorphic comparison                 | off     | error                       |
| 109     | top-level expression not `unit`        | error   | error                       |
| 110     | `%todo` found                          | warning | error                       |

_Table 1: Default status of selected warnings, and their status under `+A`._

`+A` is a strong posture: deprecated APIs, `%todo`, fragile wildcards, and
polymorphic comparison all stop the build. It suits libraries and codebases
that want the compiler to carry the review burden. An application may
reasonably start from the defaults and promote a chosen set instead.

## Living with `+A`

- **Warning 4**: list the remaining constructors instead of `_`, or match on
  a helper that returns an option (`JSON.Decode.*` for JSON). Wildcards over
  extensible types such as `exn` are fine.
- **Warning 9**: close record patterns with `, _`: `{amount, _}`.
- **Warning 41**: annotate the binding (`let c: Payment.card = Card(...)`)
  when a constructor or label exists in several types, as after a spread.
- **Warning 102**: write typed equality (`equalPoint`, `Option.equal`,
  `Int.compare`). It cannot be suppressed locally in 12.3.1.
- **Warning 3**: migrate the call; `rescript-tools migrate` usually can.
- **Warning 110**: `%todo` is a deliberate tripwire. With `+A` it blocks the
  build; without it, use `rescript build --warn-error "+110"` in continuous
  integration (CI).

## Local suppression

`@warning("-N")` on a binding, expression, or `let` and `@@warning("-N")` for
the rest of a module work for type-checking warnings (for example 4, 9, 27,
32). They do not work for warnings emitted after type checking, such as 102.
Every local suppression needs a comment saying why the code is right.

## Changing the project policy

Prefer subtracting one number with a reason over weakening the whole policy:

```json
{
  "warnings": {
    "number": "+A-102",
    "error": "+A"
  }
}
```

Record why in the project's developer documentation. A growing list of
subtracted numbers means the policy is not being kept; decide which posture the
project actually wants.

## CI-only strictness

`rescript build --warn-error "+3+110"` overrides the configured error set for
one build, so developers can work with `%todo` and deprecated calls locally
while CI refuses to merge them.
