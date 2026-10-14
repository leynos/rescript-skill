/**
Dead-code and exception gate over `rescript-tools reanalyze`.

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

function main() {
  const result = Bun.spawnSync([
    process.execPath,
    "run",
    "--bun",
    "rescript-tools",
    "reanalyze",
    "-config",
    "-json",
  ]);
  const stdout = result.stdout.toString();
  if (result.exitCode !== 0) {
    console.error(stdout + result.stderr.toString());
    return 1;
  }
  const findings = parseFindings(stdout);
  for (const finding of findings) {
    console.error(describe(finding, process.cwd()));
  }
  if (findings.length > 0) {
    console.error(`reanalyze reported ${findings.length} finding(s)`);
    return 1;
  }
  console.log("reanalyze: no findings");
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
