/**
@file Dead-code and exception gate over `rescript-tools reanalyze`.

ReScript 12.3.1 ships reanalyze inside `rescript-tools`, and
`reanalyze -config` runs the analyses named in `rescript.json` (`dce` and
`exception` here). The command exits 0 whatever it reports, so this script
reads its JSON output and fails on any finding. Suppress a deliberate finding
in source with `@live`, `@dead`, `@@live`, or `@throws(...)`, never by
widening the `suppress` list or by skipping this gate.

Run it after `rescript build`: reanalyze reads the compiler's `.cmt` files.
*/

import { relative } from "node:path";

/** Extracts the JSON findings array from reanalyze's stdout. */
export function parseFindings(stdout) {
  const start = stdout.indexOf("[");
  if (start === -1) {
    throw new Error(`reanalyze printed no JSON array:\n${stdout}`);
  }
  const findings = JSON.parse(stdout.slice(start));
  if (!Array.isArray(findings)) {
    throw new Error("reanalyze JSON output is not an array");
  }
  return findings;
}

/** Renders one finding as `path:line:column: name: message`, 1-based. */
export function describe(finding, root) {
  const [line, column] = finding.range;
  const path = relative(root, finding.file);
  return `${path}:${line + 1}:${column + 1}: ${finding.name}: ${finding.message}`;
}

/**
 * Decides the gate from one finished reanalyze run, given as
 * `{ exitCode, stdout, stderr }`. Returns the exit code and the lines to
 * print, so every outcome can be tested without running reanalyze.
 */
export function gate(run, root) {
  if (run.exitCode !== 0) {
    return {
      code: 1,
      errors: [
        `reanalyze exited with status ${run.exitCode}`,
        run.stdout + run.stderr,
      ],
      out: [],
    };
  }
  let findings;
  try {
    findings = parseFindings(run.stdout);
  } catch (error) {
    return { code: 1, errors: [error.message], out: [] };
  }
  if (findings.length > 0) {
    return {
      code: 1,
      errors: [
        ...findings.map((finding) => describe(finding, root)),
        `reanalyze reported ${findings.length} finding(s)`,
      ],
      out: [],
    };
  }
  return { code: 0, errors: [], out: ["reanalyze: no findings"] };
}

/** Runs reanalyze over the project and returns its exit code and output. */
function runReanalyze() {
  const result = Bun.spawnSync([
    process.execPath,
    "run",
    "--bun",
    "rescript-tools",
    "reanalyze",
    "-config",
    "-json",
  ]);
  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

if (import.meta.main) {
  const { code, errors, out } = gate(runReanalyze(), process.cwd());
  for (const line of errors) {
    console.error(line);
  }
  for (const line of out) {
    console.log(line);
  }
  process.exit(code);
}
