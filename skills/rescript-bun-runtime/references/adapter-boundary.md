# The adapter boundary

## Shape

```text
            ┌──────────────────────────┐
HTTP  ───▶  │ TodoServer (Bun adapter) │  reads Request, writes Response
            └────────────┬─────────────┘
                         │ command, store
            ┌────────────▼─────────────┐
            │ TodoCore (portable)      │  route, handle, encode, the store port
            └──────────────────────────┘
```

The core owns:

- domain types (`todo`) and their encoders and decoders;
- the ports it needs, as records of functions (`store`);
- decisions: which command a request means, what reply a command produces,
  which errors exist (`NotFound`, `MethodNotAllowed`, `InvalidBody`).

The adapter owns:

- reading the runtime's request shape (method, URL, body) into core inputs;
- writing core replies back (status, JSON body, headers);
- supplying real port implementations (a SQLite store, the system clock);
- process concerns: ports, environment, signals, shutdown.

## Ports as records

```rescript
type store = {
  list: unit => promise<array<todo>>,
  add: string => promise<todo>,
}
```

A record of functions is simpler than a functor or first-class module when no
types vary, and it is trivial to fake. `TodoCore.memoryStore()` is both the
test double and a perfectly good implementation for a demo.

## Routing as data

```rescript
let route = (~method: string, ~path: string, ~body: option<JSON.t>): result<
  command,
  requestError,
> =>
  switch (method, path) {
  | ("GET", "/todos") => Ok(ListTodos)
  | ("POST", "/todos") =>
    switch body {
    | Some(json) => json->titleFrom->Result.map(title => AddTodo(title))
    | None => Error(InvalidBody("expected a JSON body"))
    }
  | (_, "/todos") => Error(MethodNotAllowed)
  | _ => Error(NotFound)
  }
```

Because `route` takes strings and JSON rather than a Bun `Request`, it runs in
any runtime and in tests without a server.

## Error translation

Each boundary converts what can go wrong into data once:

- a malformed JSON body: `Request.json` rejects, the adapter's `readBody`
  catches `JsExn` and passes `None`, and the core replies 400;
- an unknown route or method: the core's `requestError` variant;
- a store failure: the store port can return `promise<result<...>>`, or the
  adapter can catch and map to 500. Pick one, and keep exceptions from reaching
  `Bun.serve`, which would otherwise turn them into a generic error response.

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

| Side    | Test with                                   | Example                             |
| ------- | ------------------------------------------- | ----------------------------------- |
| core    | plain function calls and the memory store   | `TodoCore.route`, `TodoCore.handle` |
| adapter | a real `Bun.serve` on port 0 and `fetch`    | `TodoServer.start(~port=0, store)`  |
| wiring  | one end-to-end test of the composed program | start, call, stop                   |

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
