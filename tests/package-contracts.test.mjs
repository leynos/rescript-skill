/**
Package and compiler-configuration contracts for the example workspace.

The skills teach a ReScript 12.3.1 posture: exact pins, a compiler and runtime
at the same version, namespaced sources, strict warnings, no global opens, and
Bun bindings visible only to dev sources. The repository that ships those
skills must hold itself to the same posture, or its examples would be verified
under a configuration the skills advise against. Each contract has a negative
control built by mutating the real configuration.
*/

import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO_ROOT } from "./support/catalogue.mjs";

const load = (name) => JSON.parse(readFileSync(join(REPO_ROOT, name), "utf8"));
const clone = (value) => structuredClone(value);

/** Asserts exact pins, a matched compiler and runtime, and a private package. */
export function packageContract(metadata) {
  const all = { ...metadata.dependencies, ...metadata.devDependencies };
  for (const [name, version] of Object.entries(all)) {
    assert.match(version, /^\d+\.\d+\.\d+$/, `${name} must be an exact pin`);
  }
  assert.equal(metadata.devDependencies.rescript, "12.3.1");
  assert.equal(
    metadata.devDependencies["@rescript/runtime"],
    metadata.devDependencies.rescript,
    "compiler and runtime versions must match",
  );
  assert.match(metadata.packageManager, /^bun@\d+\.\d+\.\d+$/);
  assert.equal(metadata.private, true);
  assert.equal(metadata.type, "module");
  assert.equal(metadata.license, "ISC");
}

/** Asserts the strict, namespaced, in-source ReScript configuration. */
export function rescriptContract(config) {
  assert.equal(config.name, "rescript-skill");
  assert.equal(config.namespace, true);
  assert.deepEqual(config.warnings, { number: "+A", error: "+A" });
  assert.deepEqual(config["compiler-flags"], [], "no global opens");
  for (const legacy of [
    "bs-dependencies",
    "bs-dev-dependencies",
    "bsc-flags",
  ]) {
    assert.equal(config[legacy], undefined, `${legacy} is a legacy key`);
  }
  assert.deepEqual(config.dependencies, [], "examples need no runtime deps");
  assert.ok(config["dev-dependencies"].includes("rescript-bun"));
  for (const source of config.sources) {
    assert.equal(source.type, "dev", `${source.dir} must be a dev source`);
  }
  assert.equal(config["package-specs"].module, "esmodule");
  assert.equal(
    config["package-specs"]["in-source"],
    true,
    "dependencies such as Sury export only their in-source output",
  );
  assert.deepEqual(config.reanalyze.analysis, ["dce", "exception"]);
  assert.deepEqual(config.reanalyze.suppress, []);
}

describe("package.json", () => {
  const metadata = load("package.json");

  test("satisfies the package contract", () => {
    packageContract(metadata);
  });

  test.each([
    ["a caret range", (m) => (m.devDependencies.rescript = "^12.3.1")],
    [
      "a mismatched runtime",
      (m) => (m.devDependencies["@rescript/runtime"] = "12.3.0"),
    ],
    ["an unpinned Bun", (m) => (m.packageManager = "bun@latest")],
    ["a publishable package", (m) => (m.private = false)],
  ])("rejects %s", (_, mutate) => {
    const mutated = clone(metadata);
    mutate(mutated);
    expect(() => packageContract(mutated)).toThrow();
  });
});

describe("rescript.json", () => {
  const config = load("rescript.json");

  test("satisfies the compiler contract", () => {
    rescriptContract(config);
  });

  test.each([
    ["a global Bun open", (c) => (c["compiler-flags"] = ["-open RescriptBun"])],
    ["a legacy dependency key", (c) => (c["bs-dependencies"] = [])],
    ["relaxed warnings", (c) => (c.warnings.error = "-A")],
    ["out-of-source output", (c) => (c["package-specs"]["in-source"] = false)],
    ["a production source", (c) => delete c.sources[0].type],
    ["a suppressed path", (c) => (c.reanalyze.suppress = ["skills"])],
  ])("rejects %s", (_, mutate) => {
    const mutated = clone(config);
    mutate(mutated);
    expect(() => rescriptContract(mutated)).toThrow();
  });
});
