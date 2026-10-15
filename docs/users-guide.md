# Users' guide

This guide covers installation, invocation, the routing rules, and the testing
hierarchy the catalogue teaches. It is for people using the skills in their own
ReScript work. For working on this repository, see the
[developers' guide](developers-guide.md).

## What the catalogue assumes

The skills target ReScript 12.3.1. They assume:

- `rescript.json`, not `bsconfig.json`, and the keys `dependencies`,
  `dev-dependencies`, and `compiler-flags` rather than their `bs-` and `bsc-`
  predecessors;
- the standard library that ships with the compiler (`Array`, `Dict`,
  `JSON`, `Promise`, `JsExn`, and so on), not `@rescript/core`, `Js.*`, or
  `Belt` for new code;
- Bun as the test runner and script runtime, through the `rescript-bun`
  bindings.

Advice for ReScript 11 projects belongs to `rescript-12-migration`, which
explains how to get to 12 first.

## Installation

Copy the catalogue into the agent's skill directory:

```bash
make install-skills
```

The target copies the committed `skills/` tree with `git archive`, so compiler
output from a local build is never included. Set `SKILLS_DEST` to install
elsewhere. On a fresh checkout, `cp -a skills/* ~/.codex/skills/` is equivalent.

Each `skills/<name>/` directory carries a `SKILL.md` with YAML frontmatter. A
strict loader discovers a skill by its directory and identifies it by the
`name` field, so the two must match. The repository's `make lint` gate
validates every manifest; the copy itself performs no validation. Re-run the
copy after updating the checkout.

Some skills ship ReScript files under `references/examples/`. They are
complete, compiling modules that the agent can read as worked examples, or copy
into a project as a starting point.

## Invocation

The router is the default entry point:

```text
Use $rescript-router to plan this ReScript task.
```

The router resolves the task to the smallest useful follow-on skill. Every
other skill sets `allow_implicit_invocation: false` in `agents/openai.yaml`, so
it loads only when named or routed to. Avoid loading more than one language
skill and one domain or quality skill in the same turn.

For a known pressure point, call the skill directly:

```text
Use $rescript-errors-and-results to replace these string errors with a
variant the HTTP layer can match on.
```

## Routing rules

- *Types, records, variants, modules, `.resi`* →
  `rescript-types-and-modules`.
- *Failure shape, `result`, exceptions, `let?`, `JsExn`* →
  `rescript-errors-and-results`.
- *Bindings and runtime representation* → `rescript-interop`.
- *Promises, `async`/`await`, cancellation* → `rescript-async`.
- *Standard library, collections, JSON, equality* →
  `rescript-stdlib-and-data`.
- *`rescript.json`, namespaces, warnings, monorepos, publishing* →
  `rescript-build-and-config`.
- *Coming from ReScript 11* → `rescript-12-migration`.
- *Example-based tests under Bun* → `rescript-bun-testing`.
- *Generated-input tests* → `rescript-property-testing`.
- *Formatter, warnings, reanalyze, CI gates* → `rescript-quality-tools`.
- *Servers, files, processes, and the Bun boundary* →
  `rescript-bun-runtime`.
- *React components and hooks* → `rescript-react`.
- *Proving a property for every input* →
  `rescript-deductive-verification`.

[docs/skill-catalogue-status.md](skill-catalogue-status.md) records which of
these are active.

## Testing hierarchy

Pick the first rung whose evidence matches the question:

0. **The type system**: make the illegal state unrepresentable. A test that
   re-checks an exhaustive `switch` adds nothing.
1. **Named example**: one scenario, regression, rendered output, or error
   variant matters.
2. **Case table**: a finite truth table whose rows each mean something.
   Iterate an array of named cases; the Bun bindings have no `test.each`.
3. **Lightweight property**: one round trip, invariant, or agreement between
   implementations over many cheap generated inputs.
4. **Model-based property**: failures depend on operation sequences or on
   structured, dependent inputs.

Leave the hierarchy for failures that depend on real services, processes,
schedules, or load; those need an integration test through a Bun adapter or a
benchmark.

Go beyond it when a property of a pure function must hold for every input and a
counterexample would be costly. `rescript-deductive-verification` proves
contracts against the compiled JavaScript; it needs Dafny 4.11 and Z3 on
`PATH`, and genType enabled in the project.

## Common pitfalls

- Following ReScript 11 advice: `Js.log`, `raise`, `Js.Exn.Error`,
  `bs-dependencies`, `rescript build -w`. All are deprecated or removed in 12.
- Opening `RescriptBun` globally through `compiler-flags`, as the
  `rescript-bun` README suggests. It makes every module depend on Bun.
- Trusting `Int.fromString` as validation; it accepts `"80abc"`.
- Throwing a ReScript exception at a JavaScript caller, which receives a
  plain object rather than an `Error`.
- Treating a reanalyze run that exits 0 as clean. It exits 0 with findings.
- Running a bare `bun test`: it skips compiled `*.test.res.mjs` suites and
  still passes. Name the suites explicitly.
- Matching `JsExn(_)` on `Promise.allSettled` rejection reasons: they are not
  wrapped. `try` and `Promise.catch` do wrap them.
- Building with `"in-source": false` while depending on ReScript packages that
  publish an `exports` map, such as Sury; the generated imports point into
  `lib/es6/` and fail at runtime.
- Expecting `@warning("-102")` to permit `==` on records under `+A`; warning
  102 can only be changed project-wide.
- Proving a model of ReScript code that assumes unbounded integers. ReScript
  `int` wraps at 32 bits, and such a model can certify code that overflows.
