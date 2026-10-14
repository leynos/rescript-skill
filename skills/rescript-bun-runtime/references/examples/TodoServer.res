/***
The Bun adapter: `Bun.serve` on the outside, `TodoCore` on the inside.

This is the only module that opens `RescriptBun`, and it does so locally. It
owns HTTP concerns (methods, paths, JSON bodies, status codes) and converts
everything into core values before any domain logic runs.
*/

open RescriptBun
open RescriptBun.Globals

// `Globals.method` is a payloadless variant whose runtime values are the
// method names, so coercion to `string` is free and checked.
let methodName = (method: method): string => (method :> string)

// `Request.json` rejects on a malformed body; turn that into `None` here.
let readBody = async (request: Request.t): option<JSON.t> =>
  try Some(await request->Request.json) catch {
  | JsExn(_) => None
  }

let respond = ({status, body}: TodoCore.reply): Response.t =>
  Response.makeWithJson(body, ~options={status: status})

let fetchHandler = async (store: TodoCore.store, request: Request.t): Response.t => {
  let path = URL.make(request->Request.url)->URL.pathname
  let method = request->Request.method->methodName
  let body = method == "POST" ? await readBody(request) : None
  switch TodoCore.route(~method, ~path, ~body) {
  | Ok(command) => respond(await TodoCore.handle(store, command))
  | Error(error) => respond(TodoCore.errorReply(error))
  }
}

// `port: 0` asks the operating system for a free port, which tests rely on.
let start = (~port: int, store: TodoCore.store): Bun.Server.t =>
  Bun.serve({
    port,
    fetch: (request, _server) => fetchHandler(store, request),
  })

let baseUrl = (server: Bun.Server.t): string =>
  `http://localhost:${server->Bun.Server.port->Int.toString}`

let stop = (server: Bun.Server.t): unit => server->Bun.Server.stop(~closeActiveConnections=true)
