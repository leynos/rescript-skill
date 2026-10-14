/***
Variants: inline records, type spreads, zero-cost coercion, and exhaustiveness.
*/

// Inline records label payload fields and compile to `{TAG, amount, last4}`.
type card = Card({amount: int, last4: string})

type cash = Cash({amount: int})

// A spread copies constructors, so every `card` is also a `payment`.
type payment =
  | ...card
  | ...cash
  | Voucher({code: string})

// Coercion is free at runtime and checked at compile time.
let fromCard = (c: card): payment => (c :> payment)

let amountInPence = (p: payment): int =>
  switch p {
  // `+A` enables warning 9: name every label or close the pattern with `_`.
  | Card({amount, _}) | Cash({amount}) => amount
  | Voucher(_) => 0
  }

// Payloadless constructors are strings at runtime and coerce to `string`.
type status = Pending | Settled | Refunded

let statusLabel = (s: status): string => (s :> string)

let cardSummary = (Card({last4, _}): card) => `ending ${last4}`

// Matching on a spread type selects the constructors it contributes.
let describe = (p: payment): string =>
  switch p {
  | ...card as c => `card ${c->cardSummary}`
  | Cash(_) => "cash"
  | Voucher({code}) => `voucher ${code}`
  }
