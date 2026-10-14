/**
Executable evidence for the `rescript-bun-testing` examples.
*/
open RescriptBun.Test

let day = 86_400_000.
let start = Date.fromString("2026-10-01T00:00:00.000Z")->Date.getTime

let invoices: array<OverdueNotifier.invoice> = [
  {id: "a", dueAt: start -. day, paid: false},
  {id: "b", dueAt: start -. day, paid: true},
  {id: "c", dueAt: start +. day, paid: false},
]

describe("OverdueNotifier with injected collaborators", () => {
  test("sends one message per unpaid overdue invoice", () => {
    let send = BunMock.make(_message => ())
    let sent = OverdueNotifier.notifyOverdue(invoices, ~now=() => start, ~send=send->BunMock.fn)
    expect(sent)->Expect.toBe(1)
    expect(send->BunMock.calls)->Expect.toEqual(["invoice a is overdue"])
    // The rescript-bun matcher accepts the mock directly.
    expect(send)->Expect.toHaveBeenCalledTimes(1.)
  })

  test("clear resets the recorded calls", () => {
    let send = BunMock.make(_message => ())
    let _ = OverdueNotifier.notifyOverdue(invoices, ~now=() => start, ~send=send->BunMock.fn)
    send->BunMock.clear
    expect(send->BunMock.callCount)->Expect.toBe(0)
  })
})

// A finite case table. rescript-bun has no `test.each`; each row becomes a
// named test, so a failure report says which row broke.
describe("isOverdue", () => {
  let invoice = (~paid, ~offset): OverdueNotifier.invoice => {
    id: "x",
    dueAt: start +. offset,
    paid,
  }
  [
    ("unpaid and past due", invoice(~paid=false, ~offset=-1.), true),
    ("unpaid and due exactly now", invoice(~paid=false, ~offset=0.), false),
    ("unpaid and not yet due", invoice(~paid=false, ~offset=1.), false),
    ("paid and past due", invoice(~paid=true, ~offset=-1.), false),
  ]->Array.forEach(((label, row, expected)) =>
    test(label, () => expect(row->OverdueNotifier.isOverdue(~now=start))->Expect.toBe(expected))
  )
})

describe("OverdueNotifier against the system clock", () => {
  afterEach(() => BunClock.reset())

  test("setSystemTime controls Date.now", () => {
    setSystemTime(Date(Date.fromTime(start +. 2. *. day)))
    let send = BunMock.make(_message => ())
    let sent = OverdueNotifier.notifyOverdueNow(invoices, ~send=send->BunMock.fn)
    expect(sent)->Expect.toBe(2)
  })

  test("reset restores the real clock", () => {
    setSystemTime(Date(Date.fromString("2000-01-01T00:00:00.000Z")))
    BunClock.reset()
    expect(Date.now())->Expect.toBeGreaterThan(
      Date.fromString("2020-01-01T00:00:00.000Z")->Date.getTime,
    )
  })
})
