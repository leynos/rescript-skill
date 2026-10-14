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
component functions and hooks' initial state and returns HTML. It needs no DOM,
so it runs directly under `bun test`:

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

Clicks, typing, and effects need a DOM and React's test act loop. Options:

- Register a DOM implementation for Bun (for example happy-dom through
  `@happy-dom/global-registrator` in a `bunfig.toml` preload), render with
  `ReactDOM.Client`, and drive events; wrap updates in `React.act`, which
  `@rescript/react` 0.15 binds.
- Or run component tests in a browser-based runner and keep Bun for logic
  and static rendering.

Either way, bind the testing library calls you use as narrowly as the
`bun:test` mocks in `rescript-bun-testing`. Most of the value is usually in
reducer and static-render tests, which cost nothing to set up.
