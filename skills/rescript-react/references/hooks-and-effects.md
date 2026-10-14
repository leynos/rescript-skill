# Hooks and effects

All hooks live in the `React` module.

## State

```rescript
let (count, setCount) = React.useState(() => 0)
let increment = () => setCount(prev => prev + 1)
```

The initializer is a function (lazy initial state), and the setter always takes
an updater from the previous value. There is no "set to this value" form;
`setCount(_ => 5)` sets a constant.

## Reducers

```rescript
type action =
  | Add({id: string, label: string})
  | Toggle(string)
  | ClearBought

let reducer = (items: array<item>, action: action): array<item> =>
  switch action {
  | Add({id, label}) => items->Array.concat([{id, label, bought: false}])
  | Toggle(id) => items->Array.map(item => item.id == id ? {...item, bought: !item.bought} : item)
  | ClearBought => items->Array.filter(item => !item.bought)
  }

let (items, dispatch) = React.useReducer(reducer, initial)
```

The reducer is a pure function over a closed variant: the compiler checks every
action is handled, and tests call it directly. Prefer it to several `useState`
calls whose values must change together.

## Effects

| Call                              | Runs                             |
| --------------------------------- | -------------------------------- |
| `React.useEffectOnEveryRender(f)` | after every render               |
| `React.useEffect(f, [])`          | once after mount                 |
| `React.useEffect(f, [a])`         | when `a` changes                 |
| `React.useEffect(f, (a, b))`      | when `a` or `b` changes          |
| `React.useLayoutEffect(f, deps)`  | synchronously after DOM mutation |

The effect returns `option<unit => unit>`: `None`, or `Some(cleanup)`.

The dependency parameter is typed `'deps`, so the compiler accepts anything.
Pass an array when every dependency has one type and a tuple otherwise; both
are JavaScript arrays at runtime. React compares each entry with `Object.is`,
so a record or array created during render is "changed" on every render. List
every value from component scope that the effect reads; ReScript has no
exhaustive-deps lint, though `eslint-plugin-react-hooks` can be run over the
generated JavaScript.

Do not use an effect to compute state from props. Compute during render:

```rescript
let remaining = items->Array.filter(item => !item.bought)->Array.length
```

## Refs

`React.useRef(initial)` returns a `ref<'value>` whose `current` field is
mutable. In React 19, a function component can accept `~ref` as an ordinary
prop and pass it to a DOM element; `React.forwardRef` is no longer needed.

## Context

```rescript
let themeContext = React.createContext("light")

module ThemeProvider = {
  let make = React.Context.provider(themeContext)
}

let theme = React.useContext(themeContext)
```

`createContext` takes the default value; `useContext` returns the nearest
provider's value. Keep context values stable (memoize records) to avoid
re-rendering every consumer.

## React 19 hooks

- `React.useActionState(action, initial)` returns
  `(state, formAction, isPending)` for form actions that return the next state
  as a promise.
- `React.useOptimistic(state, ~updateFn)` shows an optimistic value while an
  async action is pending.
- `React.useTransition`, `React.useDeferredValue`, `React.useId`, and
  `React.useSyncExternalStore` are bound with their React 19 signatures.

## Custom hooks

A custom hook is a function whose name starts with `use` and that calls other
hooks. It is the unit of reuse for stateful logic; return a record or tuple of
what callers need, and test its pure parts separately.
