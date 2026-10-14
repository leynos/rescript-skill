/***
A portable core: domain types, a storage port, and request handling as data.

Nothing here mentions Bun, Node, or the DOM. The adapter translates HTTP into
`command` values and `reply` values back into HTTP, and supplies the store.
That keeps the core testable without a server and reusable under another
runtime.
*/

type todo = {id: int, title: string, done: bool}

// The port: whatever the adapter provides must look like this.
type store = {
  list: unit => promise<array<todo>>,
  add: string => promise<todo>,
}

type command =
  | ListTodos
  | AddTodo(string)

type reply = {status: int, body: JSON.t}

type requestError =
  | NotFound
  | MethodNotAllowed
  | InvalidBody(string)

let encodeTodo = (todo: todo): JSON.t => JSON.Object(
  dict{
    "id": JSON.Number(todo.id->Int.toFloat),
    "title": JSON.String(todo.title),
    "done": JSON.Boolean(todo.done),
  },
)

let titleFrom = (body: JSON.t): result<string, requestError> =>
  switch body
  ->JSON.Decode.object
  ->Option.flatMap(fields => fields->Dict.get("title"))
  ->Option.flatMap(JSON.Decode.string)
  ->Option.map(String.trim) {
  | Some(title) if title != "" => Ok(title)
  | Some(_) | None => Error(InvalidBody(`expected {"title": non-empty string}`))
  }

// Routing is a pure function of method, path, and the decoded body.
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

let errorReply = (error: requestError): reply =>
  switch error {
  | NotFound => {status: 404, body: JSON.String("not found")}
  | MethodNotAllowed => {status: 405, body: JSON.String("method not allowed")}
  | InvalidBody(message) => {status: 400, body: JSON.String(message)}
  }

let handle = async (store: store, command: command): reply =>
  switch command {
  | ListTodos =>
    let todos = await store.list()
    {status: 200, body: JSON.Array(todos->Array.map(encodeTodo))}
  | AddTodo(title) =>
    let todo = await store.add(title)
    {status: 201, body: encodeTodo(todo)}
  }

// An in-memory implementation of the port, portable and good enough for tests.
let memoryStore = (): store => {
  let todos = []
  {
    list: async () => todos->Array.copy,
    add: async title => {
      let todo = {id: todos->Array.length + 1, title, done: false}
      todos->Array.push(todo)
      todo
    },
  }
}
