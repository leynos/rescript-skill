# Components and props

## Setup

```json
{
  "jsx": {"version": 4},
  "dependencies": ["@rescript/react"]
}
```

`@rescript/react` 0.15 requires React and React DOM 19.2 or later. Install
`react`, `react-dom`, and `@rescript/react` as dependencies.

## Component forms

```rescript
// Labelled arguments become the props record.
@react.component
let make = (~label: string, ~count: int) =>
  <p>
    {React.string(label)}
    {React.int(count)}
  </p>
```

```rescript
// A props record you define yourself.
type props = {label: string, count: int}

@react.componentWithProps
let make = (props: props) =>
  <p>
    {React.string(props.label)}
    {React.int(props.count)}
  </p>
```

A file is a module, and its `make` is the component: `ShoppingList.res` renders
as `<ShoppingList />`. Nested modules with their own `make` are components too
(`<ShoppingList.Summary />`), which keeps small private pieces beside their
only user. The generated JavaScript component takes the module's name, which
shows up in React DevTools.

## Props

| Prop kind                    | Declaration                 | Use in JSX                     |
| ---------------------------- | --------------------------- | ------------------------------ |
| required                     | `~count: int`               | `count=3` or `count` (punning) |
| optional with a default      | `~title: string="Shopping"` | omit, or `title="Groceries"`   |
| optional, absence meaningful | `~title: option<string>=?`  | `title="x"` or `title=?maybe`  |
| callback                     | `~onToggle: string => unit` | `onToggle={id => ...}`         |
| children                     | `~children: React.element`  | nested elements                |

Expressions in attribute position need braces unless they are a simple
identifier or literal: `count={remaining(items)}`, `key=item.id`.

## Children

Children are a prop like any other and can be typed:

- `~children: React.element` for arbitrary nested content;
- `~children: option<React.element>=?` when children are optional;
- `~children: string` to accept only text;
- no `children` argument to reject children at compile time.

When a parent needs specific kinds of children (a list of items, a header),
take them as typed props instead: `items: array<item>` is checkable, `children`
is not.

## Lists and keys

```rescript
{
  items
  ->Array.map(item => <Row key=item.id item onToggle={id => dispatch(Toggle(id))} />)
  ->React.array
}
```

Keys must be stable and unique among siblings; use domain IDs, not array
indices, when items can be reordered or removed. `key` is supplied in JSX and
cannot be declared as a component argument.

## DOM elements

- Text must be wrapped: `{React.string(label)}`. Numbers use `React.int` and
  `React.float`. Nothing is `React.null`.
- `type` is a keyword; write `type_="checkbox"`.
- `aria-*` attributes are camel-cased: `ariaLabel`.
- `className` compiles to `class` in rendered HTML.
- Event handlers receive typed events: `onClick: ReactEvent.Mouse.t => unit`,
  `onChange: ReactEvent.Form.t => unit`. `ReactEvent.Form.target(e)` returns an
  open object; read `["value"]` into a typed binding immediately:

```rescript
let onChange = event => {
  let value: string = ReactEvent.Form.target(event)["value"]
  setQuery(_ => value)
}
```

## Importing JavaScript components

Bind a JavaScript component as an `external` named `make` inside a module, with
its props as labelled arguments:

```rescript
module Confetti = {
  @module("react-confetti") @react.component
  external make: (~width: int, ~height: int, ~recycle: bool=?) => React.element = "default"
}
```

Bind only the props you use, with precise types, as with any binding.
