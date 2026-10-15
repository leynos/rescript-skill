# Promise patterns

Every behaviour described here is exercised by `tests/Async.test.res` against
[AsyncPatterns.res](examples/AsyncPatterns.res).

## Typing async functions

```rescript
// Implementation: annotate the resolved type.
let fetchName = async (id: string): string => await lookup(id)
```

```resi
// Interface: write the promise.
let fetchName: string => promise<string>
```

An `async` function and a function returning `promise<'a>` are the same type,
so bindings to promise-returning JavaScript work with `await` directly.

## Catching rejections

What arrives in a handler is an `exn`:

```rescript
let describeRejection = (reason: exn): string =>
  switch reason {
  | QuotaExceeded(limit) => `quota of ${limit->Int.toString} exceeded`
  | JsExn(error) => error->JsExn.message->Option.getOr("non-Error value thrown")
  | _ => "unexpected exception"
  }
```

Three ways in, with different normalization:

| Mechanism                                   | Raw JavaScript rejection arrives as |
| ------------------------------------------- | ----------------------------------- |
| `try Ok(await p) catch { \| e => ... }`     | `JsExn(value)`                      |
| `p->Promise.catch(e => ...)`                | `JsExn(value)`                      |
| `Promise.allSettled` → `Rejected({reason})` | the raw value, unwrapped            |

_Table 1: What each catching mechanism receives for a raw JavaScript rejection._

The compiler wraps caught values with
`Primitive_exceptions.internalToException` and `Promise.catch` calls
`anyToExnInternal`; `allSettled` is a plain external. So when every outcome
matters, map each promise through a `try`-based helper instead:

```rescript
let attempt = async (work: unit => promise<'a>): result<'a, string> =>
  try Ok(await work()) catch {
  | reason => Error(describeRejection(reason))
  }

let settleAll = (work: array<promise<'a>>) =>
  Promise.all(work->Array.map(task => attempt(() => task)))
```

## Matching on awaited values

```rescript
let load = async id =>
  switch await fetchUser(id) {
  | user => Ok(user)
  | exception JsExn(error) => Error(error->JsExn.message)
  }
```

The `exception` case only covers what happens inside the scrutinee. Awaiting
into a `let` first and switching afterwards moves the await outside the handler.

## Fire and forget

A promise expression in statement position does not type-check: it is not
`unit`. That forces a decision. The right one is almost always:

```rescript
sendAnalytics(event)
->Promise.catch(error => {
  Console.error2("analytics failed", error)
  Promise.resolve()
})
->Promise.ignore
```

`Promise.ignore` only accepts a promise, so it documents intent and fails to
compile if the expression changes type. Bun exits with status 1 on an unhandled
rejection, and `bun test` fails the test that produced it, so a bare `->ignore`
on a promise that can reject is a crash waiting for a bad day.

## `promise<result<...>>` helpers

ReScript 12 added `Result.mapOkAsync`, `Result.mapErrorAsync`,
`Result.flatMapOkAsync`, and `Result.flatMapErrorAsync`. They thread a
`promise<result<'a, 'e>>` through further steps. Inside an `async` function,
`await` plus `switch` (or `let?` where enabled) is usually clearer; reach for
the helpers in point-free pipelines.

## Concurrency and shared state

JavaScript runs one callback at a time, but every `await` is a point where
other tasks run. State read before an `await` may be stale after it. Keep
per-task state local, and confine shared mutation to one place, as
`mapWithLimit` does with its cursor: the read and increment happen between
awaits, so no two workers claim the same index.

## Testing async code

Use `testAsync` from `RescriptBun.Test`:

```rescript
testAsync("returns TimedOut when the timer wins", async () => {
  let slow = AsyncPatterns.sleep(200)->Promise.thenResolve(() => 1)
  let outcome = await AsyncPatterns.withTimeout(slow, 5)
  expect(outcome)->Expect.toEqual(Error(AsyncPatterns.TimedOut(5)))
})
```

Keep real delays to a few milliseconds and assert on ordering and outcomes, not
on elapsed time. For time-dependent logic, inject a clock or sleep function, or
use `setSystemTime` (see `rescript-bun-testing`).
