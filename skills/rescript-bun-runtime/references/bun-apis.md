# Bun APIs through `rescript-bun` 2.1.0

`rescript-bun` is namespaced as `RescriptBun`. Its main modules are `Bun` (the
`Bun` global), `Globals` (web platform globals such as `fetch`, `Request`,
`Response`, `URL`, `Headers`), `Test`, `BunSqlite`, and Node compatibility
modules (`Fs`, `Path`, `ChildProcess`, …). Open what a module needs, locally:

```rescript
open RescriptBun
open RescriptBun.Globals
```

Install it as a regular dependency of the package that holds the adapter, and
list it under `dependencies` in that package's `rescript.json`.

## Serving

```rescript
let start = (~port: int, store: TodoCore.store): Bun.Server.t =>
  Bun.serve({
    port,
    fetch: (request, _server) => fetchHandler(store, request),
  })
```

- `fetch` returns `promise<Response.t>`; an `async` function fits.
- `port: 0` binds a free port; read it back with `Bun.Server.port`.
- `Bun.Server.stop(server, ~closeActiveConnections=true)` shuts down.
- `serveOptions` also accepts `hostname`, `development`, `error`, and a
  `routes` dictionary.

## Requests and responses

| Need                 | Binding                                                            |
| -------------------- | ------------------------------------------------------------------ |
| URL and path         | `request->Request.url`, then `URL.make(url)->URL.pathname`         |
| method               | `request->Request.method`, a variant; `(m :> string)` for the name |
| headers              | `request->Request.headers->Headers.get("x-name")`                  |
| JSON body            | `await request->Request.json` (rejects on malformed input)         |
| cancellation         | `request->Request.signal`                                          |
| JSON response        | `Response.makeWithJson(json, ~options={status: 201})`              |
| text response        | `Response.make("text", ~options={status: 200})`                    |
| status of a response | `response->Response.status`                                        |

_Table 1: Bindings for requests and responses._

`Response.makeWithJsonUnsafe` accepts any value (`'a`) and serializes it as
JavaScript sees it, so variants appear as `{TAG, _0}`. Encode to `JSON.t`
deliberately and use `makeWithJson`.

## Outbound HTTP

```rescript
let post = (url, body) =>
  fetch(url, ~init={method: "POST", body: Null.make(BodyInit.makeFromString(body))})
```

`BodyInit.makeFromString` is a `%identity` cast inside the library; that is
acceptable because the platform accepts strings as bodies. Decode responses with
`Response.json` plus a decoder, and treat a rejected `fetch` (network failure)
separately from a non-2xx status.

## Files

```rescript
let readConfig = async path => {
  let file = Bun.file(path)
  await file->Bun.BunFile.exists ? Some(await file->Bun.BunFile.text) : None
}

let save = (path, text) =>
  Bun.Write.write(
    ~destination=Bun.Write.Destination.fromPath(path),
    ~input=Bun.Write.Input.fromString(text),
  )
```

`Bun.BunFile.json` parses as `JSON.t`; decode it. `Bun.Write.write` resolves to
the number of bytes written.

## Environment

`Bun.env` is a record with a few known fields plus `Bun.Env.get(env, name)`
returning `option<string>`. Read it once into a typed configuration in the
adapter.

## Processes and the shell

`rescript-bun` 2.1.0 binds Node's `ChildProcess` (`spawn`, `spawnSync`) but not
`Bun.spawn`. Bun's `$` shell is a tagged template; bind only the part in use:

```rescript
type shellResult = {exitCode: int}

@module("bun") @taggedTemplate
external sh: (array<string>, array<string>) => promise<shellResult> = "$"

let listing = async name => (await sh`ls ${name}`).exitCode
```

Interpolated values are escaped by Bun's shell, which is the reason to prefer
it over building command strings.

## SQLite

```rescript
let db = BunSqlite.Database.make(":memory:")
```

`Database.query(db, sql)` prepares a statement; `Statement.all`, `get`, and
`run` execute it. Parameters are passed as an object (`{..}`) and rows come
back as `JSON.t`, so decode rows into domain types in the store adapter. A
SQLite-backed `store` is a drop-in replacement for `TodoCore.memoryStore()`.
