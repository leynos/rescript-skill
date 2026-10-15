# Suite layout and the runner

## Configuration

```json
{
  "name": "my-app",
  "namespace": true,
  "sources": [
    {"dir": "src", "subdirs": true},
    {"dir": "tests", "type": "dev"}
  ],
  "dev-dependencies": ["rescript-bun"],
  "package-specs": {"module": "esmodule", "in-source": true},
  "suffix": ".res.mjs"
}
```

Install the bindings as a development dependency (`bun add -d rescript-bun`)
and, when only tests use them, list them only under `dev-dependencies`.
Production sources then cannot reach `RescriptBun` at all: the compiler refuses
to resolve it outside dev sources. A package that also runs on Bun (an adapter;
see `rescript-bun-runtime`) needs `rescript-bun` in `dependencies` instead;
keep that package separate from a portable core. The `rescript-bun` README
recommends `bsc-flags` with `-open RescriptBun`; that key is deprecated and the
global open makes every module Bun-dependent, so do not follow it.

Open the test module locally:

```rescript
open RescriptBun.Test

describe("Parser", () => {
  test("accepts an empty document", () => {
    expect(Parser.parse(""))->Expect.toEqual(Ok([]))
  })
})
```

## Naming

Name suites after the module they exercise, `Parser.test.res`. With
`"namespace": true` this compiles as a separate module and can refer to
`Parser`. Without a namespace, the build reports "The module or file Parser
can't be found". Module names are global, so two suites cannot share a name
even in different directories.

## Making sure suites run

Bun discovers test files by name pattern, and `Parser.test.res.mjs` does not
match. Running `bun test` with no arguments in such a project runs the
JavaScript suites and none of the ReScript ones, and still exits 0.

Name the compiled files explicitly, derived from the sources:

```make
RES_SUITES = $(patsubst %.res,%.res.mjs,$(wildcard tests/*.test.res))
JS_SUITES = $(wildcard tests/*.test.mjs)

test:
	bun run --bun rescript build
	bun test $(addprefix ./,$(RES_SUITES)) $(addprefix ./,$(JS_SUITES))
```

Deriving from `.res` sources rather than globbing `.res.mjs` output means a
clean checkout cannot silently match nothing, and a suite whose compilation was
skipped fails with "had no matches".

A contract test can assert that the dry run of `make test` names every
`tests/*.test.res`; this repository's `tests/makefile-contracts.test.mjs` does
exactly that.

## Coverage

```toml
[test]
coveragePathIgnorePatterns = ["tests/**"]
```

`bun test --coverage --coverage-reporter=text --coverage-reporter=lcov`
measures the generated `.res.mjs`. Line numbers refer to JavaScript, and
inlined helpers move coverage around, so treat it as a map of untested modules
rather than a target.

## Snapshots

`Expect.toMatchSnapshot` writes beside the compiled suite:
`tests/__snapshots__/Parser.test.res.mjs.snap`. Commit snapshot files, review
their diffs like source, and keep snapshots small. A snapshot of a whole data
structure usually hides the one field the test is about; prefer `toEqual` on
that field.

## Test-only bindings

Bindings that exist only for tests (mocks, clock reset, fixtures) belong in a
dev source. In a library, keep them under `tests/`; in this catalogue they live
under each skill's `references/examples/` so they can be read.
