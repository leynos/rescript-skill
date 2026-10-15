/***
A portable core: domain types, a fallible storage port, and the decisions.

Nothing here mentions Bun, Node, the DOM, HTTP, or JSON. The adapter turns
requests into `command` values and turns `outcome` values and `todoError`
values back into responses, and it supplies the store. That keeps the core
testable without a server and reusable under another runtime or transport.
*/

type todo = {id: int, title: string, done: bool}

// Storage can fail, so the port says so: an implementation resolves with
// `Error` rather than rejecting, and the core never sees an exception.
type storeError = StoreUnavailable(string)

// The port: whatever the adapter provides must look like this.
type store = {
  list: unit => promise<result<array<todo>, storeError>>,
  add: string => promise<result<todo, storeError>>,
}

type command =
  | ListTodos
  | AddTodo(string)

type outcome =
  | Listed(array<todo>)
  | Added(todo)

type todoError =
  | EmptyTitle
  | StoreFailed(storeError)

/** Trims a proposed title and refuses one that is left empty. */
let validTitle = (raw: string): result<string, todoError> =>
  switch raw->String.trim {
  | "" => Error(EmptyTitle)
  | title => Ok(title)
  }

/** Runs one command against the store, with every failure in the result. */
let handle = async (store: store, command: command): result<outcome, todoError> =>
  switch command {
  | ListTodos =>
    switch await store.list() {
    | Ok(todos) => Ok(Listed(todos))
    | Error(error) => Error(StoreFailed(error))
    }
  | AddTodo(raw) =>
    switch validTitle(raw) {
    | Error(error) => Error(error)
    | Ok(title) =>
      switch await store.add(title) {
      | Ok(todo) => Ok(Added(todo))
      | Error(error) => Error(StoreFailed(error))
      }
    }
  }

/** An in-memory implementation of the port, portable and good enough for tests. */
let memoryStore = (): store => {
  let todos = []
  {
    list: async () => Ok(todos->Array.copy),
    add: async title => {
      let todo = {id: todos->Array.length + 1, title, done: false}
      todos->Array.push(todo)
      Ok(todo)
    },
  }
}
