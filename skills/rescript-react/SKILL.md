---
name: rescript-react
description: Use for React with ReScript 12 and @rescript/react 0.15 — JSX v4 components, labelled and optional props, children, keys, @react.componentWithProps, hooks and effect dependencies, reducers, events, refs as props, React 19 hooks such as useActionState, importing JavaScript components, and rendering components in Bun tests.
metadata:
  globs: "**/*.res, **/*.resi, **/rescript.json"
---

# ReScript and React

Use this for React components and hooks written in ReScript. For tests under
Bun in general, see `rescript-bun-testing`; for bindings to non-React
JavaScript, `rescript-interop`.

## Working stance

- Keep state transitions in plain functions: a `reducer` over a variant
  `action` is testable without React and exhaustively checked.
- Type props explicitly. A component's props are its public API; inferred
  props produce confusing errors far from the cause.
- Model component variations with variant props, not with booleans and
  optional props that must agree.
- Effects synchronize with the outside world. Derive values during render
  instead of copying them into state through an effect.
- Prefer props over children when the parent must constrain what it
  receives; every child is just a `React.element`.
- Test the reducer as functions and the component as rendered output.

## Decision surface

| Need                                                       | Move                                                           |
| ---------------------------------------------------------- | -------------------------------------------------------------- |
| a component                                                | `@react.component let make = (~label: string, ...) => <jsx />` |
| a props record the code defines                            | `@react.componentWithProps let make = (props: props) => ...`   |
| an optional prop with a default                            | `~title: string="Shopping"`                                    |
| an optional prop without a default                         | `~title: option<string>=?`; pass `title=?maybeTitle` in JSX    |
| several components in one file                             | submodules with their own `make`: `<ShoppingList.Summary />`   |
| text, numbers, lists in JSX                                | `React.string`, `React.int`, `React.float`, `React.array`      |
| render nothing                                             | `React.null`                                                   |
| list items                                                 | `->Array.map(item => <Row key=item.id ... />)->React.array`    |
| local state                                                | `React.useState(() => initial)`; setter takes `prev => next`   |
| transitions with rules                                     | `React.useReducer(reducer, initial)`                           |
| side effect on mount or change                             | `React.useEffect(() => ...; None, [dep])` or a tuple of deps   |
| Document Object Model (DOM) attribute named like a keyword | `type_`; `ariaLabel` for `aria-label`                          |
| form actions (React 19)                                    | `React.useActionState`, `React.useOptimistic`                  |
| render in a test without a DOM                             | `ReactDOMServer.renderToStaticMarkup(<C />)`                   |
| click or type in a test                                    | happy-dom preload, `ReactDOM.Client`, and `React.act`          |

_Table 1: Moves for React components and hooks._

## Rules that surprise people

- `React.useState` takes a function: `React.useState(() => 0)`, and the
  setter takes an updater: `setCount(prev => prev + 1)`.
- `useEffect`'s dependency parameter is typed `'deps`: pass `[]`, an array
  of one type, or a tuple for mixed types. A record or a fresh array built each
  render compiles, and silently reruns the effect every render.
- Dependencies compare by identity. Records and arrays recreated during
  render are new every time; depend on their fields or memoize.
- `key` is reserved and cannot be a component argument. In React 19, `ref`
  can be an ordinary prop.
- JSX v4 is the only mode in ReScript 12, and children spreads
  (`...children`) are gone.
- The compiler does not enforce the rules of hooks. Keep hooks at the top
  level of `make` or a custom hook (`useSomething`).

## Red flags

- `ReactEvent.Form.target(e)["value"]` read without a type at the use site.
- A `useEffect` that sets state derived from props.
- Booleans `isLoading`, `isError`, and `data` options in one state record.
- `%raw` JSX or `React.createElement` calls where JSX works.
- Snapshot tests of whole pages instead of assertions on the relevant text.
- A component file named after a dependency module (`React.res`), or a test
  suite named `React.test.res`, which shadows `React` for that file.

## References

- [components-and-props.md](references/components-and-props.md): component
  forms, props, children, keys, submodules, DOM attributes, and importing
  JavaScript components.
- [hooks-and-effects.md](references/hooks-and-effects.md): state, reducers,
  effects and dependencies, refs, context, and React 19 hooks.
- [testing-components.md](references/testing-components.md): reducers as
  functions, static rendering under Bun, and when to reach for a DOM.
- Executable example: [ShoppingList.res](references/examples/ShoppingList.res).
