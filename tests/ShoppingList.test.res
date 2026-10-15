/**
Executable evidence for the `rescript-react` example.

The reducer is tested as a pure function. Components are rendered to static
markup with `ReactDOMServer`, which runs render functions and hooks' initial
state without a DOM, so the suite needs no browser environment.
*/
open RescriptBun.Test

let milk: ShoppingList.item = {id: "1", label: "milk", bought: false}
let eggs: ShoppingList.item = {id: "2", label: "eggs", bought: true}

describe("ShoppingList.reducer", () => {
  test("adds trimmed items and ignores blank labels", () => {
    let added = ShoppingList.reducer([], Add({id: "1", label: "  milk "}))
    expect(added)->Expect.toEqual([milk])
    expect(ShoppingList.reducer(added, Add({id: "2", label: "  "})))->Expect.toEqual([milk])
  })

  test("toggles one item and clears bought items", () => {
    let toggled = ShoppingList.reducer([milk, eggs], Toggle("1"))
    expect(toggled->Array.map(item => item.bought))->Expect.toEqual([true, true])
    expect(ShoppingList.reducer([milk, eggs], ClearBought))->Expect.toEqual([milk])
  })
})

describe("ShoppingList rendering", () => {
  let render = element => ReactDOMServer.renderToStaticMarkup(element)

  test("renders the summary with the default title and remaining count", () => {
    let html = render(<ShoppingList initial=[milk, eggs] />)
    expect(html)->Expect.toInclude("<h1>Shopping</h1>")
    expect(html)->Expect.toInclude("<p>1 left</p>")
    expect(html)->Expect.toInclude(`<li class="bought">`)
  })

  test("an explicit optional prop overrides the default", () => {
    let html = render(
      <ShoppingList.Summary title="Groceries" count=0> {React.null} </ShoppingList.Summary>,
    )
    expect(html)->Expect.toInclude("<h1>Groceries</h1>")
  })

  test("text is escaped by React.string", () => {
    let html = render(<ShoppingList initial=[{id: "x", label: "<b>", bought: false}] />)
    expect(html)->Expect.toInclude("&lt;b&gt;")
  })
})
