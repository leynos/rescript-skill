---
name: rescript-deductive-verification
description: Use for proving properties of production ReScript 12 code rather than testing samples — contracts as @requires and @ensures attributes, the compiled-JavaScript route through genType and LemmaScript to Dafny, correspondence audits that tie the proof to the shipped code, int32 semantics, non-vacuity checks, and which properties need runtime conformance tests instead.
metadata:
  globs: "**/*.res, **/*.resi, **/rescript.json"
---

# ReScript deductive verification

Use this when a property of ReScript code must hold for every input, not just
the ones a test samples: resource ownership, money, permissions, terminal
states. For sampled evidence, use `rescript-property-testing`; for making a
state unrepresentable, use `rescript-types-and-modules` first.

## Working stance

- Prove the code that ships. The recommended route verifies the compiler's
  `.res.mjs` output, with an audit showing the verified unit *is* that
  JavaScript. Never substitute an independently written model unless an
  explicit refinement or correspondence argument connects it to production.
- Prove a small pure core; test the effectful shell. Transition functions,
  validators, and allocators are provable. `await`, timers, abort delivery, and
  I/O are not, and get conformance tests.
- Attach contracts to the ReScript declaration they describe, so they move
  with the code and the audit can find them.
- Earn the proof. Rung 0 of the testing hierarchy (types) comes first; prove
  only where a counterexample would be expensive and tests cannot cover the
  input space.
- Name every assumption. ReScript typing, the `int32` model, and the runtime
  environment are trusted; each one is stated in the unit or tested.
- A proof that cannot fail proves nothing. Mutate the source and watch the
  intended contract fail before trusting it.

## The route

For screen readers: the diagram shows `bsc` compiling `Module.res` to
`Module.res.mjs` and genType emitting `Module.gen.ts`. The bridge combines
both, with the contracts, into `Module.ts`, which `lsc` turns into Dafny, while
the audit checks the unit against the production JavaScript.

```plaintext
Module.res ── bsc ──> Module.res.mjs ─┐
   │ @requires/@ensures               ├─ res2ls-bridge ─> Module.ts ─ lsc ─> Dafny
   └── genType ──> Module.gen.ts ─────┘        │
                                               └─ res2ls-correspond: unit == production
```

*Figure 1: The compiled-JavaScript verification route.*

1. Shape the code: a pure function over `@genType` types, variants with
   `@tag` and a record payload on every constructor.
2. Write contracts as attributes in LemmaScript's specification language.
3. Build, then bridge, audit, and prove (below).
4. Kill a mutant per contract to show the contracts are not vacuous.
5. Pin the boundaries the proof found as named runtime examples.

```bash
bun res2ls-bridge.mjs src/Lease.res out
bun res2ls-correspond.mjs src/Lease.res out
lsc check --backend=dafny out/Lease.ts
```

## What it can prove

| Property                    | Example contract                                                              | Evidence |
| --------------------------- | ----------------------------------------------------------------------------- | -------- |
| Pure transition correctness | `result.kind === 'ok' ==> generationOf(result.state) === generationOf(state)` | proof    |
| Invariant preservation      | `@requires("wellFormed(state)")` with the same `@ensures`                     | proof    |
| Authorization               | `!isOwner(state, event.by) ==> result.kind === 'error'`                       | proof    |
| Error-cause preservation    | `result.failure.cause === state.cause`                                        | proof    |
| Terminal-state safety       | `state.kind === 'released' ==> result.kind === 'error'`                       | proof    |
| Freedom from int32 overflow | follows from the typing predicates the bridge adds                            | proof    |
| Abort, timeout, rejection   | none: depends on the scheduler and the platform                               | test     |
| Stack depth of recursion    | none: the prover assumes an unbounded stack                                   | test     |
| `float` arithmetic          | none: modelled as exact reals                                                 | test     |

*Table 1: Properties the route proves, and those left to tests.*

## Rules that surprise people

- ReScript `int` wraps at 32 bits and the compiler emits `e | 0`. LemmaScript
  alone treats numbers as unbounded; the bridge rewrites `e | 0` to a modelled
  `int32(e)`. An unbounded model would have "proved" the overflow the example's
  proof caught.
- genType maps `int` and `float` alike to `number`. The bridge reads ReScript
  types from `rescript-tools doc` to add the int32 typing preconditions.
- Contracts are strings. The compiler accepts them under `+A` and never
  checks them; mistakes surface when `lsc` parses them.
- A constant constructor (`| Idle`) compiles to a bare string beside objects,
  and the `typeof` test it needs is not modelled. Give every constructor a
  record payload.
- The proof covers what the compiler emitted, including constant folding and
  merged match arms. That is the point; a source-level model would miss them.
- `===` between records in a contract means structural equality. Contracts are
  never executed, so this is the intended reading.
- `rescript-tools doc` only works inside a built project. Build first.
- `lsc check` merges into an existing `.dfy`. Regenerate from a clean output
  directory unless proof additions are committed.

## Red flags

- A handwritten Dafny, Lean, or TypeScript model of a ReScript function, with
  no audit tying it to the compiled code.
- A contract that no mutant of the source can break.
- An edited verification unit; regenerate it instead.
- A correspondence mismatch explained away rather than fixed.
- A claim that cancellation, timeouts, or scheduling were "proved".
- Proving code that uses `float`, `list`, or runtime-library helpers without
  saying how they were modelled.

## References

- [compiled-javascript-route.md](references/compiled-javascript-route.md):
  the architecture, project setup, the correspondence audit, the trusted base,
  reproducibility, and why not a source frontend or a separate model.
- [contracts-and-properties.md](references/contracts-and-properties.md):
  writing contracts, designing types for proof, the property classes, typing
  predicates, mutants, and splitting proof from conformance tests.
- [limitations-and-gotchas.md](references/limitations-and-gotchas.md): the
  supported ReScript surface, semantic gaps, environmental properties, and
  maintenance costs.
- Executable example:
  [VerifiedLease.res](references/examples/VerifiedLease.res), proved by
  `make prove` in this repository.
- Bridge and audit, as this repository runs them:
  [res2ls-bridge.mjs](references/examples/res2ls-bridge.mjs) and
  [res2ls-correspond.mjs](references/examples/res2ls-correspond.mjs).
