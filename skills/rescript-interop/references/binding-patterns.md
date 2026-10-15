# Binding patterns

Every pattern here appears, compiled and tested, in
[PlatformBindings.res](examples/PlatformBindings.res) unless noted.

## Modules

```rescript
// import {join as joinPath} from "node:path"
@module("node:path") external joinPath: (string, string) => string = "join"

// import studentName from "./student"
@module("./student") external studentName: string = "default"

// import attributes, JavaScript module output only
@module({from: "./config.json", with: {type_: "json"}})
external config: JSON.t = "default"
```

`@module` without a payload (`@module external leftPad: ... = "./leftPad"`)
binds the whole module and generates different code for ES modules and
CommonJS; prefer a named or `default` binding.

Relative paths are emitted verbatim and resolve from the generated file. With
`"in-source": false` that file lives under `lib/es6/`, so a handwritten
`./helper.mjs` beside the source is not found, and imports of ReScript
dependencies point into `pkg/lib/es6/`, which packages with an `exports` map
(Sury, for one) do not allow. Build in source.

## Globals

```rescript
@val external parseIntRaw: string => float = "parseInt"
@val @scope("Math") external random: unit => float = "random"
@val @scope("globalThis") external configuredRegion: Nullable.t<string> = "APP_REGION"
```

A bare `@val` compiles to the identifier and throws `ReferenceError` if the
global does not exist. Reading through `@scope("globalThis")` yields
`undefined` instead, which `Nullable.t` models.

## Classes and handles

```rescript
type url
@new external makeUrl: string => url = "URL"
@get external hostname: url => string = "hostname"

let parseUrl = (raw: string): option<url> =>
  try Some(makeUrl(raw)) catch {
  | JsExn(_) => None
  }
```

Keep the type abstract. A record type for a class instance invites callers to
construct fake instances with `{...}` and hides which properties are getters.

## Methods and pipes

`@send` passes its first argument as the receiver, so bindings compose with
`->`:

```rescript
@send @return(nullable)
external matchOnce: (string, RegExp.t) => option<array<string>> = "match"

let firstDigits = text => text->matchOnce(/[0-9]+/)->Option.flatMap(m => m[0])
```

`@return(nullable)` converts both `null` and `undefined` to `None`. Plain
`option` only treats `undefined` as `None`; a `null` would arrive as
`Some(null)`.

## Arguments

- **Optional labelled**: `(string, int, ~fill: string=?) => string`. An
  omitted argument is omitted from the call, so JavaScript defaults apply.
- **Variadic**: `@variadic external joinPaths: array<string> => string`
  spreads the array into the call.
- **Fixed literal**: `(~mode: @as("strict") _) => ...` passes a constant
  without the caller supplying it.
- **One of several types**: write one `external` per shape (they may share
  the JavaScript name), or use an `@unboxed` variant whose payloads are
  distinguishable at runtime. `@unwrap` with polymorphic variants also works
  but is harder to read.
- **Callbacks**: ReScript 12 functions are uncurried, so a ReScript
  `(a, b) => c` is a JavaScript two-argument function. Type callbacks with the
  exact arity JavaScript will call them with.

## Dynamic import

```rescript
let loadMath = async () => {
  let add = await import(MathUtils.add)
  add(1, 1)
}

let loadModule = async () => {
  module Utils = await MathUtils
  Utils.add(2, 2)
}
```

The compiler emits `import()` with the correct generated path, so code never
names file paths for ReScript modules.

## Exporting to JavaScript

Every top-level binding not hidden by a `.resi` is an ES export of the
generated module. `let default = ...` produces a default export. Exported
values have their ReScript runtime representation (see
[runtime-representation.md](runtime-representation.md)), so expose plain
records, strings, numbers, arrays, and functions at a JavaScript-facing
boundary, and throw `JsError` rather than ReScript exceptions.
