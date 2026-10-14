# JSON decoding and encoding

## The trust boundary

`JSON.parseOrThrow` gives you a `JSON.t`, not a `user`. Typing an `external` or
a `%identity` cast as `JSON.t => user` moves the failure from the edge, where
the payload is in hand, to some later field access where it is not. Decode at
the edge and return `result`.

## `JSON.t`

```rescript
@unboxed
type rec t =
  | Boolean(bool)
  | @as(null) Null
  | String(string)
  | Number(float)
  | Object(dict<t>)
  | Array(array<t>)
```

Because it is unboxed, constructing `JSON.Object(dict{...})` builds the plain
JavaScript value, and matching on a parsed value inspects it directly. Numbers
are always `float`; checking that a number is a 32-bit integer is the decoder's
job.

## Decoding with the standard library

`JSON.Decode.bool`, `string`, `float`, `object`, `array`, and `null` each
return an option for one JSON kind. Matching on that option is exhaustive,
which matters under `+A`: warning 4 rejects `| _ =>` over `JSON.t`'s six
constructors.

```rescript
let int = (json: JSON.t, path) =>
  switch json->JSON.Decode.float {
  | Some(n) if Math.trunc(n) == n && n <= 2147483647. && n >= -2147483648. => Ok(n->Float.toInt)
  | Some(_) | None => fail(path, "a 32-bit integer")
  }
```

Carry a path in the error (`$[1].id`) so the person debugging a payload knows
where to look. [JsonDecoding.res](examples/JsonDecoding.res) builds a full
decoder this way, treats a missing key and `null` alike for an optional field,
and has a matching encoder. Its suite checks that encoding then decoding
returns the original.

Handwritten decoders are fine for a handful of types. Past that, the encoder
and decoder drift; use a schema.

## Sury schemas

[Sury](https://github.com/DZakh/sury) (11.x, the successor to
`rescript-schema`) declares a contract once and derives parsing, encoding, and
JSON Schema from it:

```rescript
let userSchema = S.object(s => {
  id: s.field("id", S.int),
  name: s.field("name", S.string),
  role: s.field("role", roleSchema),
  nickname: s.field("nickname", S.option(S.string)),
})

let parse = (input: JSON.t): result<user, string> =>
  try Ok(input->S.parseOrThrow(~to=userSchema)) catch {
  | S.Exn(error) => Error(error.message)
  }
```

Practical notes, all exercised by [SuryUser.res](examples/SuryUser.res):

- Install with `bun add sury` and list it in `rescript.json`
  `dependencies` (Sury's own README still says `bs-dependencies`).
- Sury throws `S.Exn`; convert to `result` in one place, as above.
- `S.convertOrThrow(value, ~from=userSchema, ~to=S.json)` encodes with the
  same schema.
- Variants with `@as("admin")` payloadless constructors become literal
  schemas with `S.literal(Admin)`.
- Record labels that only the schema reads look dead to reanalyze; mark the
  type `@live` with a comment saying why.
- Sury compiles schemas with `eval`. A Content Security Policy without
  `unsafe-eval` blocks it.
- Its package `exports` admit only in-source output, so the consuming
  project must build with `"in-source": true`.

## Choosing

| Situation                                      | Choice                        |
| ---------------------------------------------- | ----------------------------- |
| one or two small payloads                      | `JSON.Decode` by hand         |
| many types, or encode and decode both needed   | Sury                          |
| browser code under a strict CSP                | handwritten or a non-eval lib |
| data you produced yourself in the same process | no decoding; keep the type    |

Test a decoder with named examples for each rejection and a round trip for the
happy path. When the input space is large, hand the round trip to a property
test (`rescript-property-testing`).
