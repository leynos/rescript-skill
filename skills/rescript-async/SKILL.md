---
name: rescript-async
description: Use for asynchronous ReScript 12 code — `async`/`await`, the `Promise` module, rejection handling and the `exn` it carries, `Promise.all` and `allSettled`, timeouts, bounded concurrency, fire-and-forget discipline, and cooperative cancellation with `AbortSignal`.
metadata:
  globs: "**/*.res, **/*.resi"
---

# Asynchronous ReScript

Use this when promises are involved and the question is about failure, timing,
ordering, or cancellation, not merely syntax.

## Working stance

- A ReScript `promise<'a>` is a JavaScript promise: eager, uncancellable,
  and rejectable with any value. Design around those facts instead of wishing
  them away.
- Prefer `async`/`await` with `try`/`catch` or `switch ... | exception`. Use
  `Promise.then` chains only where a combinator reads better.
- Turn rejections into `result` at the boundary that knows what they mean.
  Code further in should see data.
- Every promise is either awaited, returned, or deliberately detached with
  its rejection handled. A dropped rejection exits a Bun process with status 1
  and fails the running test.
- Bound concurrency. `Promise.all(items->Array.map(f))` starts everything at
  once.
- Timeouts bound how long the caller waits; only cancellation stops work.

## Decision surface

| Need                                    | Default move                                                 |
| --------------------------------------- | ------------------------------------------------------------ |
| sequence dependent steps                | `await` in an `async` function                               |
| several independent calls, all required | `Promise.all` or `Promise.all2` … `all6`                     |
| several calls, keep every outcome       | map each through a `try`-based `attempt`, then `Promise.all` |
| first to finish wins                    | `Promise.race`, then clean up the losers' timers             |
| cap a slow call                         | `withTimeout` returning `result<'a, timeoutError>`           |
| limit in-flight work                    | a worker pool over a shared cursor (`mapWithLimit`)          |
| stop work early                         | pass an `AbortSignal` the operation observes                 |
| fire and forget                         | attach `Promise.catch`, then `Promise.ignore`                |
| `promise<result<'a, 'e>>` pipelines     | `Result.mapOkAsync`, `Result.flatMapOkAsync`                 |

_Table 1: Default moves for asynchronous code._

## Rules that surprise people

- In an `async` function the return annotation is the inner type:
  `async (id: string): user => ...` has type `string => promise<user>`.
  Interfaces (`.resi`) and type aliases write `promise<user>`.
- Promises do not auto-flatten in ReScript's types: `await` each level of a
  nested promise explicitly.
- `await` inside `switch` is caught by `| exception` cases only if the
  `await` is in the scrutinee: `switch await fetchUser(id) { ... }`.
- `try`/`catch` and `Promise.catch` normalize a raw JavaScript rejection into
  `JsExn(_)`. `Promise.allSettled` does not: its `Rejected({reason})` carries
  the raw value typed as `exn`, so `| JsExn(e)` will not match an `Error`.
- A promise in statement position is a type error (it is not `unit`). The
  fix is never a bare `->ignore`; handle the rejection first, then use
  `Promise.ignore`. `Promise.done` is deprecated.
- Throwing inside an `async` function rejects its promise; reanalyze still
  wants `@throws` on it.
- To pipe an awaited value, wrap it: `{await fetchMail(id)}->String.trim`.

## Red flags

- `->ignore` on a promise with no `Promise.catch` before it.
- `Promise.race` with a timer that is never cleared, keeping the process
  alive.
- A "timeout" that the caller believes cancelled the work.
- `Promise.all` over an unbounded user-supplied array of network calls.
- `catch { | _ => ... }` around `await` that swallows programming errors
  along with network failures.
- `Promise.make` wrapping something that already returns a promise.
- Shared mutable state updated across `await` points without considering
  interleaving.

## References

- [promise-patterns.md](references/promise-patterns.md): rejection
  handling, `exn` normalization, `all` versus `allSettled`, fire-and-forget,
  async results, and testing async code.
- [timeouts-and-cancellation.md](references/timeouts-and-cancellation.md):
  timers, `race`, worker pools, `AbortController` bindings, and how far
  cancellation reaches.
- Executable example:
  [AsyncPatterns.res](references/examples/AsyncPatterns.res).
