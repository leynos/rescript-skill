# Agent instructions

Guidance for agents working in this repository. Read this before changing
tracked files.

## Commit gates

Use the public Make targets and run them sequentially, never in parallel: the
ReScript build output and the uv tool cache are shared, and sequential runs
benefit from incremental compilation.

```bash
make install
make all
```

`make all` runs `check-fmt`, `lint`, `test`, and `spelling` in order and stops
at the first failure, even under `make -j`. `make check` is an alias. Run the
full sequence before every commit.

Stage new files (`git add`) before running the gates. The spelling gate reads
only files Git tracks, so an unstaged new skill would pass it unchecked.

## Changes under `skills/`

Every skill is a directory containing a `SKILL.md` whose YAML frontmatter is an
Agent Skills manifest. The manifest `name` is the discovery name.

- Keep the directory name equal to the manifest `name`.
- Keep the frontmatter to `name`, `description`, `license`, `allowed-tools`,
  `metadata`, and `compatibility`. Put anything else under `metadata`.
- Keep `metadata` a mapping of strings to strings, with a comma-separated
  `globs` hint. `skills-ref` coerces other shapes with `str(v)` rather than
  rejecting them.
- Ship `agents/openai.yaml` with `policy.allow_implicit_invocation: false`
  for every skill except `rescript-router`, so the router keeps the routing
  decision.
- Name every new skill in the router, in
  `skills/rescript-router/references/routing-matrix.md`, and in
  `docs/skill-catalogue-status.md`. The contract suite enforces all three.
- Keep `SKILL.md` within 160 lines. Push comparison tables and worked
  examples into `references/`, and link every reference from the skill.

Do not weaken a check to make a skill pass. Fix the skill instead.

To check one skill while iterating:

```bash
make skill-manifest-check SKILL_DIRS=skills/rescript-router/
```

## Executable examples

Claims about compiler or runtime behaviour must be evidenced, not remembered.

- Put complete, compilable ReScript under
  `skills/<skill>/references/examples/`. Module names are global within the
  project, so give each file a distinctive name.
- Link every example from its skill's Markdown and exercise every example
  module from a suite in `tests/*.test.res`. The contract suite enforces both.
- Examples compile with warnings `+A` as errors and must pass reanalyze's
  dead-code and exception analysis. Annotate a deliberate case with `@live` or
  `@throws(...)`; never add a path to the `reanalyze.suppress` list.
- Every `rescript`, `res`, and `resi` fence in Markdown must parse and be
  canonically formatted; `make fmt` rewrites fence bodies only. Use a `text`
  fence for code that is deliberately invalid.
- Compiler output goes to `lib/es6/` and is never committed. The `skills/`
  tree stays free of generated JavaScript so it can be copied as is.

## ReScript boundary

- Use the ReScript 12 standard library. Do not add `@rescript/core`, and do
  not use the deprecated `Js.*` modules or `raise` in examples.
- Keep `rescript-bun` and other bindings in ReScript `dev-dependencies`.
  Never open a namespace globally through `compiler-flags`; open
  `RescriptBun.Test` locally in suites.
- No `Obj.magic` or `%raw` outside a narrow, commented binding in an example
  that teaches exactly that boundary.

## Documentation and prose

- Changes that alter skill discovery, installation, or naming belong in
  [the users' guide](docs/users-guide.md). Changes to gates, scripts,
  dependencies, or tests belong in
  [the developers' guide](docs/developers-guide.md).
- Record notable changes in [the changelog](CHANGELOG.md), which follows
  Common Changelog.
- Write en-GB-oxendict prose (`-ize`, `-our`), wrapped at 80 columns, with
  sentence-case headings, dash bullets, and language-labelled fences.
- `make spelling` regenerates `typos.toml` from the shared dictionary and
  `typos.local.toml`. Never edit `typos.toml` by hand; add narrow exceptions to
  `typos.local.toml`.
- Make atomic commits with imperative subjects and reasons in the body.
