/**
res2ls mutation check: show that each contract on a module says something, by
breaking the production JavaScript and requiring the proof to fail on exactly
the contracts the break should violate.

  bun res2ls-mutate.mjs <path/to/Module.res> <mutants.mjs> <out-dir> <lsc.js>

`mutants.mjs` default-exports an array of
`{ name, breaks: [contract fragment, ...], edits: [{ old, new }, ...] }`.
Each `old` must occur exactly once in `Module.res.mjs`. Each fragment must
match exactly one failed contract, and every failed contract must be matched,
so a mutant that breaks more, or less, than it claims fails the check.

The mutants edit the compiled JavaScript rather than the ReScript source: the
proof is about that JavaScript, and editing it directly avoids a second
compiler project. A mutant that is not even well-formed Dafny, or that fails
for a reason other than a postcondition, is reported as an error.
*/

import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildUnit, readInputs } from "./res2ls-bridge.mjs";

/** Applies `edits` to `text`, requiring each `old` to occur exactly once. */
export function applyEdits(text, edits, label = "mutant") {
  let out = text;
  for (const { old, new: replacement } of edits) {
    const first = out.indexOf(old);
    if (first === -1 || out.indexOf(old, first + 1) !== -1) {
      throw new Error(
        `${label}: edit target must occur exactly once: ${JSON.stringify(old)}`,
      );
    }
    out = out.slice(0, first) + replacement + out.slice(first + old.length);
  }
  if (out === text) {
    throw new Error(`${label}: edits leave the JavaScript unchanged`);
  }
  return out;
}

/**
 * Returns the source contract of every postcondition Dafny could not prove,
 * as `\result`-free text, by matching the failing `.dfy` ensures line to the
 * unit's `//@ ensures` line with the same position in the same function.
 */
export function failedContracts(verifierOutput, dfy, unit) {
  const dfyLines = dfy.split("\n");
  const unitLines = unit.split("\n");
  const failing = new Set();
  for (const m of verifierOutput.matchAll(
    /\.dfy\((\d+),\d+\): Related location: this is the postcondition that could not be proved/g,
  )) {
    failing.add(Number(m[1]) - 1);
  }
  const contracts = [];
  for (const index of [...failing].sort((a, b) => a - b)) {
    let header = index;
    while (header >= 0 && !/^(method|function) /.test(dfyLines[header])) {
      header--;
    }
    if (header < 0) {
      throw new Error(`no declaration above .dfy line ${index + 1}`);
    }
    const name = dfyLines[header].match(/^(?:method|function) (\w+)/)[1];
    const ordinal = dfyLines
      .slice(header + 1, index + 1)
      .filter((line) => /^\s+ensures /.test(line)).length;
    const fn = unitLines.findIndex((line) =>
      line.startsWith(`function ${name}(`),
    );
    const ensures = unitLines
      .slice(fn + 1)
      .filter((line) => /^\s*\/\/@ ensures /.test(line))
      .slice(0, ordinal);
    if (fn === -1 || ensures.length < ordinal) {
      throw new Error(`cannot match .dfy line ${index + 1} to ${name}`);
    }
    contracts.push(
      ensures
        .at(-1)
        .replace(/^\s*\/\/@ ensures /, "")
        .replaceAll("\\result", "result"),
    );
  }
  return contracts;
}

/** Compares failed contracts with the fragments a mutant claims to break. */
export function judge(failed, breaks) {
  const problems = [];
  for (const fragment of breaks) {
    const hits = failed.filter((c) => c.includes(fragment));
    if (hits.length !== 1) {
      problems.push(
        `"${fragment}" matches ${hits.length} failed contracts, not 1`,
      );
    }
  }
  for (const contract of failed) {
    if (!breaks.some((fragment) => contract.includes(fragment))) {
      problems.push(`unexpected failure: ${contract}`);
    }
  }
  return problems;
}

/**
 * Judges one finished verifier run of a mutant; returns a list of problems,
 * empty when the mutant was killed on exactly the contracts it lists.
 * `readDfy` is called only once the run is known to have reached Dafny.
 */
export function judgeRun({ status, output }, readDfy, unit, breaks, log) {
  if (status === 0) {
    return ["survived: the proof still passes"];
  }
  const errors = [...output.matchAll(/\.dfy\(\d+,\d+\): Error: (.*)/g)].map(
    (m) => m[1],
  );
  if (errors.length === 0) {
    // A crash, a timeout, or a translation failure before Dafny ran: the
    // mutant was not judged, so it must not count as killed.
    return [`lsc exited with status ${status} and no Dafny error; see ${log}`];
  }
  const foreign = errors.filter((e) => !/postcondition/.test(e));
  if (foreign.length > 0) {
    return foreign.map((e) => `failed for another reason: ${e}`);
  }
  return judge(failedContracts(output, readDfy(), unit), breaks);
}

/** Bridges, proves, and judges one mutant; returns a list of problems. */
function runMutant(moduleName, inputs, mutant, outDir, lscPath) {
  const dir = join(outDir, mutant.name);
  mkdirSync(dir, { recursive: true });
  const js = applyEdits(inputs.js, mutant.edits, mutant.name);
  const { unit } = buildUnit(moduleName, { ...inputs, js });
  const unitPath = join(dir, `${moduleName}.ts`);
  writeFileSync(unitPath, unit);
  const run = spawnSync(
    process.execPath,
    [lscPath, "check", "--backend=dafny", unitPath],
    { encoding: "utf8" },
  );
  const output = `${run.stdout}${run.stderr}`;
  const log = join(dir, "verify.log");
  writeFileSync(log, output);
  return judgeRun(
    { status: run.status, output },
    () => readFileSync(join(dir, `${moduleName}.dfy`), "utf8"),
    unit,
    mutant.breaks,
    log,
  );
}

if (import.meta.main) {
  const [resPath, mutantsPath, outDir, lscPath] = process.argv.slice(2);
  if (!resPath || !mutantsPath || !outDir || !lscPath) {
    console.error(
      "usage: bun res2ls-mutate.mjs <Module.res> <mutants.mjs> <out-dir> <lsc.js>",
    );
    process.exit(2);
  }
  const moduleName = basename(resPath, ".res");
  const inputs = readInputs(resPath);
  const { default: mutants } = await import(
    pathToFileURL(resolve(mutantsPath)).href
  );
  let failures = 0;
  for (const mutant of mutants) {
    const problems = runMutant(
      moduleName,
      inputs,
      mutant,
      outDir,
      resolve(lscPath),
    );
    console.log(
      `${problems.length === 0 ? "killed" : "PROBLEM"} ${mutant.name}`,
    );
    for (const problem of problems) {
      console.log(`  ${problem}`);
    }
    failures += problems.length === 0 ? 0 : 1;
  }
  console.log(`${mutants.length - failures}/${mutants.length} mutants killed`);
  process.exit(failures === 0 ? 0 : 1);
}
