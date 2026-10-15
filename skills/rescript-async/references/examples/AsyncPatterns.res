/***
Promise patterns that keep failure, timing, and cancellation explicit.

ReScript promises are JavaScript promises: eager, uncancellable, and rejected
with any thrown value. These helpers turn those properties into types the
caller must handle.
*/

// --- Timers -----------------------------------------------------------------

/** Resolves with unit after `ms` milliseconds. */
let sleep = (ms: int): promise<unit> =>
  Promise.make((resolve, _reject) => setTimeout(() => resolve(), ms)->ignore)

type timeoutError = TimedOut(int)

/**
Waits for `work` for at most `ms` milliseconds. Resolves with `Ok` when `work`
settles first, or with `TimedOut` when `ms` elapses first.

`Promise.race` settles with the first promise, but the loser keeps running: a
timeout bounds how long the caller waits, not how long the work runs. The
timer is cleared on every path so a fast result does not keep the process
alive for the full timeout.
*/
let withTimeout = async (work: promise<'a>, ms: int): result<'a, timeoutError> => {
  let timer = ref(None)
  let timeout = Promise.make((resolve, _reject) => {
    timer := Some(setTimeout(() => resolve(Error(TimedOut(ms))), ms))
  })
  await Promise.race([
    work->Promise.thenResolve(value => Ok(value)),
    timeout,
  ])->Promise.finally(() => timer.contents->Option.forEach(clearTimeout))
}

// --- Rejections ---------------------------------------------------------------

exception QuotaExceeded(int)

/**
Returns `used + 1` while quota remains. Otherwise rejects with
`QuotaExceeded(limit)`. Throwing inside an `async` function rejects its promise.
*/
@throws(QuotaExceeded)
let reserve = async (~used: int, ~limit: int): int =>
  if used >= limit {
    throw(QuotaExceeded(limit))
  } else {
    used + 1
  }

/**
Describes a rejection reason as a message. A rejection reason is an `exn`: a
ReScript exception, or `JsExn` wrapping whatever JavaScript threw.
*/
let describeRejection = (reason: exn): string =>
  switch reason {
  | QuotaExceeded(limit) => `quota of ${limit->Int.toString} exceeded`
  | JsExn(error) => error->JsExn.message->Option.getOr("non-Error value thrown")
  | _ => "unexpected exception"
  }

/**
Awaits `work` and returns its value as `Ok`, or its rejection as an `Error`
message. The `try` around `await` catches the rejection and normalizes a raw
JavaScript value into `JsExn`, so `describeRejection` sees it.
*/
let attempt = async (work: unit => promise<'a>): result<'a, string> =>
  try Ok(await work()) catch {
  | reason => Error(describeRejection(reason))
  }

/**
Waits for every promise and returns each outcome in input order. Every promise
runs to completion and no failure is lost. Wrapping each one in `attempt` is
deliberate: `Promise.allSettled` types its rejection reason as `exn` but passes
raw JavaScript values through unwrapped, so a rejected `Error` would not match
`JsExn(_)`.
*/
let settleAll = (work: array<promise<'a>>): promise<array<result<'a, string>>> =>
  Promise.all(work->Array.map(task => attempt(() => task)))

// --- Bounded concurrency ------------------------------------------------------

/**
Maps `f` over `items` with at most `limit` calls in flight, and returns the
results in input order. Rejects with `Invalid_argument` when `limit` is below 1.

`Promise.all(items->Array.map(f))` starts every task at once. A small pool of
workers pulling from a shared cursor caps the number in flight.
*/
@throws(Invalid_argument)
let mapWithLimit = async (items: array<'a>, ~limit: int, f: 'a => promise<'b>): array<'b> => {
  // With no workers nothing would run and every item would silently vanish.
  if limit < 1 {
    throw(Invalid_argument(`mapWithLimit: limit must be at least 1, got ${limit->Int.toString}`))
  }
  let results = Array.make(~length=items->Array.length, None)
  let cursor = ref(0)
  let worker = async () => {
    while cursor.contents < items->Array.length {
      let index = cursor.contents
      cursor := index + 1
      let value = await f(items->Array.getUnsafe(index))
      results->Array.setUnsafe(index, Some(value))
    }
  }
  let workers = Array.fromInitializer(~length=Math.Int.min(limit, items->Array.length), _ =>
    worker()
  )
  let _: array<unit> = await Promise.all(workers)
  results->Array.filterMap(value => value)
}

// --- Cancellation -------------------------------------------------------------

// The standard library has no AbortController bindings; these are the few a
// cancellable operation needs.
type abortController
type abortSignal

@new external makeAbortController: unit => abortController = "AbortController"
@get external signal: abortController => abortSignal = "signal"
@send external abort: abortController => unit = "abort"
@get external aborted: abortSignal => bool = "aborted"
@send
external onAbort: (abortSignal, @as("abort") _, unit => unit, @as(json`{"once": true}`) _) => unit =
  "addEventListener"
@send
external offAbort: (abortSignal, @as("abort") _, unit => unit) => unit = "removeEventListener"

type sleepOutcome = Slept | Cancelled

/**
Resolves with `Slept` after `ms` milliseconds, or with `Cancelled` as soon as
`signal` aborts. Cancellation is cooperative: the operation must observe the
signal.
*/
let cancellableSleep = (ms: int, signal: abortSignal): promise<sleepOutcome> =>
  Promise.make((resolve, _reject) =>
    if signal->aborted {
      resolve(Cancelled)
    } else {
      let timer = ref(None)
      let cancel = () => {
        timer.contents->Option.forEach(clearTimeout)
        resolve(Cancelled)
      }
      // `once` removes the listener only if `abort` fires. A sleep that
      // completes must remove it, or every call on a long-lived signal leaves
      // a closure behind.
      timer := Some(setTimeout(() => {
            signal->offAbort(cancel)
            resolve(Slept)
          }, ms))
      signal->onAbort(cancel)
    }
  )
