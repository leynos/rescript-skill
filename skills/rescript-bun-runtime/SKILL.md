---
name: rescript-bun-runtime
description: Use for ReScript 12 code that runs on Bun through rescript-bun 2.x — Bun.serve handlers, fetch, Request and Response, files, environment, subprocesses and the shell, SQLite — and for keeping Bun out of a portable core with ports and a thin adapter.
metadata:
  globs: "**/*.res, **/rescript.json, **/bunfig.toml, **/package.json"
---

# ReScript on the Bun runtime

Use this when ReScript code calls Bun: servers, scripts, CLIs, file and process
work. For tests under Bun, load `rescript-bun-testing` instead.

## Working stance

- Separate the core from the runtime. Domain logic, validation, and routing
  decisions are plain ReScript over plain data; one adapter module per runtime
  translates HTTP, files, and processes into that data.
- Express what the core needs from the outside world as a port: a record of
  functions (`store`, `clock`, `mailer`). The adapter supplies a Bun-backed
  implementation; tests supply an in-memory one.
- Open `RescriptBun` locally in adapter modules. Never through
  `compiler-flags`, whatever the `rescript-bun` README suggests.
- Convert at the edge: request bodies through a decoder, thrown errors to
  `result`, `Nullable` to `option`, environment variables to a typed config.
- Treat `rescript-bun` as a binding library, not gospel. Some bindings are
  loose (`'a` payloads, `%identity` constructors); prefer the typed variants or
  wrap the loose ones once.

## Decision surface

| Need                        | Move                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| HTTP server                 | `Bun.serve({port, fetch: (request, server) => ...})`                                                               |
| tests against a real server | `~port=0`, read `Bun.Server.port`, stop in `Promise.finally`                                                       |
| request path and method     | `URL.make(request->Request.url)->URL.pathname`, `(method :> string)`                                               |
| JSON request body           | `await request->Request.json` inside `try`, then decode                                                            |
| JSON response               | `Response.makeWithJson(json, ~options={status})`                                                                   |
| outbound HTTP               | `Globals.fetch(url, ~init=...)`, decode the response                                                               |
| configuration               | read `Bun.env` once in the adapter into a typed record                                                             |
| files                       | `Bun.file(path)` to read; `Bun.write` to write                                                                     |
| subprocesses                | `ChildProcess.spawn` (Node compatibility; `Bun.spawn` is unbound) or the `$` shell via a `@taggedTemplate` binding |
| enforce the boundary        | core in a package without `rescript-bun`, or a contract test                                                       |

_Table 1: Moves for Bun runtime work._

## The boundary, concretely

[TodoCore.res](references/examples/TodoCore.res) holds the domain type, a
`store` port whose failures are in its type, and `handle` from a `command` to a
result of a domain outcome or a domain error. It knows nothing of Bun, HTTP, or
JSON. [TodoServer.res](references/examples/TodoServer.res) owns transport: a
pure `route` from method, path, and body to a command, a pure `replyFor` from a
core result to a status and a body, and a handler that turns even a rejecting
store into a deliberate 500. The suite tests the core and the transport mapping
as functions, and the composed adapter over real HTTP on an ephemeral port with
working, failing, and rejecting stores. A contract test fails if a `*Core.res`
example mentions `RescriptBun`.

In a single package the compiler cannot stop `src/` from importing
`rescript-bun` once it is a dependency. When the boundary matters, give the
core its own package in a workspace (`rescript-build-and-config`) whose
`rescript.json` does not list `rescript-bun`; then the compiler enforces it.

## Red flags

- `RescriptBun` opened in a module that also holds business rules.
- `Response.makeWithJsonUnsafe` or other `'a` payload bindings on data that
  was never encoded deliberately.
- `request->Request.json` awaited without a handler: a malformed body
  rejects.
- Servers in tests on fixed ports, or never stopped.
- `Bun.env` read throughout the code instead of once into a typed config.
- `%raw` used to reach a Bun API that `rescript-bun` already binds.

## References

- [adapter-boundary.md](references/adapter-boundary.md): ports, adapters,
  configuration, error translation, and testing each side.
- [bun-apis.md](references/bun-apis.md): the `rescript-bun` 2.1.0 surface
  for serving, fetching, files, environment, processes, and SQLite, with notes
  on its looser bindings.
- Executable examples: [TodoCore.res](references/examples/TodoCore.res) and
  [TodoServer.res](references/examples/TodoServer.res).
