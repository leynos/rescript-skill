/**
Executable evidence for the `rescript-bun-runtime` examples.

The core is tested as plain functions; the adapter is tested over real HTTP
against a server bound to an ephemeral port.
*/
open RescriptBun.Test
open RescriptBun.Globals

describe("TodoCore without a runtime", () => {
  test("routes methods and paths to commands", () => {
    expect(TodoCore.route(~method="GET", ~path="/todos", ~body=None))->Expect.toEqual(
      Ok(TodoCore.ListTodos),
    )
    expect(
      TodoCore.route(
        ~method="POST",
        ~path="/todos",
        ~body=Some(JSON.Object(dict{"title": JSON.String(" milk ")})),
      ),
    )->Expect.toEqual(Ok(TodoCore.AddTodo("milk")))
    expect(TodoCore.route(~method="DELETE", ~path="/todos", ~body=None))->Expect.toEqual(
      Error(TodoCore.MethodNotAllowed),
    )
    expect(TodoCore.route(~method="GET", ~path="/", ~body=None))->Expect.toEqual(
      Error(TodoCore.NotFound),
    )
  })

  testAsync("handles commands against the memory store", async () => {
    let store = TodoCore.memoryStore()
    let added = await TodoCore.handle(store, AddTodo("bread"))
    expect(added.status)->Expect.toBe(201)
    let listed = await TodoCore.handle(store, ListTodos)
    expect(listed.body)->Expect.toEqual(
      JSON.Array([
        JSON.Object(
          dict{"id": JSON.Number(1.), "title": JSON.String("bread"), "done": JSON.Boolean(false)},
        ),
      ]),
    )
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

  let missing = await fetch(`${server->TodoServer.baseUrl}/nowhere`)
  expect(missing->Response.status)->Expect.toBe(404)
}

describe("TodoServer over HTTP", () => {
  // `Promise.finally` stops the server whether the assertions pass or throw.
  testAsync("serves the core through Bun.serve", async () => {
    let server = TodoServer.start(~port=0, TodoCore.memoryStore())
    await exercise(server)->Promise.finally(() => TodoServer.stop(server))
  })
})
