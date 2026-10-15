/**
@file Behavioural tests for the res2ls bridge and correspondence audit shipped with
`rescript-deductive-verification`.

These need no prover: they check what the bridge must get right for a proof
to be about production code. Contracts must come from the parse tree exactly,
the unit must differ from the compiled JavaScript only by the documented
rewrites, the trusted `int32` model must agree with `| 0`, the audit must fail
on every kind of drift, and every contract must be one a catalogued mutant
breaks. `make prove` runs the prover itself.
*/

import { describe, expect, test } from "bun:test";
import {
  copyFileSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import ts from "typescript";
import {
  bridge,
  buildUnit,
  contractsFromParsetree,
  dollarFree,
  INT32_PRELUDE,
  ocamlString,
  readInputs,
  rescriptBin,
  signatureTypes,
} from "../skills/rescript-deductive-verification/references/examples/res2ls-bridge.mjs";
import {
  compareUnit,
  correspond,
} from "../skills/rescript-deductive-verification/references/examples/res2ls-correspond.mjs";
import {
  applyEdits,
  failedContracts,
  judge,
  judgeRun,
} from "../skills/rescript-deductive-verification/references/examples/res2ls-mutate.mjs";
import mutants from "../skills/rescript-deductive-verification/references/examples/VerifiedLease.mutants.mjs";
import { REPO_ROOT } from "./support/catalogue.mjs";

const EXAMPLES = join(
  REPO_ROOT,
  "skills/rescript-deductive-verification/references/examples",
);
const LEASE = join(EXAMPLES, "VerifiedLease.res");
const BIN = rescriptBin(REPO_ROOT);

function withTempDir(run) {
  const dir = mkdtempSync(join(tmpdir(), "rescript-skill-res2ls-"));
  try {
    return run(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Parse tree of a ReScript snippet, from the real compiler. */
function parsetreeOf(source) {
  return withTempDir((dir) => {
    const path = join(dir, "Snippet.res");
    writeFileSync(path, source);
    const run = Bun.spawnSync([
      join(BIN, "bsc.exe"),
      "-only-parse",
      "-dparsetree",
      path,
    ]);
    expect(run.exitCode).toBe(0);
    return run.stderr.toString();
  });
}

const lease = readInputs(LEASE, BIN);
const { unit } = buildUnit("VerifiedLease", lease);

describe("contract extraction", () => {
  test("reads every contract on step, in source order", () => {
    const step = contractsFromParsetree(lease.parsetree).get("step");
    expect(step.requires).toEqual(["wellFormed(state)"]);
    expect(step.ensures).toHaveLength(12);
    expect(step.ensures[0]).toBe(
      "result.kind === 'ok' ==> wellFormed(result.state)",
    );
  });

  test("ignores other attributes and uncontracted bindings", () => {
    const contracts = contractsFromParsetree(
      parsetreeOf(
        '@genType @live\nlet a = 1\n@ensures("result > 0")\nlet b = () => 1\n',
      ),
    );
    expect([...contracts.keys()]).toEqual(["b"]);
  });

  test("rejects a contract that is not one string literal", () => {
    expect(() =>
      contractsFromParsetree(parsetreeOf("@ensures(1)\nlet f = () => 1\n")),
    ).toThrow(/one string literal/);
  });

  test("decodes the compiler's escaped string literals", () => {
    expect(ocamlString('"a\\"b\\\\c\\n\\065"')).toBe('a"b\\c\nA');
    expect(() => ocamlString('"\\q"')).toThrow(/unsupported escape/);
  });

  test("decodes escaped bytes as UTF-8, as the real compiler prints them", () => {
    const parsetree = parsetreeOf('@ensures("café") \nlet f = () => 1\n');
    expect(contractsFromParsetree(parsetree).get("f").ensures).toEqual([
      "café",
    ]);
    expect(ocamlString('"caf\\195\\169"')).toBe("café");
  });

  test.each([
    ["a truncated decimal escape", '"\\1"'],
    ["a decimal escape with a non-digit", '"\\1x2"'],
    ["a decimal escape above 255", '"\\256"'],
  ])("rejects %s", (_, literal) => {
    expect(() => ocamlString(literal)).toThrow(/malformed decimal escape/);
  });

  test("rejects bytes that are not UTF-8", () => {
    expect(() => ocamlString('"\\195"')).toThrow();
  });
});

describe("identifier rewriting", () => {
  test("rewrites only a compiler-generated trailing $n", () => {
    expect(dollarFree("by$1")).toBe("by__1");
    expect(dollarFree("handles")).toBe("handles");
  });

  test.each([
    ["a production name containing __", "by__1", /reserved/],
    ["a $ that is not a trailing number", "Foo$Bar", /trailing/],
  ])("refuses %s, which could not be undone", (_, name, message) => {
    expect(() => dollarFree(name)).toThrow(message);
  });
});

describe("signature types", () => {
  const doc = (signature) => ({
    items: [{ kind: "value", name: "f", signature }],
  });

  test.each([
    ["let f: (state, event) => outcome", ["state", "event"], "outcome"],
    ["let f: int => result<int, string>", ["int"], "result<int, string>"],
    ["let f: (~limit: int, string) => int", ["int", "string"], "int"],
    ["let f: (int => int) => int", ["int => int"], "int"],
  ])("%s", (signature, params, ret) => {
    expect(signatureTypes(doc(signature), "f")).toEqual({ params, ret });
  });

  test("a non-function or curried value yields no parameters", () => {
    expect(signatureTypes(doc("let f: int"), "f").params).toEqual([]);
    expect(signatureTypes(doc("let f: int => int => int"), "f").params).toEqual(
      [],
    );
  });
});

describe("the verification unit", () => {
  test("carries each contract with result as \\result", () => {
    expect(unit).toContain("//@ requires wellFormed(state)");
    expect(unit).toContain(
      "//@ ensures \\result.kind === 'ok' ==> wellFormed(\\result.state)",
    );
  });

  test("states the ReScript typing assumptions on entry and exit", () => {
    expect(unit).toContain("//@ requires int32Typed_state(state)");
    expect(unit).toContain("//@ requires int32Typed_event(event)");
    expect(unit).toContain("//@ ensures int32Typed_outcome(\\result)");
  });

  test("makes int32 wrap-around explicit and leaves no `| 0` in the bodies", () => {
    expect(unit).toContain("int32(handles + 1)");
    const bodies = unit.slice(unit.indexOf("function isOwner"));
    expect(bodies).not.toMatch(/\|\s*0\b/);
  });

  test("is byte-identical across runs", () => {
    expect(buildUnit("VerifiedLease", lease).unit).toBe(unit);
  });

  const inputs = (js, signatures = "") => ({
    res: "",
    js,
    genTs: signatures,
    parsetree: "",
    doc: { items: [] },
  });

  test("refuses a module whose values compile to aliases", () => {
    const js = 'import * as P from "x";\nlet quot = P.div;\nexport { quot }\n';
    expect(() => buildUnit("M", inputs(js))).toThrow(/no function bodies/);
  });

  test("refuses production code that reuses a reserved prelude name", () => {
    const js = "function int32(x) {\n  return x;\n}\n";
    expect(() => buildUnit("M", inputs(js))).toThrow(/reserves/);
  });

  test("refuses a contract on a function genType does not export", () => {
    const parsetree = parsetreeOf('@ensures("result > 0")\nlet f = () => 1\n');
    const js = "function f() {\n  return 1;\n}\n";
    expect(() => buildUnit("M", { ...inputs(js), parsetree })).toThrow(
      /no @genType signature/,
    );
  });

  test("refuses a contracted signature with an anonymous object type", () => {
    const parsetree = parsetreeOf(
      "@ensures(\"result.TAG === 'Ok'\")\nlet f = () => Ok(1)\n",
    );
    const js = "function f() {\n  return 1;\n}\n";
    const genTs =
      'export const f: () => { TAG: "Ok"; _0: number } = M.f as any;\n';
    expect(() => buildUnit("M", { ...inputs(js, genTs), parsetree })).toThrow(
      /anonymous object type/,
    );
  });
});

describe("the trusted int32 model", () => {
  const source = ts.transpileModule(`${INT32_PRELUDE}\nexport { int32 };`, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("exports", source)(exports);
  const { int32 } = exports;

  test("agrees with | 0 at every boundary", () => {
    const edges = [
      0,
      1,
      -1,
      2 ** 31 - 1,
      2 ** 31,
      -(2 ** 31),
      -(2 ** 31) - 1,
      2 ** 32 - 1,
      2 ** 32,
      -(2 ** 32),
      Number.MAX_SAFE_INTEGER,
      Number.MIN_SAFE_INTEGER,
    ];
    for (const x of edges) {
      expect([x, int32(x)]).toEqual([x, x | 0]);
    }
  });

  test("agrees with | 0 on random safe integers", () => {
    let seed = 0x9e3779b9;
    const next = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return seed >>> 0;
    };
    for (let i = 0; i < 200_000; i++) {
      const x = ((next() % 2 ** 21) * 2 ** 32 + next()) * (next() % 2 ? 1 : -1);
      if (int32(x) !== (x | 0)) {
        throw new Error(`int32(${x}) = ${int32(x)}, but ${x} | 0 = ${x | 0}`);
      }
    }
  });
});

describe("correspondence audit", () => {
  test("the unit is the production JavaScript", () => {
    expect(compareUnit(unit, lease.js)).toEqual({
      identical: ["isOwner", "wellFormed", "generationOf", "step"],
      problems: [],
    });
  });

  test("detects a changed function body", () => {
    const drifted = lease.js.replace("handles + 1 | 0", "handles + 2 | 0");
    expect(drifted).not.toBe(lease.js);
    expect(compareUnit(unit, drifted).problems).toEqual([
      "step differs from production",
    ]);
  });

  test("detects production code that was never verified", () => {
    const extra = `${lease.js}\nfunction sneaky() {\n  return 1;\n}\n`;
    expect(compareUnit(unit, extra).problems).toEqual([
      "sneaky is in production but was not verified",
    ]);
  });

  test("checks the manifest hashes of the inputs and the unit", () => {
    withTempDir((dir) => {
      // `rescript-tools doc` needs a built project, so bridge the real
      // example, then audit identical copies of its inputs.
      const out = join(dir, "out");
      bridge(LEASE, out, BIN);
      for (const ext of [".res", ".res.mjs", ".gen.ts"]) {
        copyFileSync(
          join(EXAMPLES, `VerifiedLease${ext}`),
          join(dir, `VerifiedLease${ext}`),
        );
      }
      const res = join(dir, "VerifiedLease.res");
      expect(correspond(res, out).problems).toEqual([]);

      writeFileSync(res, `${readFileSync(res, "utf8")}\n`);
      const unitPath = join(out, "VerifiedLease.ts");
      writeFileSync(unitPath, `${readFileSync(unitPath, "utf8")}//\n`);
      expect(correspond(res, out).problems).toEqual([
        "VerifiedLease.res changed after the unit was generated",
        "VerifiedLease.ts was edited after generation",
      ]);
    });
  });
});

describe("mutation check", () => {
  const contracts = contractsFromParsetree(lease.parsetree).get("step").ensures;

  test.each(mutants.map((m) => [m.name, m]))(
    "%s applies to the compiled module and names real contracts",
    (_, mutant) => {
      expect(applyEdits(lease.js, mutant.edits, mutant.name)).not.toBe(
        lease.js,
      );
      for (const fragment of mutant.breaks) {
        expect(contracts.filter((c) => c.includes(fragment))).toHaveLength(1);
      }
    },
  );

  test("every contract on step is broken by some mutant", () => {
    const broken = contracts.filter((c) =>
      mutants.some((m) => m.breaks.some((fragment) => c.includes(fragment))),
    );
    expect(broken).toEqual(contracts);
  });

  test("an edit target must occur exactly once", () => {
    expect(() => applyEdits("a a", [{ old: "a", new: "b" }], "m")).toThrow(
      /exactly once/,
    );
    expect(() => applyEdits("a", [{ old: "z", new: "b" }], "m")).toThrow(
      /exactly once/,
    );
    expect(() => applyEdits("a", [{ old: "a", new: "a" }], "m")).toThrow(
      /unchanged/,
    );
  });

  test("maps a failing Dafny postcondition back to its contract", () => {
    const dfy = [
      "method f(x: int) returns (r: int)",
      "  ensures r >= 0",
      "  ensures r == x",
      "{",
    ].join("\n");
    const unitText = [
      "function f(x: number): number {",
      "  //@ ensures \\result >= 0",
      "  //@ ensures \\result === x",
    ].join("\n");
    const output =
      "F.dfy(3,4): Related location: this is the postcondition that could not be proved";
    expect(failedContracts(output, dfy, unitText)).toEqual(["result === x"]);
  });

  test("does not count a run that never reached Dafny as a kill", () => {
    const unreadable = () => {
      throw new Error("no .dfy was written");
    };
    expect(
      judgeRun(
        { status: 1, output: "Error: out of memory" },
        unreadable,
        "",
        ["b"],
        "log",
      ),
    ).toEqual(["lsc exited with status 1 and no Dafny error; see log"]);
    expect(
      judgeRun({ status: 0, output: "" }, unreadable, "", ["b"], "log"),
    ).toEqual(["survived: the proof still passes"]);
    expect(
      judgeRun(
        { status: 1, output: "M.dfy(3,1): Error: index out of range" },
        unreadable,
        "",
        ["b"],
        "log",
      ),
    ).toEqual(["failed for another reason: index out of range"]);
  });

  test("judges a mutant that breaks more or less than it claims", () => {
    expect(judge(["a ==> b"], ["b"])).toEqual([]);
    expect(judge(["a ==> b", "c"], ["b"])).toEqual(["unexpected failure: c"]);
    expect(judge([], ["b"])).toEqual(['"b" matches 0 failed contracts, not 1']);
  });
});
