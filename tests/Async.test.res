/**
Executable evidence for the `rescript-async` examples.
*/
open RescriptBun.Test

// A rejection with a raw JavaScript `Error`, as a fetch or driver would produce.
let failingRequest = () => Promise.make((_resolve, reject) => reject(JsError.make("network down")))

describe("withTimeout", () => {
  testAsync("returns the value when work finishes first", async () => {
    let outcome = await AsyncPatterns.withTimeout(Promise.resolve(7), 1000)
    expect(outcome)->Expect.toEqual(Ok(7))
  })

  testAsync("returns TimedOut when the timer wins", async () => {
    let slow = AsyncPatterns.sleep(200)->Promise.thenResolve(() => 1)
    let outcome = await AsyncPatterns.withTimeout(slow, 5)
    expect(outcome)->Expect.toEqual(Error(AsyncPatterns.TimedOut(5)))
  })

  testAsync("propagates a rejection from the work", async () => {
    let failing = AsyncPatterns.reserve(~used=3, ~limit=3)
    let outcome = await AsyncPatterns.attempt(() => AsyncPatterns.withTimeout(failing, 1000))
    expect(outcome)->Expect.toEqual(Error("quota of 3 exceeded"))
  })
})

describe("rejections", () => {
  testAsync("settleAll keeps every outcome in order", async () => {
    let outcomes = await AsyncPatterns.settleAll([
      Promise.resolve(1),
      AsyncPatterns.reserve(~used=10, ~limit=10),
      Promise.make((_resolve, reject) => reject(JsError.make("boom")->JsError.toJsExn)),
    ])
    expect(outcomes)->Expect.toEqual([Ok(1), Error("quota of 10 exceeded"), Error("boom")])
  })

  testAsync("allSettled leaves a raw JavaScript rejection unwrapped", async () => {
    let rejected = Promise.make((_resolve, reject) => reject(JsError.make("boom")))
    let outcomes = await Promise.allSettled([rejected])
    let reasons = outcomes->Array.filterMap(
      outcome =>
        switch outcome {
        | Rejected({reason}) => Some(reason)
        | Fulfilled(_) => None
        },
    )
    // The raw `Error` is not wrapped in `JsExn`, so it falls to the catch-all.
    expect(reasons->Array.map(AsyncPatterns.describeRejection))->Expect.toEqual([
      "unexpected exception",
    ])
  })

  testAsync("reserve succeeds below the quota", async () => {
    expect(await AsyncPatterns.reserve(~used=1, ~limit=3))->Expect.toBe(2)
  })

  testAsync("attempt converts a thrown JavaScript error", async () => {
    let outcome = await AsyncPatterns.attempt(failingRequest)
    expect(outcome)->Expect.toEqual(Error("network down"))
  })

  testAsync("attempt passes a value through", async () => {
    let outcome = await AsyncPatterns.attempt(async () => "ok")
    expect(outcome)->Expect.toEqual(Ok("ok"))
  })
})

describe("mapWithLimit", () => {
  testAsync("never exceeds the limit and preserves order", async () => {
    let inFlight = ref(0)
    let peak = ref(0)
    let task = async n => {
      inFlight := inFlight.contents + 1
      peak := Math.Int.max(peak.contents, inFlight.contents)
      await AsyncPatterns.sleep(5)
      inFlight := inFlight.contents - 1
      n * 2
    }
    let results = await AsyncPatterns.mapWithLimit([1, 2, 3, 4, 5, 6, 7], ~limit=3, task)
    expect(results)->Expect.toEqual([2, 4, 6, 8, 10, 12, 14])
    expect(peak.contents)->Expect.toBe(3)
  })

  testAsync("handles an empty input", async () => {
    let results = await AsyncPatterns.mapWithLimit([], ~limit=3, async n => n)
    expect(results)->Expect.toEqual([])
  })

  testAsync("rejects a limit below 1 before calling f", async () => {
    let called = ref(false)
    let task = async n => {
      called := true
      n
    }
    let outcome = switch await AsyncPatterns.mapWithLimit([1, 2], ~limit=0, task) {
    | results => Ok(results)
    | exception Invalid_argument(message) => Error(message)
    }
    expect(outcome)->Expect.toEqual(Error("mapWithLimit: limit must be at least 1, got 0"))
    expect(called.contents)->Expect.toBe(false)
  })
})

@module("node:events")
external getEventListeners: (AsyncPatterns.abortSignal, string) => array<unit => unit> =
  "getEventListeners"

describe("cancellableSleep", () => {
  testAsync("completes when not aborted", async () => {
    let controller = AsyncPatterns.makeAbortController()
    let outcome = await AsyncPatterns.cancellableSleep(1, controller->AsyncPatterns.signal)
    expect(outcome)->Expect.toBe(AsyncPatterns.Slept)
  })

  testAsync("removes its abort listener when the sleep completes", async () => {
    let signal = AsyncPatterns.makeAbortController()->AsyncPatterns.signal
    let pending = AsyncPatterns.cancellableSleep(1, signal)
    expect(getEventListeners(signal, "abort")->Array.length)->Expect.toBe(1)
    let _ = await pending
    let _ = await AsyncPatterns.cancellableSleep(1, signal)
    expect(getEventListeners(signal, "abort")->Array.length)->Expect.toBe(0)
  })

  testAsync("resolves Cancelled when aborted mid-flight", async () => {
    let controller = AsyncPatterns.makeAbortController()
    let pending = AsyncPatterns.cancellableSleep(10_000, controller->AsyncPatterns.signal)
    controller->AsyncPatterns.abort
    expect(await pending)->Expect.toBe(AsyncPatterns.Cancelled)
  })

  testAsync("resolves Cancelled immediately for an aborted signal", async () => {
    let controller = AsyncPatterns.makeAbortController()
    controller->AsyncPatterns.abort
    let outcome = await AsyncPatterns.cancellableSleep(10_000, controller->AsyncPatterns.signal)
    expect(outcome)->Expect.toBe(AsyncPatterns.Cancelled)
  })
})
