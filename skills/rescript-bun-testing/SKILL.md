---
name: rescript-bun-testing
description: Use for example-based ReScript tests run with `bun test` through the `rescript-bun` bindings — suite naming and layout, making sure compiled suites actually run, describe/test/testAsync, matchers, case tables without test.each, mocks and spies via local bindings, controlling time, snapshots, and coverage of generated JavaScript.
metadata:
  globs: "**/tests/**/*.res, **/*.test.res, **/bunfig.toml, **/rescript.json"
---

# ReScript testing with Bun

Use this when writing or repairing example-based tests for ReScript code under
Bun. For generated-input tests, load `rescript-property-testing`.

## Working stance

- Test behaviour through the module's public interface. Assert on values and
  variants, not on generated JavaScript or rendered strings, unless the string
  is the contract.
- Prove the suite ran. Bun does not discover `*.test.res.mjs` by default; a
  green `bun test` can mean nothing ReScript executed.
- Design for injection: pass clocks, senders, and stores as labelled
  arguments or records of functions. Mocks are for observing calls, not for
  replacing half a module.
- Keep test-only bindings in dev sources. Open `RescriptBun.Test` locally in
  each suite, never through `compiler-flags`.
- Prefer named tests and small case tables. When a table keeps growing to
  sample one rule, move to `rescript-property-testing`.

## Decision surface

| Need                              | Default move                                                          |
| --------------------------------- | --------------------------------------------------------------------- |
| one scenario or regression        | `test("names the rule", () => ...)`                                   |
| a promise-returning check         | `testAsync("...", async () => ...)`                                   |
| a finite table of meaningful rows | `rows->Array.forEach(((label, input, expected)) => test(label, ...))` |
| setup shared by a group           | `beforeEach` / `afterEach` inside `describe`                          |
| observe calls to a collaborator   | `BunMock.make` binding to `bun:test`'s `mock`                         |
| code that reads `Date.now()`      | inject `~now`, or `setSystemTime` plus a reset binding                |
| a large rendered artefact         | `Expect.toMatchSnapshot`, reviewed like source                        |
| a thrown JavaScript error         | `expect(() => f())->Expect.toThrow(~expected=String("..."))`          |
| a ReScript error variant          | `expect(f(x))->Expect.toEqual(Error(Invalid(x)))`                     |

_Table 1: Default moves for Bun test suites._

## Running suites

- Name suites `Foo.test.res` in a dev source with `"namespace": true`.
  Without a namespace, `Foo.test.res` cannot refer to `Foo`.
- Compile first, then pass every compiled suite to Bun explicitly:
  `bun test ./tests/Foo.test.res.mjs ...`. A bare `bun test` runs only files
  matching Bun's own patterns (`*.test.mjs` and friends) and silently skips
  `*.test.res.mjs`.
- Derive the list from the sources (`tests/*.test.res` → `.res.mjs`), so a
  missing compiled file fails loudly rather than vanishing.
- Exclude test bodies from coverage with `coveragePathIgnorePatterns` in
  `bunfig.toml`; coverage measures generated JavaScript, not ReScript lines.

## What `rescript-bun` 2.1.0 binds

`describe` (with `only`, `skip`, `todo`, `if_`, `skipIf`), `test` and
`testAsync` (same variants), the lifecycle hooks, `setSystemTime`, `expect`,
and about seventy matchers: `toBe`, `toEqual`, `toStrictEqual`, `toBeCloseTo`,
`toThrow`, `toContain`, `toMatch`, `toMatchSnapshot`, `toHaveBeenCalledTimes`,
`resolves`, `rejects`, `not`, and others. It does not bind `mock`, `spyOn`,
`test.each`, or a no-argument `setSystemTime()`; write narrow local bindings
for those, as the examples do.

## Red flags

- `bun test` with no file arguments in a ReScript project's test script.
- `-open RescriptBun` or `-open RescriptBun.Test` in `compiler-flags`.
- A mock bound with `'a` arguments, or `Obj.magic` used to call it.
- `setSystemTime` with no reset, leaking a frozen clock into later suites.
- Real sleeps of hundreds of milliseconds to "let async work finish".
- Snapshot files regenerated without review.
- Assertions on `.res.mjs` text.

## References

- [suite-layout-and-runner.md](references/suite-layout-and-runner.md):
  configuration, naming, explicit suite lists, Make integration, coverage, and
  snapshot files.
- [mocks-clocks-and-tables.md](references/mocks-clocks-and-tables.md):
  dependency injection, the `bun:test` mock binding, clock control, case
  tables, and async assertions.
- Executable examples: [BunMock.res](references/examples/BunMock.res),
  [BunClock.res](references/examples/BunClock.res), and
  [OverdueNotifier.res](references/examples/OverdueNotifier.res).
