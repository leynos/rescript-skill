/**
@file Evidence for `rescript-12-migration`: what `rescript-tools migrate` rewrites.

The skill tells readers to build with deprecations as warnings, run the
migration tool, and then fix what it leaves behind by hand. This suite runs the
real 12.3.1 tool over a ReScript 11-style module in a scratch project and pins
each claim: the rewrites it performs, the deprecated calls it leaves alone,
and its refusal to run before the project has been built.
*/

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "./support/catalogue.mjs";

const LEGACY = `exception Boom(string)
let log = () => Js.log("hello")
let fail = () => raise(Boom("x"))
let parse = s => Js.Json.parseExn(s)
let opt = o => o->Option.getExn
let caught = f =>
  try f() catch {
  | Js.Exn.Error(e) => Js.Exn.message(e)
  }
let shifted = x => lsl(x, 2)
let bool = Bool.fromStringExn("true")
`;

let project;

function run(args) {
  const result = Bun.spawnSync([process.execPath, "run", "--bun", ...args], {
    cwd: project,
  });
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

beforeAll(() => {
  project = mkdtempSync(join(tmpdir(), "rescript-skill-migrate-"));
  mkdirSync(join(project, "src"));
  symlinkSync(join(REPO_ROOT, "node_modules"), join(project, "node_modules"));
  writeFileSync(
    join(project, "package.json"),
    JSON.stringify({ name: "legacy", private: true, type: "module" }),
  );
  // Deprecation warnings must stay warnings, or the build that the migration
  // tool depends on fails first.
  writeFileSync(
    join(project, "rescript.json"),
    JSON.stringify({
      name: "legacy",
      sources: ["src"],
      "package-specs": { module: "esmodule", "in-source": true },
      suffix: ".res.mjs",
    }),
  );
  writeFileSync(join(project, "src", "Legacy.res"), LEGACY);
});

afterAll(() => {
  rmSync(project, { recursive: true, force: true });
});

describe("rescript-tools migrate", () => {
  test("refuses to run before the project is built", () => {
    const result = run([
      "rescript-tools",
      "migrate",
      "src/Legacy.res",
      "--stdout",
    ]);
    expect(result.stderr + result.stdout).toContain(
      "build artifacts could not be found",
    );
  });

  test("rewrites deprecated calls once the project builds", () => {
    expect(run(["rescript", "build"]).exitCode).toBe(0);
    const migrated = run([
      "rescript-tools",
      "migrate",
      "src/Legacy.res",
      "--stdout",
    ]).stdout;
    expect(migrated).toContain('Console.log("hello")');
    expect(migrated).toContain('throw(Boom("x"))');
    expect(migrated).toContain("JSON.parseOrThrow(s)");
    expect(migrated).toContain("o->Option.getOrThrow");
    expect(migrated).toContain("| JsExn(e) => JsExn.message(e)");
    expect(migrated).toContain('Bool.fromStringOrThrow("true")');
  });

  test("leaves deprecated bitwise functions for a manual fix", () => {
    // Build here too, so this test does not depend on the one above.
    expect(run(["rescript", "build"]).exitCode).toBe(0);
    const migrated = run([
      "rescript-tools",
      "migrate",
      "src/Legacy.res",
      "--stdout",
    ]).stdout;
    expect(migrated).toContain("lsl(x, 2)");
    const build = run(["rescript", "build"]);
    expect(build.stdout + build.stderr).toContain(
      "Use `Int.shiftLeft` instead",
    );
  });
});
