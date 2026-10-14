/***
Code written to be tested: collaborators arrive as arguments.

`notifyOverdue` takes the clock and the sender as labelled functions, so a test
can pass a fixed time and a recording mock without patching globals.
`notifyOverdueNow` is the production wrapper and reads the real clock, which
a test controls with `setSystemTime`.
*/

type invoice = {id: string, dueAt: float, paid: bool}

let isOverdue = (invoice: invoice, ~now: float): bool => !invoice.paid && invoice.dueAt < now

let notifyOverdue = (invoices: array<invoice>, ~now: unit => float, ~send: string => unit): int => {
  let current = now()
  let overdue = invoices->Array.filter(invoice => invoice->isOverdue(~now=current))
  overdue->Array.forEach(invoice => send(`invoice ${invoice.id} is overdue`))
  overdue->Array.length
}

let notifyOverdueNow = (invoices: array<invoice>, ~send: string => unit): int =>
  notifyOverdue(invoices, ~now=Date.now, ~send)
