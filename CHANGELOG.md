# Changelog

All notable changes to this project are recorded in this file.

The format is based on [Common Changelog](https://common-changelog.org).

## [Unreleased]

### Added

- Bun-based repository scaffold: exact pins for ReScript 12.3.1 and
  `rescript-bun` 2.1.0, an out-of-source namespaced build, and sequential
  `make all` gates for formatting, compiler warnings as errors, reanalyze,
  Biome, Markdown, skill manifests, tests, and spelling.
- `scripts/check-codeblocks.mjs`: parses and formats every ReScript fence in
  Markdown without touching surrounding prose.
- `scripts/check-reanalyze.mjs`: fails the gate on any dead-code or exception
  finding from `rescript-tools reanalyze`.
- `rescript-router` skill with a routing matrix and a testing hierarchy.
- `rescript-errors-and-results` skill with executable `ConfigParsing` and
  `JsBoundary` examples.
