/**
Behavioural tests for the repository's own gate scripts.

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
} from "../skills/rescript-quality-tools/references/examples/check-codeblocks.mjs";
import {
  describe as render,
  parseFindings,
} from "../skills/rescript-quality-tools/references/examples/check-reanalyze.mjs";
import { REPO_ROOT } from "./support/catalogue.mjs";

const FENCE = "```";

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
});
