# Limitations and gotchas

## Supported ReScript surface

What happens to common constructs on this route, with ReScript 12.3.1,
LemmaScript 0.6.4, and Dafny 4.11:

| ReScript construct                                  | Compiles to                     | Status                                                          |
| --------------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| `@tag` variant, record payload on every constructor | `switch (x.kind)` over objects  | Verifies                                                        |
| Untagged variant, record payloads only              | `TAG` discriminant              | Verifies                                                        |
| Polymorphic variant without payload                 | string literals                 | Verifies                                                        |
| `option<int>`                                       | `undefined` checks              | Verifies                                                        |
| `array` with `Array.map`                            | native `.map`                   | Verifies                                                        |
| String concatenation                                | `+` on strings                  | Verifies                                                        |
| `throw` of an exception                             | `throw`                         | Verifies; the prover must show it unreachable                   |
| `int` arithmetic                                    | `e \| 0`                        | Verifies through the `int32` rewrite                            |
| Recursion over `int`                                | direct recursion                | Verifies, with int32 overflow made visible                      |
| Variant with a constant constructor                 | `typeof x !== "object"`         | Not supported: `typeof` is not modelled                         |
| `result<…>` in a contracted signature               | anonymous union from genType    | Refused; `@genType type checked = result<int, string>` verifies |
| `for`/`while` loops, `ref`                          | mutable locals                  | Not supported: no route for loop invariants                     |
| `int` division, even as `(a, b) => a / b`           | an alias to `Primitive_int.div` | Refused: no body to verify                                      |
| `list`, `Belt`, most standard library calls         | runtime library calls           | Not supported without specified externs                         |
| `==` on records                                     | `Primitive_object.equal`        | Rejected by warning 102 under `+A`                              |

The compiler eta-reduces a function that only calls a runtime helper, so even
`let quot = (a: int, b: int): int => a / b` compiles to
`let quot = Primitive_int.div` and has no body to verify. Verify the callers
instead, or give the helper a specified extern.

## Semantic gaps

- **Integers.** The model is exact, and the bridge restores int32 wrap. A
  proof about `int` arithmetic therefore includes overflow, and an `@ensures`
  such as `result >= 0` on a sum can fail where intuition says it holds. In the
  spike, a recursive `sumTo(65536)` returned `-2147450880` once given a stack
  deep enough to finish.
- **Floats.** Exact reals with no `NaN`, infinities, `-0`, or rounding. Do
  not prove properties of `float` code.
- **The stack.** Dafny assumes recursion always has room. Bun exhausts its
  stack at about 50,000 frames of a simple recursive function, so a "proved"
  recursive function can still throw `RangeError`.
- **Equality in contracts.** `===` between records is structural in the
  model and referential at runtime. Contracts are not executed, so the
  structural reading is the useful one, but never copy a contract into code.
- **`switch` fall-through.** The compiled JavaScript ends every case with a
  `return`, but LemmaScript models fall-through faithfully, appending the
  following cases as unreachable code. The Dafny grows, perhaps threefold, and
  stays sound.
- **Compiler optimizations are in scope.** The proof covers constant folding
  (`1000000 + 2147483647` folds with wrap-around) and merged identical match
  arms, because it covers the emitted code.

## Environmental properties

These need the runtime and are out of reach of any proof over the transition
function:

- abort and timeout delivery, and listener ordering;
- promise rejection, and what reaches a `catch`;
- ordering between concurrent tasks;
- stack depth and memory;
- that untyped JavaScript callers pass well-typed values.

Test them with conformance tests against the effectful shell, using real
`AbortController`s, deferred promises, and rejected work. Keep the shell thin,
so each test only has to show that the shell calls the proved function with the
right events.

## Operational gotchas

- `rescript-tools doc` fails with "try to build the project" on a file
  outside a built project. Build before bridging, and bridge in place.
- The contract dump must use `bsc -only-parse`. Without it, `bsc` type-checks
  outside the project's settings, fails for any module with dependencies, and
  writes `.cmi` and `.cmt` files beside the source.
- `lsc check` three-way merges into an existing `.dfy`. A stale one from an
  earlier run produces "modifications to generated lines" warnings and
  confusing errors. Start from an empty output directory.
- Dafny 4.11 needs Z3 on `PATH` and expects 4.12.1. Without it, it reports a
  resolution error rather than a missing tool.
- LemmaScript is a tech preview that releases often. Pin an exact version,
  and re-run every proof on upgrade before trusting the old results.

## Maintenance costs

- The bridge depends on four compiler output formats:
  - the JavaScript shape;
  - genType's `.gen.ts`;
  - the documentation JSON;
  - the Printast dump.

  A compiler upgrade can break any of them. The audit and the byte-identical
  regeneration detect breakage; they do not prevent it.
- Contracts are prose to the compiler. Renaming a field or an `@as` tag
  breaks contracts silently until the next proof run, so run `make prove`, or
  its equivalent, whenever proved modules change.
- A function with a loop, or one that calls runtime-library helpers, needs
  toolchain work before it can be proved. Prefer restructuring proved code into
  recursion over `int` and arrays with `map`, `filter`, `some`, and `every`.
