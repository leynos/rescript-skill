/**
Executable evidence for the `rescript-types-and-modules` examples.
*/
open RescriptBun.Test

describe("EmailAddress", () => {
  test("normalizes and accepts a valid address", () => {
    switch EmailAddress.make("  Ada@Example.ORG ") {
    | Ok(email) => expect((email :> string))->Expect.toBe("ada@example.org")
    | Error(_) => expect("rejected")->Expect.toBe("accepted")
    }
  })

  test("names each rejection", () => {
    expect(EmailAddress.make(""))->Expect.toEqual(Error(EmailAddress.Empty))
    expect(EmailAddress.make("ada"))->Expect.toEqual(Error(EmailAddress.MissingAt))
    expect(EmailAddress.make("ada@localhost"))->Expect.toEqual(Error(EmailAddress.MissingDomain))
    expect(EmailAddress.make("@example.org"))->Expect.toEqual(Error(EmailAddress.MissingDomain))
  })

  test("toString and coercion agree", () => {
    switch EmailAddress.make("a@b.c") {
    | Ok(email) => expect(EmailAddress.toString(email))->Expect.toBe((email :> string))
    | Error(_) => expect("rejected")->Expect.toBe("accepted")
    }
  })
})

describe("Payment", () => {
  test("coerces a card into a payment without conversion", () => {
    // Warning 41: `Card` belongs to both `card` and `payment`; annotate.
    let card: Payment.card = Card({amount: 250, last4: "4242"})
    expect(Payment.amountInPence(Payment.fromCard(card)))->Expect.toBe(250)
  })

  // A finite case table: each row is part of the specification.
  [(Payment.Pending, "Pending"), (Settled, "Settled"), (Refunded, "Refunded")]->Array.forEach(((
    status,
    label,
  )) =>
    test(
      `${label} coerces to its constructor name`,
      () => {
        expect(Payment.statusLabel(status))->Expect.toBe(label)
      },
    )
  )

  test("matches spread constructors as a group", () => {
    expect(Payment.describe(Card({amount: 1, last4: "0001"})))->Expect.toBe("card ending 0001")
    expect(Payment.describe(Voucher({code: "SPRING"})))->Expect.toBe("voucher SPRING")
    expect(Payment.describe(Cash({amount: 1})))->Expect.toBe("cash")
  })
})

describe("KeyedStore", () => {
  test("stores by key and copies on write", () => {
    let empty = KeyedStore.UserStore.empty()
    let one = empty->KeyedStore.UserStore.set(UserId(1), "Ada")
    expect(one->KeyedStore.UserStore.get(UserId(1)))->Expect.toEqual(Some("Ada"))
    expect(empty->KeyedStore.UserStore.size)->Expect.toBe(0)
    expect(one->KeyedStore.UserStore.size)->Expect.toBe(1)
  })
})
