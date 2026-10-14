---
name: rescript-interop
description: Use for ReScript 12 JavaScript interop — writing `external` bindings with `@module`, `@send`, `@get`, `@new`, `@val`, `@scope`, `@variadic`, and `@return(nullable)`; matching JavaScript shapes with `@tag`, `@as`, and `@unboxed`; `null`/`undefined` with `Nullable`; dynamic import; genType; and keeping `%raw` and `Obj.magic` out of application code.
metadata:
  globs: "**/*.res, **/*.resi, **/*.mjs, **/*.js"
---

# ReScript Interop

Use this when ReScript meets JavaScript: binding a library, matching a wire
shape, or exposing ReScript to JavaScript callers.

## Working stance

- An `external` is a promise the compiler cannot check. Keep bindings small,
  concrete, and in one module per library, with ReScript-shaped wrappers beside
  them. Application code calls the wrappers.
- Bind what you use, with the narrowest honest types. A binding with `'a`
  in argument or return position is `Obj.magic` with extra steps.
- Represent JavaScript classes and handles as abstract types (`type url`),
  never as records you made up.
- Convert at the boundary: thrown errors to `result` or `option`, nullable
  returns to `option`, string unions to variants. Nothing JavaScript-shaped
  should leak past the binding module.
- Read the generated `.res.mjs` when you write a binding. It is the only
  proof that the call you described is the call that runs.
- Types on data from outside the process (JSON, `postMessage`, storage) are
  claims, not checks. Decode untrusted data; see `rescript-stdlib-and-data`.

## Decision surface

| JavaScript thing                         | Binding                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| named export of a module                 | `@module("pkg") external f: ... = "name"`                       |
| default export                           | `@module("pkg") external f: ... = "default"`                    |
| global value or function                 | `@val external f: ... = "name"`                                 |
| value under a global namespace           | `@val @scope("Math") external random: unit => float = "random"` |
| class constructor                        | `type t` plus `@new external make: ... => t = "Class"`          |
| method on an object                      | `@send external m: (t, ...) => ... = "method"`                  |
| property read or write                   | `@get` / `@set`, or a record type for plain data                |
| variadic function                        | `@variadic external f: array<string> => ... = "f"`              |
| return that may be `null` or `undefined` | `@return(nullable)` with an `option` return type                |
| value that may be `null` or `undefined`  | `Nullable.t<'a>`, converted with `Nullable.toOption`            |
| argument that is one of several literals | variant with `@as("literal")` constructors                      |
| object discriminated by a field          | `@tag("kind")` variant with `@as` constructor tags              |
| `string \| number` style union           | `@unboxed` variant with distinguishable payloads                |
| enum that may gain new values            | `@unboxed` variant with a catch-all `Other(string)` case        |
| lazy-loaded ReScript code                | `await import(Module.value)` or `module M = await Module`       |
| TypeScript consumers of ReScript code    | `@genType` with `gentypeconfig` in `rescript.json`              |

## Facts worth knowing in 12.x

- A bare `@val external x: ... = "X"` compiles to the identifier `X`, which
  throws `ReferenceError` when the global is absent. For globals that may be
  missing, bind through `@val @scope("globalThis")` and type the value
  `Nullable.t<_>`; the read then yields `undefined` instead.
- Optional labelled arguments (`~fill: string=?`) are omitted from the
  JavaScript call when not supplied.
- `@unboxed` now discriminates `Set`, `Map`, `WeakSet`, and `WeakMap`
  (12.1), plus `ArrayBuffer`, `DataView`, and typed arrays (12.0).
- `@module("./file.mjs")` is emitted verbatim and resolves from the generated
  file. With `"in-source": false` that file is under `lib/es6/`, not beside
  your source, and dependency imports become `pkg/lib/es6/...`, which packages
  with an `exports` map reject. Build in source.
- `@meth`, `@bs.send.pipe`, and every `@bs.*` attribute are gone; use the
  unprefixed forms.

## Red flags

- `%raw` in application code. Keep it in a binding module, commented, with a
  test that exercises it, or replace it with an `external`.
- `Obj.magic` or `external cast: 'a => 'b = "%identity"` used to "fix" a type
  error.
- A binding typed `JSON.t => user` or `'a => user` that skips decoding.
- Records invented to describe a class instance with methods.
- A JavaScript API that throws, bound without a wrapper that converts the
  exception.
- `option<'a>` used where JavaScript returns `null`: `option` only models
  `undefined`.
- `@unboxed` variants with two payloads of the same runtime type (two string
  cases, or `int` and `float`); the compiler rejects them, so do not reach for
  `Obj.magic` to get around it.

## References

- [binding-patterns.md](references/binding-patterns.md): modules, globals,
  classes, methods, callbacks, variadic and optional arguments, polymorphic
  functions, dynamic import, and exporting to JavaScript.
- [runtime-representation.md](references/runtime-representation.md): how
  each ReScript type compiles, and how `@tag`, `@as`, and `@unboxed` change it.
- [unsafe-escapes.md](references/unsafe-escapes.md): `Nullable`, `%raw`,
  `%identity`, `Obj.magic`, `unknown`, and genType, with the rules for when
  each is acceptable.
- Executable examples:
  [PlatformBindings.res](references/examples/PlatformBindings.res) and
  [WireShapes.res](references/examples/WireShapes.res).
