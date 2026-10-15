# The adapter boundary

## Shape

For screen readers: HTTP requests reach `TodoServer`, the Bun adapter, which
reads the request, routes it to a command, and writes the response. It passes
the command and a store down to `TodoCore`, the portable core, which validates,
calls the store port, and returns an outcome or a domain error.

```plaintext
            ┌──────────────────────────┐
HTTP  ───▶  │ TodoServer (Bun adapter) │  route, decode JSON, spell statuses
            └────────────┬─────────────┘
                         │ command, store        ▲ result<outcome, todoError>
            ┌────────────▼─────────────┐         │
            │ TodoCore (portable)      │  validate, call the store port
            └──────────────────────────┘
```

_Figure 1: The Bun adapter above the portable core._

The core owns:

- domain types (`todo`) and the domain's own errors (`EmptyTitle`,
  `StoreFailed`);
- the ports it needs, as records of functions (`store`), with their failures
  in the type;
- decisions: what a command does, which titles are valid, and what a store
  failure means.

The core knows nothing of HTTP or JSON: no methods, paths, status codes, or
`JSON.t`. Those belong to the adapter, which owns:

- reading the runtime's request shape (method, URL, body) and routing it to a
  core `command`;
- decoding JSON bodies and encoding results;
- spelling core outcomes and errors as statuses and bodies;
- supplying real port implementations (a SQLite store, the system clock);
- process concerns: ports, environment, signals, shutdown.

## Ports as records

```rescript
type storeError = StoreUnavailable(string)

type store = {
  list: unit => promise<result<array<todo>, storeError>>,
  add: string => promise<result<todo, storeError>>,
}
```

A record of functions is simpler than a functor or first-class module when no
types vary, and it is trivial to fake. `TodoCore.memoryStore()` is both the
test double and a perfectly good implementation for a demo.

Storage fails, so the port says so. A port typed `promise<array<todo>>` hides
failure in a rejection that the core never sees and the compiler never checks;
a real store's failure would then escape to `Bun.serve`.

## Routing in the adapter

```rescript
let route = (~method: string, ~path: string, ~body: option<JSON.t>): result<
  TodoCore.command,
  httpError,
> =>
  switch (method, path) {
  | ("GET", "/todos") => Ok(ListTodos)
  | ("POST", "/todos") =>
    switch body->Option.flatMap(titleField) {
    | Some(title) => Ok(AddTodo(title))
    | None => Error(BadBody(`expected a JSON body {"title": string}`))
    }
  | (_, "/todos") => Error(MethodNotAllowed)
  | _ => Error(NotFound)
  }
```

Routing is transport, so it lives in the adapter, but it is still a pure
function of strings and JSON rather than of a Bun `Request`. It runs in tests
without a server, and so does `replyFor`, which spells a core result as a
status and a body.

## Error translation

Each boundary converts what can go wrong into data once:

- a malformed JSON body: `Request.json` rejects, the adapter's `readBody`
  catches `JsExn` and passes `None`, and routing replies 400;
- an unknown route or method: the adapter's `httpError`, as 404 or 405;
- an invalid title: the core's `EmptyTitle`, which the adapter spells as 400;
- a store failure: the port resolves with `Error`, the core reports
  `StoreFailed`, and the adapter answers 503;
- a store that breaks the port by rejecting: the adapter catches it and
  answers 500 with its own JSON body, so no rejection reaches `Bun.serve`,
  which would otherwise answer with a generic error page.

## Configuration

Read the environment once, in the adapter, into a typed record:

```rescript
type config = {port: int, databasePath: string}

let configFromEnv = (env: dict<string>): result<config, string> => {
  let port = env->Dict.get("PORT")->Option.flatMap(raw => Int.fromString(raw))->Option.getOr(3000)
  switch env->Dict.get("DATABASE_PATH") {
  | Some(databasePath) => Ok({port, databasePath})
  | None => Error("DATABASE_PATH is required")
  }
}
```

Pass `config` to the parts that need it. Code that reads `Bun.env` deep inside
the core cannot be tested without mutating the process environment. (Validate
`PORT` strictly if it matters; `Int.fromString` accepts `"80abc"`.)

## Testing each side

| Side      | Test with                                       | Example                                   |
| --------- | ----------------------------------------------- | ----------------------------------------- |
| core      | plain function calls, memory and failing stores | `TodoCore.handle`                         |
| transport | plain function calls over strings and JSON      | `TodoServer.route`, `TodoServer.replyFor` |
| wiring    | a real `Bun.serve` on port 0 and `fetch`        | `TodoServer.start(~port=0, store)`        |

_Table 1: Tests for each side of the adapter boundary._

Exercise the wiring with a failing store and a rejecting store as well as a
working one, and check the body as well as the status: Bun's own answer to an
unhandled rejection is also a 500.

Stop servers in `Promise.finally`, so a failing assertion does not leave a
listener behind:

```rescript
testAsync("serves the core through Bun.serve", async () => {
  let server = TodoServer.start(~port=0, TodoCore.memoryStore())
  await exercise(server)->Promise.finally(() => TodoServer.stop(server))
})
```

## Enforcing the boundary

Within one ReScript package, any source can open a dependency. Options, from
strongest:

1. Put the core in its own workspace package without `rescript-bun` in its
   `rescript.json`; the compiler then rejects any Bun reference.
2. Keep one package and add a contract test that fails if core files mention
   `RescriptBun`, `@module("bun`, or `@val` globals. This repository does that
   for every `*Core.res` example.
3. Code review alone. Fine for a small team, until it is not.
