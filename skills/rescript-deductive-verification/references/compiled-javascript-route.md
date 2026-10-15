# The compiled-JavaScript route

## Architecture

[LemmaScript](https://github.com/midspiral/LemmaScript) verifies ordinary
TypeScript annotated with `//@` comments. Its pipeline extracts the TypeScript
into an intermediate representation, then resolves, narrows, and transforms it,
and emits Dafny (the primary backend) or Lean 4. ReScript does not produce
TypeScript, but it produces nearly everything needed to build some:

| Need                 | Source                             |
| -------------------- | ---------------------------------- |
| Function bodies      | `Module.res.mjs`, the shipped code |
| Runtime type shapes  | `Module.gen.ts` from genType       |
| `int` versus `float` | `rescript-tools doc Module.res`    |
| Contracts            | `bsc -only-parse -dparsetree`      |

_Table 1: Where the bridge finds each input._

The bridge combines these into one TypeScript verification unit per module.
LemmaScript and Dafny prove it, and the correspondence audit shows the unit's
bodies are the compiled JavaScript.

## Project setup

`rescript.json` needs in-source output with the `.res.mjs` suffix (the bridge
looks for `Module.res.mjs` beside `Module.res`) and genType:

```json
{
  "package-specs": {"module": "esmodule", "in-source": true},
  "suffix": ".res.mjs",
  "gentypeconfig": {"language": "typescript", "generatedFileExtension": ".gen.ts"}
}
```

Ignore `*.gen.ts` and the output directory in Git; both are regenerated.

Dependencies:

- `typescript` (exact pin) for the bridge and audit, which use its parser,
  printer, and transpiler.
- `lemmascript` (exact pin, 0.6.4 here) in a **separate** package with its
  own lockfile. Its transitive graph carries advisories with no patched
  release, such as `braces` through `ts-morph`. Keeping it apart leaves the
  main dependency audit meaningful.
- Dafny 4.11 and Z3 4.12.1 on `PATH`. Dafny refuses to run without a Z3 it
  can find.

A gate in the style of this repository's `make prove`:

```make
prove:
	rescript build
	bun install --frozen-lockfile --cwd tools/verification
	rm -rf .verify
	bun res2ls-bridge.mjs src/Lease.res .verify
	bun res2ls-correspond.mjs src/Lease.res .verify
	bun tools/verification/node_modules/lemmascript/tools/dist/lsc.js \
	  check --backend=dafny .verify/Lease.ts
```

`lsc check` exits non-zero when any obligation fails, and so does the audit, so
the gate needs no output parsing.

## What the bridge does

The bridge only inserts text and applies two reversible rewrites:

- **Insertions:**
  - genType's type aliases;
  - parameter and return types from genType's signatures;
  - `//@ requires` and `//@ ensures` lines from the attributes, with
    `result` written as `\result`;
  - a verification-only prelude: `int32`, `isInt32`, and one
    `int32Typed_<type>` predicate per variant type with `int` fields.
- **Rewrite `e | 0` to `int32(e)`.** LemmaScript lowers `|` on numbers
  without int32 wrap-around, so the wrap becomes an explicit, modelled
  function. The equivalence is trusted and established by testing at the
  boundaries and on random safe integers.
- **Rewrite `x$1` to `x__1`.** The compiler names shadowed locals with `$`,
  which Dafny identifiers cannot contain. This is an alpha-renaming.

For every contracted function, it also adds typing contracts. It requires
`isInt32` or `int32Typed_*` of each parameter, which states ReScript's typing
guarantee, and it ensures the same of the result, which the prover then checks.

The bridge refuses to guess. It errors on:

- a contract on a value with no `@genType` signature;
- a contracted signature that contains an anonymous object type;
- a module whose values compile to aliases with no bodies;
- production code that uses a prelude name.

## The correspondence audit

The audit is what makes this verification of production code rather than of a
model. It passes only if:

1. the SHA-256 hashes in the manifest match the current `.res`, `.res.mjs`,
   and `.gen.ts`, and the unit itself was not edited after generation; and
2. erasing the unit's types with TypeScript's own transpiler, removing the
   prelude, and undoing both rewrites gives function declarations that print
   identically to the compiled `.res.mjs`. Every compiled function must be
   present; one without a genType signature is reported as unverified.

So the compiler and the bridge are both outside the trusted base for function
bodies. A compiler bug, a bridge bug, or a hand edit shows up as a mismatch.

## The trusted base

What a passing proof still assumes:

1. LemmaScript's translation from TypeScript to Dafny. Compiling the generated
   Dafny back to JavaScript (`dafny translate js`) and comparing it with the
   production function on generated inputs gives empirical evidence. In the
   spike behind this skill, they agreed on 200,000 inputs, and a mutant was
   caught on the first disagreement.
2. Dafny and Z3.
3. The `int32` model's equivalence with `| 0` on safe integers (tested).
4. ReScript typing: values reaching a proved function are well-typed, so
   `int` fields fit in int32. Untyped JavaScript callers can break this.
5. genType's types describe the runtime representation.
6. The contract extractor reads the compiler's debug printer (Printast). It is
   not a stable interface, but a format change makes extraction fail loudly
   rather than drop contracts.

## Reproducibility

With pinned versions of ReScript, Bun, TypeScript, LemmaScript, Dafny, and Z3,
regeneration is deterministic. Clean rebuilds produced byte-identical units and
Dafny in the spike. Regenerate from an empty output directory for each run, or
commit the `.dfy` when it carries handwritten proof additions: `lsc check`
merges new output into an existing `.dfy` three ways.

Proving the example's transition function takes about 3 seconds.

## Alternatives considered

- **A ReScript frontend emitting LemmaScript's intermediate representation.**
  The seam exists: serialized intermediate representation (IR) drives
  LemmaScript's back half without TypeScript, giving byte-identical Dafny. The
  blocker is types. `bsc -dtypedtree` prints only annotations written in the
  source, so a correct frontend must read binary `.cmt` files from OCaml linked
  against the exact compiler version, and must re-implement pattern-match
  compilation. It would also prove the source rather than the shipped
  JavaScript, missing constant folding and merged arms. Worth revisiting only
  if the compiled-JavaScript route's syntax limits bind.
- **An independently written model** in Dafny or Lean. It is quick to start,
  but proves the model. Without a refinement proof or a correspondence audit it
  says nothing about production; in the spike, such a model would have
  certified code that overflowed.
- **A direct ReScript-to-Dafny emitter.** This has the costs of the frontend
  plus an emitter to maintain, and reuses nothing.
