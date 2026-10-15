/***
React components with `@rescript/react` 0.15 and JSX v4.

State changes live in a pure `reducer`, tested without React. The components
show labelled props, an optional prop, typed children, keyed lists, and a
`useReducer` hook. Every element is typed: text needs `React.string`, numbers
`React.int`, and arrays `React.array`.
*/

type item = {id: string, label: string, bought: bool}

type action =
  | Add({id: string, label: string})
  | Toggle(string)
  | ClearBought

/** The next list after one action; blank labels are ignored. */
let reducer = (items: array<item>, action: action): array<item> =>
  switch action {
  | Add({id, label}) =>
    label->String.trim == ""
      ? items
      : items->Array.concat([{id, label: label->String.trim, bought: false}])
  | Toggle(id) => items->Array.map(item => item.id == id ? {...item, bought: !item.bought} : item)
  | ClearBought => items->Array.filter(item => !item.bought)
  }

/** How many items are still to buy. */
let remaining = (items: array<item>): int => items->Array.filter(item => !item.bought)->Array.length

module Row = {
  @react.component
  let make = (~item: item, ~onToggle: string => unit) =>
    <li className={item.bought ? "bought" : "pending"}>
      <label>
        <input type_="checkbox" checked=item.bought onChange={_ => onToggle(item.id)} />
        {React.string(item.label)}
      </label>
    </li>
}

module Summary = {
  // `~title` is optional; `children` is an ordinary typed prop.
  @react.component
  let make = (~title: string="Shopping", ~count: int, ~children: React.element) =>
    <header>
      <h1> {React.string(title)} </h1>
      <p>
        {React.int(count)}
        {React.string(" left")}
      </p>
      children
    </header>
}

/** The whole list: a summary with a clear button, then one row per item. */
@react.component
let make = (~initial: array<item>) => {
  let (items, dispatch) = React.useReducer(reducer, initial)
  <section>
    <Summary count={remaining(items)}>
      <button onClick={_ => dispatch(ClearBought)}> {React.string("Clear bought")} </button>
    </Summary>
    <ul>
      {items
      ->Array.map(item => <Row key=item.id item onToggle={id => dispatch(Toggle(id))} />)
      ->React.array}
    </ul>
  </section>
}
