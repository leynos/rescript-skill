/**
Executable evidence for the `rescript-property-testing` examples.

Each property is a relation that should hold for every generated input: a
round trip, agreement between two implementations, an oracle, idempotence,
and agreement with a model across operation sequences.
*/
open RescriptBun.Test

module Fc = FastCheck

let runs = {Fc.numRuns: 200}

// Structural equality on the JavaScript representation, as `toEqual` uses.
// Typing both sides `'a` keeps it from comparing unrelated types; polymorphic
// `==` on records would trip warning 102 under `+A`.
let same = (a: 'a, b: 'a): bool => RescriptBun.Bun.deepEquals(a, b)

// Types cannot be declared inside a function body, including a `describe`
// callback, so the model-based test's command type lives in a module.
module RingModel = {
  type command = Push(int) | Pop

  let command = Fc.oneof([Fc.int()->Fc.map(n => Push(n)), Fc.constantFrom([Pop])])

  // The model is the obviously correct, slow version: an array.
  let apply = (model: array<int>, ~capacity: int, command: command): (array<int>, option<int>) =>
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

  let agrees = (capacity: int, commands: array<command>): bool => {
    let buffer = RingBuffer.make(~capacity)
    let (_, agrees) = commands->Array.reduce(([], true), ((model, agrees), command) => {
      let (nextModel, expected) = model->apply(~capacity, command)
      let actual = switch command {
      | Push(n) =>
        buffer->RingBuffer.push(n)
        None
      | Pop => buffer->RingBuffer.pop
      }
      let matches =
        same(actual, expected) &&
        same(RingBuffer.toArray(buffer), nextModel) &&
        RingBuffer.size(buffer) == nextModel->Array.length
      (nextModel, agrees && matches)
    })
    agrees
  }
}

// --- Arbitraries for domain types --------------------------------------------

let role = Fc.constantFrom([JsonDecoding.Admin, Member])

let user =
  Fc.tuple3(Fc.int(), Fc.string(), role)->Fc.chain(((id, name, role)) =>
    Fc.option(Fc.string())->Fc.map((nickname): JsonDecoding.user => {id, name, role, nickname})
  )

// Keys drawn from the ones the parser reads, plus noise, so generated
// environments exercise missing, present, and irrelevant keys.
let envEntry = Fc.tuple2(
  Fc.constantFrom(["HOST", "PORT", "OTHER"]),
  Fc.oneof([Fc.string(), Fc.int(~constraints={min: -5, max: 70000})->Fc.map(n => Int.toString(n))]),
)

let env = Fc.array(envEntry, ~constraints={maxLength: 5})->Fc.map(Dict.fromArray)

// --- Properties ----------------------------------------------------------------

describe("round trip", () => {
  test("decoding an encoded user returns it unchanged", () =>
    Fc.check(
      Fc.property1(user, u => same(JsonDecoding.user(JsonDecoding.encodeUser(u), "$"), Ok(u))),
      ~parameters=runs,
    )
  )
})

describe("agreement between implementations", () => {
  test("let? and flatMap pipelines agree on every environment", () =>
    Fc.check(
      Fc.property1(env, e => same(ConfigParsing.fromEnv(e), ConfigParsing.fromEnvWithFlatMap(e))),
      ~parameters=runs,
    )
  )
})

describe("oracle", () => {
  let isPort = raw =>
    /^[0-9]+$/->RegExp.test(raw) &&
      switch Float.fromString(raw) {
      | Some(n) => n >= 1. && n <= 65535.
      | None => false
      }

  test("parsePort accepts exactly the decimal strings in range", () =>
    Fc.check(
      Fc.property1(
        Fc.oneof([
          Fc.string(),
          Fc.int(~constraints={min: -10, max: 70000})->Fc.map(n => Int.toString(n)),
        ]),
        raw => Result.isOk(ConfigParsing.parsePort(raw)) == isPort(raw),
      ),
      ~parameters=runs,
    )
  )

  // Named regressions stay beside the property that generalizes them.
  test("regression: trailing garbage is rejected", () => {
    expect(ConfigParsing.parsePort("80abc"))->Expect.toEqual(
      Error(ConfigParsing.InvalidPort("80abc")),
    )
  })
})

describe("idempotence", () => {
  test("normalizing an email address twice changes nothing", () =>
    Fc.check(
      Fc.property1(
        Fc.string(),
        raw =>
          switch EmailAddress.make(raw) {
          | Ok(email) => same(EmailAddress.make(EmailAddress.toString(email)), Ok(email))
          | Error(_) => true
          },
      ),
      ~parameters=runs,
    )
  )
})

describe("model-based", () => {
  test("every operation sequence agrees with the array model", () =>
    Fc.check(
      Fc.property2(
        Fc.int(~constraints={min: 1, max: 4}),
        Fc.array(RingModel.command, ~constraints={maxLength: 30}),
        RingModel.agrees,
      ),
      ~parameters=runs,
    )
  )
})

describe("failure reports", () => {
  test("a failing property reports its counterexample, seed, and path", () => {
    let report = switch Fc.check(Fc.property1(Fc.int(), n => n < 100), ~parameters={seed: 42}) {
    | () => "passed"
    | exception JsExn(error) => error->JsExn.message->Option.getOr("")
    }
    expect(report)->Expect.toInclude("Counterexample: [100]")
    expect(report)->Expect.toInclude("seed: 42")
    expect(report)->Expect.toInclude("path:")
  })
})
