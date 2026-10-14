# Result pipelines

How to keep `result`-based code flat, typed, and composable across layers.

## One closed error variant per layer

Each module that can fail owns a variant naming its failures:

```rescript
type configError =
  | MissingKey(string)
  | InvalidHost(string)
  | InvalidPort(string)
```

A caller one layer up wraps the lower variant rather than flattening it into a
string:

```rescript
type startupError =
  | Config(ConfigParsing.configError)
  | Storage(Storage.error)

let start = env => env->ConfigParsing.fromEnv->Result.mapError(e => Config(e))
```

Use
[polymorphic variants](https://rescript-lang.org/docs/manual/polymorphic-variant)
for errors only when several unrelated modules must contribute cases to one
open set and you accept weaker exhaustiveness. A closed nominal variant is the
default.

## Sequencing: `let?` or `flatMap`

`let?` (experimental, `"experimental-features": {"LetUnwrap": true}`) reads
like straight-line code:

```rescript
let fromEnv = (env: dict<string>): result<config, configError> => {
  let? Ok(rawHost) = env->lookup("HOST")
  let? Ok(host) = parseHost(rawHost)
  let? Ok(rawPort) = env->lookup("PORT")
  let? Ok(port) = parsePort(rawPort)
  Ok({host, port})
}
```

It compiles to early `return`s with no closures or allocations beyond the
results themselves. The equivalent without the flag nests closures once a later
step needs an earlier value:

```rescript
let fromEnvWithFlatMap = env =>
  env
  ->lookup("HOST")
  ->Result.flatMap(parseHost)
  ->Result.flatMap(host =>
    env
    ->lookup("PORT")
    ->Result.flatMap(parsePort)
    ->Result.map(port => {host, port})
  )
```

Both are tested against each other in
[ConfigParsing.res](examples/ConfigParsing.res) and the suite
`tests/ErrorsAndResults.test.res`.

Choose `let?` in applications that already enable the feature. Choose `flatMap`
in libraries, in code shared with projects that do not enable it, and anywhere
a reviewer would otherwise have to learn an experimental feature to read one
function.

## Combining independent results

| Need                                      | Function                                                    |
| ----------------------------------------- | ----------------------------------------------------------- |
| all of an array, first error wins         | `Result.all(array)`                                         |
| a fixed tuple of differently typed values | `Result.all2` … `Result.all6`                               |
| the same for options                      | `Option.all`, `Option.all2` …                               |
| keep only successes                       | `Array.filterMap(r => r->Result.mapOr(None, v => Some(v)))` |
| collect every error, not just the first   | fold manually into `(oks, errors)`                          |

`Result.all` stops at the first `Error`. Form validation usually wants every
error; write the fold explicitly rather than calling `Result.all` and losing
the rest.

## Async results

ReScript 12 added helpers for `promise<result<'a, 'e>>`:

- `Result.mapOkAsync`, `Result.mapErrorAsync`
- `Result.flatMapOkAsync`, `Result.flatMapErrorAsync`

They thread a promise of a result through async steps without unwrapping by
hand. Inside an `async` function, `await` plus `switch` is usually clearer.
Rejections are a separate channel; see `rescript-async`.

## Extracting values at the edge

- `Result.getOr(default)` when a fallback is genuinely correct.
- `Result.mapOr(default, f)` to transform and default in one step.
- `switch` when both branches do real work. This is the common case at an
  HTTP handler or CLI entry point.
- `Result.getOrThrow(~message=...)` only in tests or after a check the type
  system cannot see. It throws a JavaScript `Error`.

## Testing failure paths

Assert on the variant, not the rendered message:

```rescript
expect(ConfigParsing.parsePort("80abc"))->Expect.toEqual(Error(ConfigParsing.InvalidPort("80abc")))
```

Test `describe`-style rendering once, separately. When two pipelines must
agree, as the `let?` and `flatMap` versions do, run both over the same cases or
hand the relation to a property test (`rescript-property-testing`).
