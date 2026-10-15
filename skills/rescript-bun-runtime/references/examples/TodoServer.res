/***
The Bun adapter: `Bun.serve` on the outside, `TodoCore` on the inside.

This is the only module that opens `RescriptBun`, and it does so locally. It
owns every transport concern: methods, paths, JSON bodies, and status codes.
It turns a request into a core `command`, and a core result into a response,
so the core decides what happens and the adapter decides how it is spelled in
HTTP.
*/

open RescriptBun
open RescriptBun.Globals

// --- Transport, as pure functions ---------------------------------------------

type httpError =
  | NotFound
  | MethodNotAllowed
  | BadBody(string)

type reply = {status: int, body: JSON.t}

/** Reads the `title` field of a decoded body, if it is a string. */
let titleField = (body: JSON.t): option<string> =>
  body
  ->JSON.Decode.object
  ->Option.flatMap(fields => fields->Dict.get("title"))
  ->Option.flatMap(JSON.Decode.string)

/** Maps a method, a path, and a decoded body to a core command. */
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

let encodeTodo = (todo: TodoCore.todo): JSON.t => JSON.Object(
  dict{
    "id": JSON.Number(todo.id->Int.toFloat),
    "title": JSON.String(todo.title),
    "done": JSON.Boolean(todo.done),
  },
)

let message = (status, text) => {status, body: JSON.String(text)}

/** Spells a core result as an HTTP status and a JSON body. */
let replyFor = (result: result<TodoCore.outcome, TodoCore.todoError>): reply =>
  switch result {
  | Ok(Listed(todos)) => {status: 200, body: JSON.Array(todos->Array.map(encodeTodo))}
  | Ok(Added(todo)) => {status: 201, body: encodeTodo(todo)}
  | Error(EmptyTitle) => message(400, "title must not be empty")
  | Error(StoreFailed(StoreUnavailable(_))) => message(503, "storage unavailable")
  }

/** Spells a transport error as an HTTP status and a JSON body. */
let errorReply = (error: httpError): reply =>
  switch error {
  | NotFound => message(404, "not found")
  | MethodNotAllowed => message(405, "method not allowed")
  | BadBody(text) => message(400, text)
  }

// --- Bun ----------------------------------------------------------------------

// `Globals.method` is a payloadless variant whose runtime values are the
// method names, so coercion to `string` is free and checked.
let methodName = (method: method): string => (method :> string)

// `Request.json` rejects on a malformed body; turn that into `None` here.
let readBody = async (request: Request.t): option<JSON.t> =>
  try Some(await request->Request.json) catch {
  | JsExn(_) => None
  }

let respond = ({status, body}: reply): Response.t =>
  Response.makeWithJson(body, ~options={status: status})

/**
Answers one request. A store that breaks the port by rejecting instead of
resolving with `Error` still gets a deliberate 500, so no rejection reaches
`Bun.serve`, which would otherwise answer with its own generic error page.
*/
let fetchHandler = async (store: TodoCore.store, request: Request.t): Response.t => {
  let path = URL.make(request->Request.url)->URL.pathname
  let method = request->Request.method->methodName
  let body = method == "POST" ? await readBody(request) : None
  switch route(~method, ~path, ~body) {
  | Error(error) => respond(errorReply(error))
  | Ok(command) =>
    switch await TodoCore.handle(store, command) {
    | result => respond(replyFor(result))
    | exception _ => respond(message(500, "internal error"))
    }
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
