/**
Runtime evidence for the `rescript-deductive-verification` example.

`make prove` discharges `VerifiedLease.step`'s contracts for every input; these
named examples check the same properties on the boundaries the proof turned
up, so a regression shows here even where Dafny is not installed.
*/
open RescriptBun.Test

/** Builds a lease held by "ana" in generation 7 with `handles` open. */
let held = (~handles) => VerifiedLease.Held({generation: 7, owner: "ana", handles})
let released = VerifiedLease.Released({generation: 7, cause: Failed({message: "disk full"})})

describe("VerifiedLease.step", () => {
  test("acquiring an idle lease keeps its generation and starts with no handles", () => {
    expect(VerifiedLease.step(Idle({generation: 7}), Acquire({owner: "ana"})))->Expect.toEqual(
      Ok({state: held(~handles=0)}),
    )
  })

  test("refuses to open past the bound instead of wrapping to a negative count", () => {
    let full = held(~handles=VerifiedLease.maxHandles)
    let outcome = VerifiedLease.step(full, Open({by: "ana"}))
    expect(outcome)->Expect.toEqual(Error({failure: TooManyHandles({generation: 7})}))
    // The case the proof found: without the bound, int32 arithmetic wraps.
    expect(2147483647 + 1)->Expect.toBe(-2147483648)
  })

  test("keeps the ownership invariant on every successful step from a held lease", () => {
    let events: array<VerifiedLease.event> = [
      Open({by: "ana"}),
      Close({by: "ana"}),
      Release({by: "ana", cause: Normal({code: 0})}),
    ]
    events->Array.forEach(
      event =>
        switch VerifiedLease.step(held(~handles=1), event) {
        | Ok({state}) => expect(VerifiedLease.wellFormed(state))->Expect.toBe(true)
        | Error(_) => expect(true)->Expect.toBe(false)
        },
    )
  })

  test("refuses every step by someone other than the owner", () => {
    let events: array<VerifiedLease.event> = [
      Open({by: "bo"}),
      Close({by: "bo"}),
      Release({by: "bo", cause: Normal({code: 0})}),
    ]
    events->Array.forEach(
      event =>
        switch VerifiedLease.step(held(~handles=1), event) {
        | Error({failure}) => expect(failure)->Expect.toEqual(NotOwner({by: "bo"}))
        | Ok(_) => expect(true)->Expect.toBe(false)
        },
    )
  })

  test("preserves the caller's cause when releasing", () => {
    let cause = VerifiedLease.Timeout({afterMs: 30_000})
    expect(VerifiedLease.step(held(~handles=0), Release({by: "ana", cause})))->Expect.toEqual(
      Ok({state: Released({generation: 7, cause})}),
    )
  })

  test("a released lease refuses every event and reports the original cause", () => {
    let events: array<VerifiedLease.event> = [
      Acquire({owner: "ana"}),
      Open({by: "ana"}),
      Close({by: "ana"}),
      Release({by: "ana", cause: Normal({code: 0})}),
    ]
    events->Array.forEach(
      event =>
        expect(VerifiedLease.step(released, event))->Expect.toEqual(
          Error({failure: AlreadyReleased({cause: Failed({message: "disk full"})})}),
        ),
    )
  })

  test("every refusal carries what a caller needs to report it", () => {
    let explainCause = (cause: VerifiedLease.cause) =>
      switch cause {
      | Normal({code}) => `normal ${code->Int.toString}`
      | Timeout({afterMs}) => `timeout after ${afterMs->Int.toString}ms`
      | Failed({message}) => `failed: ${message}`
      }
    let explain = (outcome: VerifiedLease.outcome) =>
      switch outcome {
      | Ok(_) => "ok"
      | Error({failure: NotOwner({by})}) => `${by} does not hold the lease`
      | Error({failure: NoHandles({generation})}) =>
        `no handles to close in generation ${generation->Int.toString}`
      | Error({failure: AlreadyReleased({cause})}) => `already released (${explainCause(cause)})`
      | Error({failure: Invalid({generation})}) =>
        `invalid event in generation ${generation->Int.toString}`
      | Error({failure: TooManyHandles({generation})}) =>
        `handle limit reached in generation ${generation->Int.toString}`
      }
    let cases: array<(VerifiedLease.state, VerifiedLease.event, string)> = [
      (held(~handles=0), Open({by: "bo"}), "bo does not hold the lease"),
      (held(~handles=0), Close({by: "ana"}), "no handles to close in generation 7"),
      (released, Open({by: "ana"}), "already released (failed: disk full)"),
      (held(~handles=0), Acquire({owner: "bo"}), "invalid event in generation 7"),
      (
        held(~handles=VerifiedLease.maxHandles),
        Open({by: "ana"}),
        "handle limit reached in generation 7",
      ),
      (
        VerifiedLease.Released({generation: 1, cause: Normal({code: 0})}),
        Close({by: "ana"}),
        "already released (normal 0)",
      ),
      (
        VerifiedLease.Released({generation: 1, cause: Timeout({afterMs: 5})}),
        Close({by: "ana"}),
        "already released (timeout after 5ms)",
      ),
    ]
    cases->Array.forEach(
      ((state, event, expected)) =>
        expect(explain(VerifiedLease.step(state, event)))->Expect.toBe(expected),
    )
  })

  test("the contract predicates agree with the states they describe", () => {
    expect(VerifiedLease.isOwner(held(~handles=0), "ana"))->Expect.toBe(true)
    expect(VerifiedLease.isOwner(released, "ana"))->Expect.toBe(false)
    expect(VerifiedLease.wellFormed(held(~handles=-1)))->Expect.toBe(false)
    expect(VerifiedLease.generationOf(released))->Expect.toBe(7)
  })
})
