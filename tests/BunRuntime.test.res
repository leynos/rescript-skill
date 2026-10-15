/**
Executable evidence for the `rescript-bun-runtime` examples.

The core is tested as plain functions over the domain; the adapter's routing
and reply mapping as plain functions over transport values; and the composed
program over real HTTP against a server bound to an ephemeral port, including
stores that fail and stores that reject.
*/
open RescriptBun.Test
open RescriptBun.Globals

let unavailable: TodoCore.store = {
  list: async () => Error(TodoCore.StoreUnavailable("disk full")),
  add: async _ => Error(TodoCore.StoreUnavailable("disk full")),
}

// Breaks the port's contract by rejecting instead of resolving with `Error`.
let reset = () => Promise.make((_resolve, reject) => reject(JsError.make("connection reset")))
let rejecting: TodoCore.store = {list: reset, add: _ => reset()}

describe("TodoCore without a runtime", () => {
  testAsync("adds and lists against the memory store", async () => {
    let store = TodoCore.memoryStore()
    let added = await TodoCore.handle(store, AddTodo(" bread "))
    let bread: TodoCore.todo = {id: 1, title: "bread", done: false}
    expect(added)->Expect.toEqual(Ok(TodoCore.Added(bread)))
    expect(await TodoCore.handle(store, ListTodos))->Expect.toEqual(Ok(TodoCore.Listed([bread])))
  })

  testAsync("refuses an empty title without touching the store", async () => {
    let outcome = await TodoCore.handle(unavailable, AddTodo("   "))
    expect(outcome)->Expect.toEqual(Error(TodoCore.EmptyTitle))
  })

  testAsync("reports a failing store as data for both commands", async () => {
    let failed = Error(TodoCore.StoreFailed(StoreUnavailable("disk full")))
    expect(await TodoCore.handle(unavailable, ListTodos))->Expect.toEqual(failed)
    expect(await TodoCore.handle(unavailable, AddTodo("milk")))->Expect.toEqual(failed)
  })
})

describe("TodoServer transport mapping", () => {
  test("routes methods and paths to commands", () => {
    expect(TodoServer.route(~method="GET", ~path="/todos", ~body=None))->Expect.toEqual(
      Ok(TodoCore.ListTodos),
    )
    expect(
      TodoServer.route(
        ~method="POST",
        ~path="/todos",
        ~body=Some(JSON.Object(dict{"title": JSON.String(" milk ")})),
      ),
    )->Expect.toEqual(Ok(TodoCore.AddTodo(" milk ")))
    expect(TodoServer.route(~method="POST", ~path="/todos", ~body=None))->Expect.toEqual(
      Error(TodoServer.BadBody(`expected a JSON body {"title": string}`)),
    )
    expect(TodoServer.route(~method="DELETE", ~path="/todos", ~body=None))->Expect.toEqual(
      Error(TodoServer.MethodNotAllowed),
    )
    expect(TodoServer.route(~method="GET", ~path="/", ~body=None))->Expect.toEqual(
      Error(TodoServer.NotFound),
    )
  })

  test("spells core results as statuses", () => {
    let status = result => TodoServer.replyFor(result).status
    expect(status(Ok(TodoCore.Listed([]))))->Expect.toBe(200)
    expect(status(Ok(TodoCore.Added({id: 1, title: "a", done: false}))))->Expect.toBe(201)
    expect(status(Error(TodoCore.EmptyTitle)))->Expect.toBe(400)
    expect(status(Error(TodoCore.StoreFailed(StoreUnavailable("x")))))->Expect.toBe(503)
  })
})

let post = (url, body) =>
  fetch(url, ~init={method: "POST", body: Null.make(BodyInit.makeFromString(body))})

let exercise = async (server: RescriptBun.Bun.Server.t): unit => {
  let url = `${server->TodoServer.baseUrl}/todos`

  let created = await post(url, `{"title": "eggs"}`)
  expect(created->Response.status)->Expect.toBe(201)

  let listed = await fetch(url)
  expect(await listed->Response.json)->Expect.toEqual(
    JSON.Array([
      JSON.Object(
        dict{"id": JSON.Number(1.), "title": JSON.String("eggs"), "done": JSON.Boolean(false)},
      ),
    ]),
  )

  let malformed = await post(url, `{not json`)
  expect(malformed->Response.status)->Expect.toBe(400)

  let empty = await post(url, `{"title": " "}`)
  expect(empty->Response.status)->Expect.toBe(400)

  let deleted = await fetch(url, ~init={method: "DELETE"})
  expect(deleted->Response.status)->Expect.toBe(405)

  let missing = await fetch(`${server->TodoServer.baseUrl}/nowhere`)
  expect(missing->Response.status)->Expect.toBe(404)
}

/**
Asserts that both commands get `status` and the JSON message `text` from a
server over `store`. Checking the body matters for 500: Bun's own answer to an
unhandled rejection is also a 500, but not this JSON.
*/
let expectReplyForBoth = async (store, status, text) => {
  let server = TodoServer.start(~port=0, store)
  let check = async () => {
    let url = `${server->TodoServer.baseUrl}/todos`
    let listed = await fetch(url)
    expect(listed->Response.status)->Expect.toBe(status)
    expect(await listed->Response.json)->Expect.toEqual(JSON.String(text))
    let added = await post(url, `{"title": "eggs"}`)
    expect(added->Response.status)->Expect.toBe(status)
    expect(await added->Response.json)->Expect.toEqual(JSON.String(text))
  }
  await check()->Promise.finally(() => TodoServer.stop(server))
}

describe("TodoServer over HTTP", () => {
  // `Promise.finally` stops the server whether the assertions pass or throw.
  testAsync("serves the core through Bun.serve", async () => {
    let server = TodoServer.start(~port=0, TodoCore.memoryStore())
    await exercise(server)->Promise.finally(() => TodoServer.stop(server))
  })

  testAsync("answers 503 when the store reports a failure", async () => {
    await expectReplyForBoth(unavailable, 503, "storage unavailable")
  })

  testAsync("answers 500 when the store rejects", async () => {
    await expectReplyForBoth(rejecting, 500, "internal error")
  })
})
