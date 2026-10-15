# Contracts and properties

## Writing contracts

A contract is an attribute on a top-level `let` that genType exports:

```rescript
@genType
@requires("wellFormed(state)")
@ensures("result.kind === 'ok' ==> wellFormed(result.state)")
@ensures("state.kind === 'released' ==> result.kind === 'error'")
let step = (state: state, event: event): outcome => transition(state, event)
```

- **Language.** The string is LemmaScript's specification language, written
  against the JavaScript shape of the values:
  - `===`, `!==`, `<`, `<=`, `&&`, `||`, `!`, arithmetic;
  - `==>` for implication;
  - `forall(k: nat, P)` and `exists(k: nat, P)`;
  - field access, `.length`, and calls to pure functions.
- **`result`** names the return value; the bridge writes it as `\result`. A
  parameter called `result` would be ambiguous, so do not use that name.
- **String literals** go in single quotes inside the ReScript string:
  `'released'`. Match the `@as` names, not the constructor names.
- **One property per attribute.** Several `@ensures` conjoin, and Dafny
  reports each failure separately, so a failing proof names the property.
- **Guard field access by tag.** `event.by` exists only on some
  constructors, so write `event.kind !== 'acquire' && ... event.by`.
- **Predicates named in contracts** must be pure, `@genType`-exported
  functions whose bodies are `switch`/`if` and `return`, such as `wellFormed`
  and `isOwner`. They then become Dafny functions usable in specifications.
- **Not compile-time checked.** The compiler accepts any string under
  `+A`. A typo in a field name surfaces when `lsc` resolves the contract.

## Designing types for proof

The compiled shape decides what the verifier can model:

- `@tag("kind")` with `@as("...")` names on a variant gives
  `{kind: "held", ...}` objects that become a Dafny datatype. Without `@tag`,
  the discriminant is `TAG`, which also works.
- Give **every** constructor a record payload. A constant constructor such
  as `| Idle` compiles to a bare string beside the objects, and the compiled
  `typeof x !== "object"` test is outside the verifiable subset.
- Prefer `int` to `float`. Integers are modelled exactly, with int32
  wrap-around; floats become exact reals with no rounding or `NaN`.
- Keep proved functions free of `list`, `Belt`, and other runtime-library
  calls. Those compile to imports with no body to verify.
- Keep the proved function in a module of its own, or at least give
  `@genType` signatures to everything it calls, so the audit can account for
  every compiled function.

## Property classes

The example [VerifiedLease.res](examples/VerifiedLease.res) proves one of each:

| Class                        | Contract on `step`                                                                  | Mutant that breaks it               |
| ---------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------- |
| Pure transition              | `result.kind === 'ok' ==> generationOf(result.state) === generationOf(state)`       | acquire bumps the generation        |
| Resource-ownership invariant | `wellFormed` preserved, given `wellFormed` on entry                                 | the handle bound made unreachable   |
| Authorization                | `event.kind !== 'acquire' && !isOwner(state, event.by) ==> result.kind === 'error'` | non-owner may close                 |
| Error-cause preservation     | release keeps `event.cause`; a refusal after release carries `state.cause`          | release drops or replaces the cause |
| Release-state safety         | `state.kind === 'released' ==> result.kind === 'error'`                             | a released lease reopens            |

The first proof attempt on this module failed, correctly. `Open` computed
`handles + 1 | 0`, which wraps from 2147483647 to -2147483648, so a held lease
could reach a negative handle count. The fix was a bound in the production
source (`maxHandles`), not a weaker contract.

## Typing predicates

For each contracted function, the bridge adds:

- `requires isInt32(p)` for each `int` parameter, and
  `requires int32Typed_T(p)` for each parameter whose variant type has `int`
  fields, directly or nested;
- the same predicate of `\result` as an `ensures`.

The `requires` is the trusted ReScript typing guarantee; without it, the prover
would consider an `int` field holding 2⁴⁰ and report spurious overflows. The
`ensures` is checked: the function must return well-typed values, so arithmetic
that leaves int32 range shows up as a failed proof rather than an assumption.

## Proving the contracts are not vacuous

A contract can verify because it says nothing, or because a `@requires` is
unsatisfiable. Mutation is the check. For each contract:

1. copy the module and break the one behaviour the contract describes;
2. build, bridge, and prove the copy;
3. confirm the proof fails, and fails on that contract.

Six mutants of the example each failed on exactly their intended postcondition.
A surviving mutant means a missing or vacuous contract, or a mutant that
changed nothing observable. Read the compiled JavaScript before blaming the
contract: one early mutant's arithmetic was folded at compile time into a guard
that refuses every call, which satisfies the invariant.

## Proof versus conformance tests

LemmaScript cannot model `await`, so asynchronous behaviour stays outside the
proof. Structure the code so the proof carries the logic and the tests only
show that the shell uses it:

```rescript
let run = async (signal, ~owner, work) => {
  let state = ref(Idle({generation: 0}))
  let apply = event =>
    switch step(state.contents, event) {
    | Ok({state: next}) => state := next
    | Error(_) => ()
    }
  apply(Acquire({owner: owner}))
  onAbort(signal, () => apply(Release({by: owner, cause: Timeout({afterMs: 0})})))
  await work()
  apply(Release({by: owner, cause: Normal({code: 0})}))
}
```

Here, "late steps after an abort are refused and keep the timeout cause" is the
proved release-state safety of `step`. "Abort during `work` releases the lease"
depends on abort delivery and listener timing, so a test with a real
`AbortController` covers it. So do "a rejection's message reaches the cause",
which depends on rejection propagation and `JsExn` wrapping, and "recursion
completes", which depends on stack depth.

## Pinning what the proof found

Keep named runtime examples for the boundaries a proof exposed, as
`tests/DeductiveVerification.test.res` does for `maxHandles`. They run where
Dafny is not installed, and they document the reason for the guard.
