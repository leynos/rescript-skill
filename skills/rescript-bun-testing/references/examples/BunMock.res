/***
Narrow bindings for `bun:test` mocks, which `rescript-bun` 2.1.0 does not bind.

`mock(fn)` returns a callable function that records its calls. ReScript sees
two views of the same JavaScript value: `t<'arg, 'ret>` for inspection and an
ordinary function for injection. `%identity` converts between them; it is safe
here because `mock` returns the function itself.

Only single-argument functions are bound. Bind another arity when a test needs
it, rather than typing the arguments as `'a`.
*/

type t<'arg, 'ret>

@module("bun:test") external make: ('arg => 'ret) => t<'arg, 'ret> = "mock"

external fn: t<'arg, 'ret> => 'arg => 'ret = "%identity"

type state<'arg> = {calls: array<array<'arg>>}

@get external state: t<'arg, 'ret> => state<'arg> = "mock"

/** The arguments of each call, oldest first. */
let calls = (mock: t<'arg, 'ret>): array<'arg> =>
  mock->state->(state => state.calls)->Array.filterMap(args => args[0])

let callCount = (mock: t<'arg, 'ret>): int => (mock->state).calls->Array.length

@send external clear: t<'arg, 'ret> => unit = "mockClear"
