# ReScript skill catalogue design

- **Status:** Living document, describing the implemented catalogue.
- **Scope:** The catalogue's structure, its evidence policy, the build and
  gate decisions behind it, and the verification route.
- **Audience:** Maintainers and reviewers of this repository.
- **Precedence:** [AGENTS.md](../AGENTS.md) holds the binding rules for
  changes; [verified facts](research/verified-facts.md) is the source of truth
  for toolchain behaviour. This document explains why both take the shape they
  do.

## 1. Problem

Coding agents write ReScript from memory, and most of what they remember is
ReScript 11 or older. ReScript 12 renamed much of the error and
standard-library surface, deprecated `Js.*` and `raise`, replaced the build
system, and moved configuration keys. Advice that was right two years ago now
fails a strict build. Prose guidance alone does not fix this: a skill that
states an API from memory has the same defect as the agent reading it.

The catalogue therefore has two jobs: route an agent to the smallest body of
guidance that answers its question, and make every behavioural claim in that
guidance checkable against the pinned toolchain.

## 2. Constraints

These are assumed by later sections rather than re-justified:

1. **Target one toolchain.** ReScript 12.3.1 with its bundled standard
   library, Bun 1.4.3 as runner and test framework, and `rescript-bun` 2.1.0.
2. **Evidence over recollection.** A claim about compiler or runtime
   behaviour is backed by an executable example, a contract test, or a recorded
   experiment.
3. **Agent Skills manifests.** Each skill is a directory whose `SKILL.md`
   frontmatter satisfies the Agent Skills schema, as validated by `skills-ref`.
4. **Small entry points.** `SKILL.md` stays within 160 lines; long material
   moves into linked references, loaded only when needed.
5. **Strict compilation.** Every example compiles with all warnings as errors
   and passes reanalyze's dead-code and exception analyses.

## 3. Catalogue architecture

### 3.1. Router and skills

`rescript-router` is the only implicitly invocable skill. It maps a question to
one language skill and at most one domain or quality skill, and carries the
testing hierarchy that decides between types, examples, tables, properties, and
proofs. Every other skill sets `allow_implicit_invocation: false`, so the
router keeps the routing decision and an agent never loads half the catalogue
at once.

Skills fall into five groups: language (types and modules, errors and results,
interop, async, standard library and data); build and quality (configuration,
migration, quality tools); testing (Bun testing, property testing); runtime and
UI (Bun runtime, React); and verification (deductive verification).
[The catalogue status](skill-catalogue-status.md) lists them.

### 3.2. Progressive disclosure

A skill body states a working stance, a decision surface, the rules that
surprise people, and red flags. Comparison tables and worked examples live in
`references/`, linked from the body, so the agent pays for detail only when the
question needs it.

### 3.3. Evidence model

For screen readers: the diagram shows a claim in a skill backed by one of three
kinds of evidence, each re-checked by a gate.

```plaintext
claim in SKILL.md or a reference
  ├── executable example (references/examples/*.res) ── suite in tests/ ── make test
  ├── fenced ReScript in Markdown ───────────────────── fence gate ─────── make check-fmt
  └── recorded experiment (docs/research/verified-facts.md)
        └── where possible, promoted to a contract test ────────────────── make test
```

_Figure 1: How a claim in the catalogue is backed and re-checked._

The contract suites enforce the links between these: every example is linked
from prose and exercised by a suite, every reference is linked from its skill,
and every skill is reachable from the router.

## 4. Build decisions

### 4.1. One namespaced project of dev sources

`rescript.json` declares one project with two dev sources, `skills`
(recursively) and `tests`. Nothing is published, and the examples need dev-only
bindings such as `rescript-bun`. The namespace exists because, without it, a
suite named `Foo.test.res` cannot refer to a module `Foo`.

### 4.2. In-source output

Output is ES modules written beside each source as `Foo.res.mjs`. This is
forced, not chosen: a consumer's `package-specs` also govern how it imports its
dependencies. With `"in-source": false`, the compiler emits
`sury/lib/es6/src/S.res.mjs`, which Sury's `exports` map does not admit.
Generated files are ignored by Git, and `make install-skills` copies only
committed files.

### 4.3. Strict warnings

Warnings are `+A` with `error: +A`, which makes warnings 4, 9, 41, and 102
errors as well as the defaults. The examples therefore demonstrate code that
survives the strictest posture a project is likely to adopt. `LetUnwrap` is
enabled because `rescript-errors-and-results` teaches `let?`.

## 5. Gates

`make all` runs formatting, lint, tests, and spelling sequentially. Two gate
scripts live inside `rescript-quality-tools`, so the repository runs exactly
what the skill ships:

- the fence gate parses and formats every ReScript fence through
  `rescript format --stdin`, because `rescript-tools format-codeblocks`
  rewrites whole Markdown files and exits 0 on syntax errors;
- the reanalyze gate fails on any finding, because `rescript-tools reanalyze`
  exits 0 when it reports dead code or unhandled exceptions.

The spelling gate reads only files Git tracks, which is why new files are
staged before gating.

## 6. Verification route

`rescript-deductive-verification` recommends proving the compiled JavaScript
rather than a model of the source. The design and its evidence are in
[the skill's route reference](../skills/rescript-deductive-verification/references/compiled-javascript-route.md).
Three repository decisions follow from it:

- `make prove` is separate from `make all` and from continuous integration,
  because Dafny and Z3 are system tools;
- LemmaScript lives in `tools/verification/` with its own lockfile, because its
  transitive graph carries advisories with no patched release;
- genType is enabled for the whole project, because the bridge reads its
  output.

## 7. Rejected alternatives

| Alternative                                          | Reason rejected                                                                           |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Prose-only skills                                    | Unverifiable; repeats the defect the catalogue exists to fix.                             |
| `@rescript/core` and `Belt` as the baseline          | Superseded by the ReScript 12 standard library.                                           |
| Out-of-source build output                           | Breaks imports of packages that publish an `exports` map.                                 |
| `rescript-tools format-codeblocks` as the fence gate | Reprints whole documents and exits 0 on syntax errors.                                    |
| Proof against an independent model                   | Proves the model, not production; it would have certified an int32 overflow in the spike. |
| Running `make prove` in `make all`                   | Would make every contributor install Dafny and Z3 to change unrelated skills.             |

_Table 1: Alternatives considered and why they were rejected._

## 8. Risks and evolution

- **Version drift.** The catalogue is pinned material. ReScript 12.4 or 13, a
  `rescript-bun` major release, or `LetUnwrap` leaving experimental status each
  require re-running `make all` and revising the affected skills.
- **Unchecked proofs.** Because `make prove` runs only locally, a change can
  break a proof without failing CI. The developers' guide names the changes
  that oblige a contributor to run it.
- **Open questions.** DOM-based React tests, mutation testing, loop invariants
  and runtime-library externs for verification, and a native ReScript
  verification frontend are tracked in
  [the catalogue status](skill-catalogue-status.md).
