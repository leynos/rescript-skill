# ReScript routing matrix

Use this when the router's question list does not resolve to one skill.

| Symptom or task                                         | Primary skill                     | Common pair                   |
| ------------------------------------------------------- | --------------------------------- | ----------------------------- |
| Warning 3: `deprecated: Js.log` or `raise`              | `rescript-12-migration`           | `rescript-quality-tools`      |
| `bsconfig.json`, `bs-dependencies`, or `bsc-flags`      | `rescript-12-migration`           | `rescript-build-and-config`   |
| `The module or file X can't be found`                   | `rescript-build-and-config`       | `rescript-bun-testing`        |
| Two files with the same module name                     | `rescript-build-and-config`       | None                          |
| Library consumers clash with a local `Util` module      | `rescript-build-and-config`       | None                          |
| Record field typo compiles against the wrong record     | `rescript-types-and-modules`      | None                          |
| Callers construct invalid values of a public type       | `rescript-types-and-modules`      | None                          |
| Variant needs a stable JSON or TypeScript string        | `rescript-interop`                | `rescript-types-and-modules`  |
| JavaScript value may be `null` or `undefined`           | `rescript-interop`                | `rescript-stdlib-and-data`    |
| Binding a class, method chain, or module default export | `rescript-interop`                | `rescript-types-and-modules`  |
| Heterogeneous JavaScript union (string or number)       | `rescript-interop`                | None                          |
| `result<_, string>` spreads across modules              | `rescript-errors-and-results`     | `rescript-types-and-modules`  |
| Nested `switch` ladders over `result`                   | `rescript-errors-and-results`     | None                          |
| JavaScript library throws                               | `rescript-errors-and-results`     | `rescript-interop`            |
| reanalyze: "might throw … not annotated with @throws"   | `rescript-errors-and-results`     | `rescript-quality-tools`      |
| Promise rejection escapes a handler                     | `rescript-async`                  | `rescript-errors-and-results` |
| Request must time out or be cancelled                   | `rescript-async`                  | `rescript-bun-runtime`        |
| Decoding untrusted JSON                                 | `rescript-stdlib-and-data`        | `rescript-errors-and-results` |
| `==` on records is slow or surprising                   | `rescript-stdlib-and-data`        | None                          |
| Choosing `Dict`, `Map`, `Set`, `array`, or `list`       | `rescript-stdlib-and-data`        | None                          |
| `Int.fromString("80abc")` returns `Some(80)`            | `rescript-stdlib-and-data`        | `rescript-errors-and-results` |
| Suite compiles but `bun test` finds nothing             | `rescript-bun-testing`            | `rescript-build-and-config`   |
| Test needs a mock function or fake clock                | `rescript-bun-testing`            | `rescript-interop`            |
| Case table keeps growing to sample one invariant        | `rescript-property-testing`       | `rescript-bun-testing`        |
| Encoder and decoder must round-trip                     | `rescript-property-testing`       | `rescript-stdlib-and-data`    |
| Bug depends on a sequence of operations                 | `rescript-property-testing`       | None                          |
| CI should fail on dead code or `%todo`                  | `rescript-quality-tools`          | `rescript-build-and-config`   |
| Markdown or docstring examples drift from the compiler  | `rescript-quality-tools`          | None                          |
| Core module imports `RescriptBun`                       | `rescript-bun-runtime`            | `rescript-build-and-config`   |
| HTTP handler, file IO, or subprocess in ReScript        | `rescript-bun-runtime`            | `rescript-async`              |
| Invariant must hold for every input, not sampled ones   | `rescript-deductive-verification` | `rescript-property-testing`   |
| Handwritten Dafny or Lean model of a ReScript function  | `rescript-deductive-verification` | None                          |
| Proof passes but no mutant of the source breaks it      | `rescript-deductive-verification` | None                          |
| Component props, children, or hook dependencies         | `rescript-react`                  | `rescript-types-and-modules`  |
| Rendering a component in a Bun test                     | `rescript-react`                  | `rescript-bun-testing`        |

## Anti-routing

- Do not load `rescript-12-migration` for a project already on 12 that
  merely uses one deprecated function; the warning text names the replacement
  and `rescript-tools migrate` applies it.
- Do not load `rescript-interop` for code that never crosses into
  JavaScript. Records, variants, and modules belong to
  `rescript-types-and-modules`.
- Do not route an obvious single invariant through more than
  `rescript-property-testing`; it carries its own decision surface.
- Do not load `rescript-bun-runtime` to write tests: the test bindings live
  in `rescript-bun-testing` even though both come from `rescript-bun`.
- Do not load `rescript-quality-tools` to explain one compiler warning; load
  it when the question is about the gate, its configuration, or CI.
- Do not load `rescript-deductive-verification` for what a variant or an
  opaque type can enforce, or to "prove" timeouts, cancellation, or scheduling;
  those belong to the type system and to conformance tests.
