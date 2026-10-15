# Timeouts and cancellation

## Timers

The standard library binds `setTimeout`, `setTimeoutFloat`, `clearTimeout`,
`setInterval`, and `clearInterval` globally, returning abstract `timeoutId` and
`intervalId` values. A promise-returning sleep is one line:

```rescript
let sleep = (ms: int): promise<unit> =>
  Promise.make((resolve, _reject) => setTimeout(() => resolve(), ms)->ignore)
```

## Timeouts with `race`

```rescript
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
```

Points that matter:

- The timeout resolves to an `Error` rather than rejecting, so the caller's
  `switch` handles it as data.
- `Promise.finally` clears the timer whether the work succeeds, fails, or
  loses. An uncleared timer holds the event loop open for its full duration.
- When the timer wins, `work` keeps running. Its eventual rejection is still
  handled, because `race` attached a handler to it, but its side effects still
  happen.

Bun and other modern runtimes also provide `AbortSignal.timeout(ms)`, which
combines a timer with cancellation for APIs that accept a signal, such as
`fetch`.

## Bounded concurrency

```rescript
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
```

The suite checks that at most `limit` tasks are ever in flight, that output
order matches input order, and that a `limit` below 1 rejects before any task
starts: with no workers, every item would otherwise vanish from a result that
looks successful. If one task rejects, `Promise.all` rejects while other
workers carry on; wrap `f` with `attempt` when partial results matter.

## Cancellation

Promises have no cancellation. The platform convention is `AbortController`:
the owner calls `abort()`, and operations that were handed its `signal` stop.
The standard library does not bind it, so bind only the handful of members the
code needs:

```rescript
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
```

The fixed `@as` arguments compile to
`signal.addEventListener("abort", f, {"once": true})`. `once` removes the
listener only when `abort` fires, so an operation that finishes normally must
remove it with `offAbort`, passing the same function.

Cancellation is cooperative. An operation must check `aborted` before starting
and listen for `abort` while running, then release what it holds:

```rescript
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
```

The suite checks that a completed sleep leaves no listener on the signal, using
`getEventListeners` from `node:events`, which Bun supports for `AbortSignal`.

Resolving with a `Cancelled` constructor keeps cancellation in the type.
Rejecting with an `AbortError` matches what `fetch` does; choose one convention
per codebase and keep to it.

Pass signals down, never up: the code that creates the controller owns the
decision to cancel. Code in a Bun server should take the request's signal
rather than make its own; see `rescript-bun-runtime`.
