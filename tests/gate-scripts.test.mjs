/**
@file Behavioural tests for the repository's own gate scripts.

The fence gate must reject unparsable and unformatted ReScript fences while
leaving every byte of surrounding prose alone, which is exactly what
`rescript-tools format-codeblocks` fails to do. `reanalyze` exits 0 when it
reports dead code or an unannotated exception, so its wrapper is the only thing
standing between those findings and a green gate. These tests drive both
scripts with fixtures that must fail as well as fixtures that must pass; a
script that always exited 0 would pass the real repository and fail here.
*/

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  checkDocument,
  extensionFor,
  findFences,
  runFormatter,
} from "../skills/rescript-quality-tools/references/examples/check-codeblocks.mjs";
import {
  gate,
  describe as render,
  parseFindings,
} from "../skills/rescript-quality-tools/references/examples/check-reanalyze.mjs";
import { REPO_ROOT } from "./support/catalogue.mjs";

const FENCE = "```";

/**
 * Runs check-codeblocks.mjs in `mode` on a temporary Markdown file holding
 * `body`, and returns its exit code, stderr, and the file's final text.
 */
function runCodeblocks(mode, body) {
  const directory = mkdtempSync(join(tmpdir(), "rescript-skill-fences-"));
  try {
    const path = join(directory, "doc.md");
    writeFileSync(path, body);
    const result = Bun.spawnSync(
      [
        process.execPath,
        "skills/rescript-quality-tools/references/examples/check-codeblocks.mjs",
        mode,
        path,
      ],
      { cwd: REPO_ROOT },
    );
    return {
      exitCode: result.exitCode,
      stderr: result.stderr.toString(),
      after: readFileSync(path, "utf8"),
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("check-codeblocks", () => {
  const canonical = `# Doc\n\n${FENCE}rescript\nlet x = 1 + 1\n${FENCE}\n`;
  const unformatted = `# Doc\n\n${FENCE}rescript\nlet   x=1+1\n${FENCE}\n`;
  const broken = `# Doc\n\n${FENCE}rescript\nlet x = (1 +\n${FENCE}\n`;

  test("accepts canonical fences", () => {
    expect(runCodeblocks("--check", canonical).exitCode).toBe(0);
  });

  test("rejects unformatted fences without rewriting them", () => {
    const result = runCodeblocks("--check", unformatted);
    expect(result.exitCode).toBe(1);
    expect(result.after).toBe(unformatted);
  });

  test("write mode reformats unformatted fences", () => {
    const result = runCodeblocks("--write", unformatted);
    expect(result.exitCode).toBe(0);
    expect(result.after).toBe(canonical);
  });

  test("rejects a fence with a syntax error in either mode", () => {
    for (const mode of ["--check", "--write"]) {
      const result = runCodeblocks(mode, broken);
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Syntax error");
    }
  });

  test("write mode leaves prose, tables, and frontmatter byte for byte", () => {
    const prose = [
      "---",
      'globs: "**/*.res"',
      "---",
      "",
      "| a | `b \\| c` |",
      "| - | - |",
      "",
      "`result`-based *emphasis*.",
      "",
    ].join("\n");
    const result = runCodeblocks("--write", `${prose}\n${unformatted}`);
    expect(result.after).toBe(`${prose}\n${canonical}`);
  });

  test("formats fences nested in list items at their indentation", () => {
    const nested = `- item\n\n  ${FENCE}res\n  let   y=2\n  ${FENCE}\n`;
    const result = runCodeblocks("--write", nested);
    expect(result.after).toBe(
      `- item\n\n  ${FENCE}res\n  let y = 2\n  ${FENCE}\n`,
    );
  });

  test("checks interface fences as interfaces", () => {
    const iface = `${FENCE}resi\nlet   x: int\n${FENCE}\n`;
    expect(runCodeblocks("--write", iface).after).toBe(
      `${FENCE}resi\nlet x: int\n${FENCE}\n`,
    );
  });

  test("ignores fences in other languages", () => {
    const other = `${FENCE}js\nlet   x=1\n${FENCE}\n${FENCE}text\nlet x = (\n${FENCE}\n`;
    expect(runCodeblocks("--check", other).exitCode).toBe(0);
  });

  test("findFences reports info strings and line spans", () => {
    const fences = findFences(`a\n${FENCE}res prelude\nx\n${FENCE}\nb\n`);
    expect(fences).toEqual([
      { info: "res prelude", indent: "", start: 1, end: 3, body: "x" },
    ]);
  });

  test("extensionFor selects the formatter mode", () => {
    expect(extensionFor("rescript")).toBe(".res");
    expect(extensionFor("res example")).toBe(".res");
    expect(extensionFor("resi")).toBe(".resi");
    expect(extensionFor("reason")).toBeNull();
    expect(extensionFor("json")).toBeNull();
  });

  test("checkDocument reports an unterminated fence as broken", () => {
    const verdict = checkDocument(
      "d.md",
      `${FENCE}rescript\nlet x = 1\n`,
      () => {
        throw new Error("must not format an unterminated fence");
      },
    );
    expect(verdict.problems.map((problem) => problem.kind)).toEqual(["broken"]);
  });
});

describe("the formatter runner", () => {
  test("passes input through a formatter that succeeds", () => {
    expect(runFormatter(["cat"], "let x = 1\n")).toEqual({
      ok: true,
      output: "let x = 1\n",
      error: "",
    });
  });

  test("reports a formatter that outlives its timeout", () => {
    const result = runFormatter(["sleep", "5"], "", 200);
    expect(result.ok).toBe(false);
    expect(result.error).toBe("formatter timed out after 200 ms");
  });

  test("reports a formatter that cannot start", () => {
    const result = runFormatter(["/nonexistent/rescript-format"], "");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(
      /^could not start \/nonexistent\/rescript-format: /,
    );
  });
});

describe("check-reanalyze", () => {
  const finding = {
    name: "Warning Dead Value",
    kind: "warning",
    file: `${REPO_ROOT}/skills/x/references/examples/X.res`,
    range: [6, 0, 6, 14],
    message: "unused is never used",
  };

  test("parses findings after leading log lines", () => {
    const stdout = `\n${JSON.stringify([finding])}\n`;
    expect(parseFindings(stdout)).toEqual([finding]);
  });

  test("parses an empty report as no findings", () => {
    expect(parseFindings("[\n]\n")).toEqual([]);
  });

  test("rejects output that carries no JSON array", () => {
    expect(() => parseFindings("Analysis reported 0 issues")).toThrow();
  });

  test("renders a repository-relative, one-based location", () => {
    expect(render(finding, REPO_ROOT)).toBe(
      "skills/x/references/examples/X.res:7:1: Warning Dead Value: unused is never used",
    );
  });

  test("passes a run with no findings", () => {
    expect(
      gate({ exitCode: 0, stdout: "[]\n", stderr: "" }, REPO_ROOT),
    ).toEqual({ code: 0, errors: [], out: ["reanalyze: no findings"] });
  });

  test("fails a run with findings and renders each one", () => {
    const run = { exitCode: 0, stdout: JSON.stringify([finding]), stderr: "" };
    expect(gate(run, REPO_ROOT)).toEqual({
      code: 1,
      errors: [
        "skills/x/references/examples/X.res:7:1: Warning Dead Value: unused is never used",
        "reanalyze reported 1 finding(s)",
      ],
      out: [],
    });
  });

  test("fails a run where reanalyze itself failed, keeping its output", () => {
    const run = { exitCode: 2, stdout: "partial", stderr: " boom" };
    expect(gate(run, REPO_ROOT)).toEqual({
      code: 1,
      errors: ["reanalyze exited with status 2", "partial boom"],
      out: [],
    });
  });

  test("fails a run whose output carries no JSON", () => {
    const run = {
      exitCode: 0,
      stdout: "Analysis reported 0 issues",
      stderr: "",
    };
    const verdict = gate(run, REPO_ROOT);
    expect(verdict.code).toBe(1);
    expect(verdict.errors[0]).toMatch(/printed no JSON array/);
  });

  /**
   * Runs the gate script as a subprocess with a fake reanalyze that prints
   * `stdout` and `stderr` and exits `status`; returns what the gate did.
   */
  function runGate(stdout, stderr, status) {
    const directory = mkdtempSync(join(tmpdir(), "rescript-skill-reanalyze-"));
    try {
      const fake = join(directory, "reanalyze");
      writeFileSync(join(directory, "out"), stdout);
      writeFileSync(join(directory, "err"), stderr);
      writeFileSync(
        fake,
        `#!/bin/sh\ncat "${directory}/out"\ncat "${directory}/err" >&2\nexit ${status}\n`,
        { mode: 0o755 },
      );
      const result = Bun.spawnSync(
        [
          process.execPath,
          "skills/rescript-quality-tools/references/examples/check-reanalyze.mjs",
        ],
        { cwd: REPO_ROOT, env: { ...process.env, REANALYZE_COMMAND: fake } },
      );
      return {
        exitCode: result.exitCode,
        stdout: result.stdout.toString(),
        stderr: result.stderr.toString(),
      };
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  }

  test("as a subprocess, passes a run with no findings", () => {
    expect(runGate("[]\n", "", 0)).toEqual({
      exitCode: 0,
      stdout: "reanalyze: no findings\n",
      stderr: "",
    });
  });

  test("as a subprocess, fails a run with findings and renders them", () => {
    const run = runGate(JSON.stringify([finding]), "", 0);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toBe(
      "skills/x/references/examples/X.res:7:1: Warning Dead Value: unused is never used\n" +
        "reanalyze reported 1 finding(s)\n",
    );
    expect(run.stdout).toBe("");
  });

  test("as a subprocess, fails when reanalyze fails, keeping its output", () => {
    const run = runGate("partial", " boom", 3);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toBe("reanalyze exited with status 3\npartial boom\n");
  });

  test("as a subprocess, fails on output with no JSON", () => {
    const run = runGate("Analysis reported 0 issues\n", "", 0);
    expect(run.exitCode).toBe(1);
    expect(run.stderr).toMatch(/^reanalyze printed no JSON array/);
  });

  test("passes the built repository as a subprocess", () => {
    const result = Bun.spawnSync(
      [
        process.execPath,
        "skills/rescript-quality-tools/references/examples/check-reanalyze.mjs",
      ],
      { cwd: REPO_ROOT },
    );
    expect({
      exitCode: result.exitCode,
      stdout: result.stdout.toString(),
    }).toEqual({ exitCode: 0, stdout: "reanalyze: no findings\n" });
  });
});
