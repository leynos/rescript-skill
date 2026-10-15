# Mocks, clocks, and case tables

## Inject first

The most testable ReScript function takes its collaborators as arguments:

```rescript
let notifyOverdue = (invoices: array<invoice>, ~now: unit => float, ~send: string => unit): int => {
  let current = now()
  let overdue = invoices->Array.filter(invoice => invoice->isOverdue(~now=current))
  overdue->Array.forEach(invoice => send(`invoice ${invoice.id} is overdue`))
  overdue->Array.length
}

let notifyOverdueNow = (invoices, ~send) => notifyOverdue(invoices, ~now=Date.now, ~send)
```

Tests pass `~now=() => start`; production passes `Date.now`. No global state
changes, and the test reads as the specification.
[OverdueNotifier.res](examples/OverdueNotifier.res) is the full module.

## Recording calls with `bun:test` mocks

`rescript-bun` 2.1.0 does not bind `mock`. Bind it narrowly:

```rescript
type t<'arg, 'ret>

@module("bun:test") external make: ('arg => 'ret) => t<'arg, 'ret> = "mock"

external fn: t<'arg, 'ret> => 'arg => 'ret = "%identity"

type state<'arg> = {calls: array<array<'arg>>}

@get external state: t<'arg, 'ret> => state<'arg> = "mock"

let calls = (mock: t<'arg, 'ret>): array<'arg> =>
  mock->state->(state => state.calls)->Array.filterMap(args => args[0])
```

Use it:

```rescript
let send = BunMock.make(_message => ())
let sent = OverdueNotifier.notifyOverdue(invoices, ~now=() => start, ~send=send->BunMock.fn)
expect(send->BunMock.calls)->Expect.toEqual(["invoice a is overdue"])
expect(send)->Expect.toHaveBeenCalledTimes(1.)
```

The `%identity` cast is safe because `mock` returns the very function it
records; the binding states that once, with a comment, in a dev source. Bind
one arity per need instead of reaching for `'a`. The full binding, including
`clear`, is [BunMock.res](examples/BunMock.res).

`spyOn(object, "method")` replaces a method in place and is harder to type and
to undo. Prefer injection; bind `spyOn` only for third-party code that cannot
be restructured, and restore it in `afterEach`.

## Controlling time

For code that reads the real clock, `RescriptBun.Test.setSystemTime` fixes
`Date.now()`, `new Date()`, and `Intl.DateTimeFormat`:

```rescript
describe("OverdueNotifier against the system clock", () => {
  afterEach(() => BunClock.reset())

  test("setSystemTime controls Date.now", () => {
    setSystemTime(Date(Date.fromTime(start +. 2. *. day)))
    // ...
  })
})
```

The binding always passes a time, and Bun restores the real clock only when
`setSystemTime` is called with no argument. A `unit` parameter compiles to an
argument-free call, so reset is one line:

```rescript
@module("bun:test") external reset: unit => unit = "setSystemTime"
```

See [BunClock.res](examples/BunClock.res). Always reset in `afterEach`; a
frozen clock leaks into every later test in the process.

`setSystemTime` does not advance timers. For `setTimeout`-driven logic, inject
a sleep or scheduler function, or keep real delays to a few milliseconds.

## Case tables

There is no `test.each` binding. Iterate rows and create one named test per
row, so a failure names the row:

```rescript
[
  ("unpaid and past due", invoice(~paid=false, ~offset=-1.), true),
  ("unpaid and due exactly now", invoice(~paid=false, ~offset=0.), false),
  ("paid and past due", invoice(~paid=true, ~offset=-1.), false),
]->Array.forEach(((label, row, expected)) =>
  test(label, () => expect(row->OverdueNotifier.isOverdue(~now=start))->Expect.toBe(expected))
)
```

Keep rows that each mean something: a boundary, a rule, a regression. A table
of "representative" values is a property test in disguise.

## Async assertions

Prefer awaiting and asserting on values over the `resolves` and `rejects`
matchers:

```rescript
testAsync("returns TimedOut when the timer wins", async () => {
  let outcome = await AsyncPatterns.withTimeout(slow, 5)
  expect(outcome)->Expect.toEqual(Error(AsyncPatterns.TimedOut(5)))
})
```

When the code under test rejects, convert to `result` in the code (see
`rescript-async`) or in a small helper, and assert on the result. A rejected
promise that nobody awaits fails the test that created it.

## Equality in assertions

`Expect.toEqual` compares JavaScript structure, so it works for records,
variants, options, and results without a typed equality function. Variants with
payloads compare `TAG` and fields; `None` is `undefined`. Use `toBe` for
primitives and identity.
