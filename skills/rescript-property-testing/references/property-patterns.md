# Property patterns

All examples come from `tests/PropertyTesting.test.res`.

## Arbitraries for domain types

Build valid values by construction:

```rescript
let role = Fc.constantFrom([JsonDecoding.Admin, Member])

let user =
  Fc.tuple3(Fc.int(), Fc.string(), role)->Fc.chain(((id, name, role)) =>
    Fc.option(Fc.string())->Fc.map((nickname): JsonDecoding.user => {id, name, role, nickname})
  )
```

For inputs to a parser, mix valid-looking and arbitrary values so both branches
get exercised:

```rescript
let envEntry = Fc.tuple2(
  Fc.constantFrom(["HOST", "PORT", "OTHER"]),
  Fc.oneof([Fc.string(), Fc.int(~constraints={min: -5, max: 70000})->Fc.map(n => Int.toString(n))]),
)
```

Pure `Fc.string()` almost never produces `"8080"`; drawing keys from the set
the parser reads and values from a range around the valid one is what makes the
property reach the interesting code.

## Typed equality in predicates

Predicates compare structured values constantly. Polymorphic `==` on records
and results trips warning 102 under `+A`, and it cannot be silenced locally. In
tests, wrap Bun's deep equality with a type that forbids comparing unrelated
values:

```rescript
let same = (a: 'a, b: 'a): bool => RescriptBun.Bun.deepEquals(a, b)
```

This is the comparison `Expect.toEqual` uses. Its non-strict mode treats an
`undefined` field like an absent one, which matches how `None` is represented.

## Round trip

```rescript
Fc.property1(user, u => same(JsonDecoding.user(JsonDecoding.encodeUser(u), "$"), Ok(u)))
```

Any encoder and decoder pair, serializer, or parser and printer has one. It
does not prove either side matches a specification; keep a few named examples
of the wire format too.

## Agreement

```rescript
Fc.property1(env, e => same(ConfigParsing.fromEnv(e), ConfigParsing.fromEnvWithFlatMap(e)))
```

Use it for refactors (old versus new), optimizations (fast versus naive), and
alternative formulations, as here with `let?` versus `flatMap`.

## Oracle

```rescript
let isPort = raw =>
  /^[0-9]+$/->RegExp.test(raw) &&
    switch Float.fromString(raw) {
    | Some(n) => n >= 1. && n <= 65535.
    | None => false
    }

Fc.property1(arbitraryText, raw => Result.isOk(ConfigParsing.parsePort(raw)) == isPort(raw))
```

The oracle must be obviously right, even if slow or ugly. If the oracle is as
complicated as the code, the property tests nothing.

## Idempotence

```rescript
Fc.property1(Fc.string(), raw =>
  switch EmailAddress.make(raw) {
  | Ok(email) => same(EmailAddress.make(EmailAddress.toString(email)), Ok(email))
  | Error(_) => true
  }
)
```

Normalizers, formatters, and canonicalizers should be idempotent.

## Model-based testing

For stateful code, generate a sequence of commands and check that the subject
and a simple model agree after each one:

```rescript
module RingModel = {
  type command = Push(int) | Pop

  let command = Fc.oneof([Fc.int()->Fc.map(n => Push(n)), Fc.constantFrom([Pop])])

  let apply = (model: array<int>, ~capacity: int, command: command) =>
    switch command {
    | Push(n) =>
      let pushed = model->Array.concat([n])
      let overflow = pushed->Array.length - capacity
      (overflow > 0 ? pushed->Array.slice(~start=overflow) : pushed, None)
    | Pop =>
      switch model[0] {
      | Some(first) => (model->Array.slice(~start=1), Some(first))
      | None => (model, None)
      }
    }
}
```

The command type must live in a module: ReScript does not allow type
declarations inside a function such as a `describe` callback. Shrinking works
on the generated array, so failures arrive as the shortest command sequence
that breaks the subject. fast-check's own `fc.commands` API expects classes with
`check` and `run` methods; a variant plus a fold is simpler to type in
ReScript and shrinks just as well.

## Make sure the property can fail

A property that cannot fail proves nothing. While writing one, break the
subject on purpose and watch it fail. For the ring buffer, removing the line
that advances `start` on overflow produced:

```text
Counterexample: [2,[{"TAG":"Push","_0":0},{"TAG":"Push","_0":0},{"TAG":"Push","_0":-1}]]
```

Capacity 2, three pushes: the smallest overflow. The failure report also
carries the seed and path for replay; the suite's last test asserts that it
does.
