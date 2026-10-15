# Testing components

## Test the reducer as functions

```rescript
test("toggles one item and clears bought items", () => {
  let toggled = ShoppingList.reducer([milk, eggs], Toggle("1"))
  expect(toggled->Array.map(item => item.bought))->Expect.toEqual([true, true])
  expect(ShoppingList.reducer([milk, eggs], ClearBought))->Expect.toEqual([milk])
})
```

Most component logic belongs here, and these tests need no React at all. A
reducer is also a natural subject for a model-based property
(`rescript-property-testing`).

## Render to static markup under Bun

`@rescript/react` binds `ReactDOMServer.renderToStaticMarkup`, which runs
component functions and hooks' initial state and returns HTML. It needs no
Document Object Model (DOM), so it runs directly under `bun test`:

```rescript
let render = element => ReactDOMServer.renderToStaticMarkup(element)

test("renders the summary with the default title and remaining count", () => {
  let html = render(<ShoppingList initial=[milk, eggs] />)
  expect(html)->Expect.toInclude("<h1>Shopping</h1>")
  expect(html)->Expect.toInclude("<p>1 left</p>")
})
```

Assert on the fragments that matter, not on the whole string. Static rendering
does not run effects or event handlers, so it suits structure, text, default
props, and escaping (`React.string` escapes `<b>` to `&lt;b&gt;`), not
interaction.

The test suite in this repository is `tests/ShoppingList.test.res`. It cannot
be called `React.test.res`: a suite with that name cannot see the `React`
module from `@rescript/react`.

## Interaction tests

Clicks, typing, and effects need a DOM and React's `act` loop. This repository's
`tests/dom/ShoppingListDom.test.res` does it under Bun:

- Preload happy-dom with `bun test --preload ./tests/support/happy-dom.mjs`,
  a module that calls `GlobalRegistrator.register()` from
  `@happy-dom/global-registrator` and sets
  `globalThis.IS_REACT_ACT_ENVIRONMENT = true`. A preload runs before any suite
  imports React DOM, which decides at import time whether it is in a browser.
- Run DOM suites in their own `bun test` process. Registration replaces
  globals such as `fetch`, `Request`, and `Response`, which breaks suites that
  talk to a real `Bun.serve`.
- Mount with `ReactDOM.Client.createRoot` into a fresh container, and wrap the
  render, every event, and the unmount in `React.act`, which `@rescript/react`
  0.15 binds. An unmount outside `act` draws React's "not wrapped in act"
  warning.
- Bind the few DOM members the suite uses (`querySelector`, `click`,
  `textContent`, `checked`) locally in the suite, as narrowly as the `bun:test`
  mocks in `rescript-bun-testing`.

```rescript
let clickOn = element => React.act(async () => element->click)

await clickOn(container->find("button"))
expect(container->texts("li"))->Expect.toEqual(["milk", "bread"])
```

Most of the value is still in reducer and static-render tests, which cost
nothing to set up; add DOM tests for the wiring between events and state.
