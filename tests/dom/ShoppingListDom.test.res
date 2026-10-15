/**
Interaction evidence for the `rescript-react` example, in a DOM.

`make test` runs this suite in its own `bun test` process with happy-dom
preloaded (`tests/support/happy-dom.mjs`). Each test mounts the component into
a fresh container with React DOM's client renderer, drives it through real
`click` events inside `React.act`, and reads the resulting DOM.
*/
open RescriptBun.Test

// The few DOM members the suite needs; the standard library binds none.
@val external document: Dom.document = "document"
@send external createElement: (Dom.document, string) => Dom.element = "createElement"
@get external body: Dom.document => Dom.element = "body"
@send external appendChild: (Dom.element, Dom.element) => unit = "appendChild"
@send external removeElement: Dom.element => unit = "remove"
@send @return(nullable)
external querySelector: (Dom.element, string) => option<Dom.element> = "querySelector"
@send
external querySelectorAll: (Dom.element, string) => Array.arrayLike<Dom.element> =
  "querySelectorAll"
@get external textContent: Dom.element => string = "textContent"
@get external className: Dom.element => string = "className"
@get external checked: Dom.element => bool = "checked"
@send external click: Dom.element => unit = "click"

/** Reads `get` from the first element matching `selector`, if there is one. */
let read = (container, selector, get) => container->querySelector(selector)->Option.map(get)

/** Texts of every element matching `selector`, in document order. */
let texts = (container, selector) =>
  container->querySelectorAll(selector)->Array.fromArrayLike->Array.map(textContent)

/**
Mounts `element` in a fresh container, runs `exercise`, then unmounts inside
`act` whether or not the assertions passed. A failure is handed back as a
rejected promise once the container is gone, so the test still fails with it.
*/
let mounted = async (element, exercise) => {
  let container = document->createElement("div")
  document->body->appendChild(container)
  let root = ReactDOM.Client.createRoot(container)
  await React.act(async () => root->ReactDOM.Client.Root.render(element))
  let outcome = await exercise(container)
  ->Promise.thenResolve(() => Ok())
  ->Promise.catch(error => Promise.resolve(Error(error)))
  await React.act(async () => root->ReactDOM.Client.Root.unmount())
  container->removeElement
  await (
    switch outcome {
    | Ok() => Promise.resolve()
    | Error(error) => Promise.reject(error)
    }
  )
}

/**
Clicks the first element matching `selector` inside `React.act`, so state
updates have flushed afterwards. Fails the test if there is no such element.
*/
let clickOn = (container, selector) => {
  let target = container->querySelector(selector)
  expect(target->Option.isSome)->Expect.toBe(true)
  React.act(async () => target->Option.forEach(click))
}

let milk: ShoppingList.item = {id: "1", label: "milk", bought: false}
let eggs: ShoppingList.item = {id: "2", label: "eggs", bought: true}

describe("ShoppingList in a DOM", () => {
  testAsync("toggling a row updates its checkbox, class, and the count", async () => {
    await mounted(
      <ShoppingList initial=[milk, eggs] />,
      async container => {
        expect(container->read("p", textContent))->Expect.toEqual(Some("1 left"))
        expect(container->read("li", className))->Expect.toEqual(Some("pending"))

        await container->clickOn("li input")

        expect(container->read("li input", checked))->Expect.toEqual(Some(true))
        expect(container->read("li", className))->Expect.toEqual(Some("bought"))
        expect(container->read("p", textContent))->Expect.toEqual(Some("0 left"))
      },
    )
  })

  testAsync("Clear bought removes the bought rows only", async () => {
    let bread: ShoppingList.item = {id: "3", label: "bread", bought: false}
    await mounted(
      <ShoppingList initial=[milk, eggs, bread] />,
      async container => {
        expect(container->texts("li"))->Expect.toEqual(["milk", "eggs", "bread"])

        await container->clickOn("button")

        expect(container->texts("li"))->Expect.toEqual(["milk", "bread"])
        expect(container->read("p", textContent))->Expect.toEqual(Some("2 left"))
      },
    )
  })
})
