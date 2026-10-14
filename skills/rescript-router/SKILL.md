---
name: rescript-router
description: Route ReScript work to the smallest useful skill. Use for ReScript 12 coding, design, type and module questions, errors and results, JavaScript interop and bindings, async code, the standard library and JSON, rescript.json and the build, migration from ReScript 11, Bun-based testing and property tests, quality tooling, Bun runtime adapters, and React.
metadata:
  globs: "**/rescript.json, **/*.res, **/*.resi, **/bsconfig.json"
---

# ReScript Router

Load this first for non-trivial ReScript work, then load only the smallest
useful follow-on skill. The catalogue targets ReScript 12.3.1 with Bun as the
runner for tests and scripts.

## Working stance

- Start from the concrete problem: the compiler error, the binding that
  returns the wrong shape, the failing suite, or the boundary leaking `unknown`.
- Prefer one language skill plus at most one domain or quality skill.
- Check the project's compiler before advising: `rescript.json` (not
  `bsconfig.json`), `rescript` and `@rescript/runtime` versions in
  `package.json`, and whether `experimental-features` is set. Advice for
  ReScript 11 (`Js.*`, `raise`, `@rescript/core`, `bs-dependencies`) is wrong
  for 12.
- Use the general `leta` skill for navigation and refactors; the ReScript
  language server supports definitions, references, and hovers.
- When a fix needs `Obj.magic`, `%raw`, `%identity` casts, or `'a` in a
  binding, re-check the design before keeping it.
- Read the generated `.res.mjs` when runtime shape matters. The compiler's
  output is the ground truth for interop questions.

## Route by question

- Variants, records, polymorphic variants, opaque types, `.resi` interfaces,
  modules, functors, coercion, or type spreads: `rescript-types-and-modules`
- Option versus result versus exception, error variants, `let?`, `throw`,
  `JsExn`, `JsError`, or `@throws`: `rescript-errors-and-results`
- `external`, `@module`, `@send`, `@val`, `@new`, `@unboxed`, `@tag`, `@as`,
  `Nullable`, `%raw`, genType, or binding a JavaScript library:
  `rescript-interop`
- `async`/`await`, the `Promise` module, rejections, timeouts, cancellation
  with `AbortSignal`, or concurrent fan-out: `rescript-async`
- Stdlib modules (`Array`, `Dict`, `Map`, `Set`, `List`, `String`), JSON
  decoding and encoding, Sury schemas, equality, or Belt and `Js` leftovers:
  `rescript-stdlib-and-data`
- `rescript.json`, namespaces, sources, dev sources, `package-specs`,
  warnings policy, experimental features, monorepos, publishing, or generated
  output policy: `rescript-build-and-config`
- Upgrading from ReScript 11, deprecation warnings, `rescript-tools migrate`,
  or what changed in 12.1 to 12.3: `rescript-12-migration`
- `bun test`, `rescript-bun` test bindings, suite layout, mocks, snapshots,
  time control, or coverage of generated JavaScript: `rescript-bun-testing`
- One invariant over many generated inputs, fast-check bindings, arbitraries
  for variants, or model-based tests: `rescript-property-testing`
- Formatter, warnings as errors, reanalyze dead-code and exception analysis,
  `%todo`, Biome for JavaScript, or documentation generation:
  `rescript-quality-tools`
- `Bun.serve`, files, processes, environment, SQLite, or keeping Bun calls
  out of a portable core: `rescript-bun-runtime`
- `@rescript/react` components, JSX v4, hooks, props records, refs, or
  rendering tests: `rescript-react`

## Testing hierarchy

This is a decision hierarchy, not a prestige ranking. Pick the first rung whose
evidence matches the question, and stop there.

0. **The type system**: make the illegal state unrepresentable with a variant,
   an opaque type behind a `.resi`, or an exhaustive `switch`. A test that
   checks what the compiler already guarantees is noise. Route to
   `rescript-types-and-modules`.
1. **Named example**: one scenario, boundary, regression, rendered output, or
   error variant matters. Use `rescript-bun-testing`.
2. **Case table**: a finite truth table where each row means something. The
   Bun bindings have no `test.each`; iterate an array of named cases inside
   `describe`. Use `rescript-bun-testing`.
3. **Lightweight property**: one relation (round trip, idempotence, oracle,
   agreement between two implementations) over cheap generated inputs. Use
   `rescript-property-testing`.
4. **Model-based property**: bugs depend on sequences of operations or on
   structured, dependent inputs. Stay with `rescript-property-testing`.

Leave the hierarchy when the failure depends on a real service, process,
schedule, or load. Use an integration test through a Bun adapter
(`rescript-bun-runtime`) or a benchmark instead.

## Pairing rules

- Binding a library usually pairs `rescript-interop` with
  `rescript-types-and-modules` (abstract types and `.resi`) or
  `rescript-errors-and-results` (throwing APIs).
- Async boundaries pair `rescript-async` with `rescript-errors-and-results`.
- JSON at a service edge pairs `rescript-stdlib-and-data` with
  `rescript-errors-and-results`.
- Upgrading a project pairs `rescript-12-migration` with
  `rescript-build-and-config`; stop there unless a specific API breaks.
- A suite that keeps growing rows for one invariant moves from
  `rescript-bun-testing` to `rescript-property-testing`.
- Server or CLI code pairs `rescript-bun-runtime` with `rescript-async`.

## Escalate when

- `Obj.magic`, `%identity` casts, or `%raw` appear outside one documented
  binding module,
- a binding types a parameter or return as `'a` or `'b` with no constraint,
- warnings are silenced in `rescript.json` rather than at a narrow scope with
  a stated reason,
- a `.resi` exposes a record or variant whose invariants callers can break,
- `Js.*`, `Belt.*`, or `raise` appear in new ReScript 12 code,
- reanalyze findings are suppressed by path rather than fixed or annotated,
- a test asserts on generated JavaScript text instead of behaviour.

Read [routing-matrix.md](references/routing-matrix.md) only when the route is
still unclear.
