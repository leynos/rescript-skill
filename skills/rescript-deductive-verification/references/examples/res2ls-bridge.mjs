/**
res2ls bridge: turn one compiled ReScript module into a LemmaScript
verification unit, using only compiler output and the contracts written on the
ReScript declarations.

  bun res2ls-bridge.mjs <path/to/Module.res> <out-dir>

Inputs, all produced by the ReScript 12 toolchain from `Module.res`:

- `Module.res.mjs`: the production JavaScript, used verbatim as the bodies
  (in-source output with the `.res.mjs` suffix);
- `Module.gen.ts`: genType's TypeScript view of the runtime types;
- `bsc -only-parse -dparsetree`: the `@requires` and `@ensures` attributes;
- `rescript-tools doc`: ReScript-level types, to tell `int` from `float`.

Outputs: `<out-dir>/Module.ts`, the unit `lsc check --backend=dafny` proves,
and `<out-dir>/Module.manifest.json`, which ties the unit to the hashes of its
inputs for `res2ls-correspond.mjs`.

The unit differs from the production JavaScript only by insertion (types,
`//@` lines, a prelude) and two reversible rewrites, both undone by the
correspondence audit:

- `e | 0` becomes `int32(e)`, because LemmaScript lowers `|` without int32
  wrap-around. TRUSTED: the prelude's `int32` equals `| 0` on safe integers.
- compiler-generated locals such as `by$1` become `by__1`, because `$` is not
  a Dafny identifier character.
*/

import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname, join } from "node:path";
import ts from "typescript";

export const BRIDGE_VERSION = "1";

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Directory holding `bsc.exe` and `rescript-tools.exe` for this host. */
export function rescriptBin(fromDir = process.cwd()) {
  if (process.env.RESCRIPT_BIN) {
    return process.env.RESCRIPT_BIN;
  }
  const require = createRequire(join(fromDir, "package.json"));
  const pkg = `@rescript/${process.platform}-${process.arch}/package.json`;
  return join(dirname(require.resolve(pkg)), "bin");
}

// ── Contracts from the ReScript parse tree ──────────────────────────────

const CONTRACT_ATTRIBUTES = new Set(["requires", "ensures"]);
const OCAML_ESCAPES = {
  n: "\n",
  t: "\t",
  r: "\r",
  b: "\b",
  "\\": "\\",
  '"': '"',
  "'": "'",
  " ": " ",
};

/** Decodes an OCaml string literal as the compiler's Printast prints it. */
export function ocamlString(literal) {
  let out = "";
  for (let i = 1; i < literal.length - 1; i++) {
    if (literal[i] !== "\\") {
      out += literal[i];
      continue;
    }
    i++;
    const escaped = literal[i];
    if (escaped in OCAML_ESCAPES) {
      out += OCAML_ESCAPES[escaped];
    } else if (/[0-9]/.test(escaped)) {
      out += String.fromCharCode(Number(literal.slice(i, i + 3)));
      i += 2;
    } else {
      throw new Error(`unsupported escape \\${escaped} in ${literal}`);
    }
  }
  return out;
}

/**
 * Maps each top-level value name to its `@requires` and `@ensures` strings,
 * in source order. A contract attribute without exactly one string literal
 * is an error, not something to skip.
 */
export function contractsFromParsetree(text) {
  const contracts = new Map();
  const attribute =
    /attribute\s+"([^"]+)"\s*\[\s*(?:structure_item\s+Pstr_eval\s+expression\s+Pexp_constant PConst_string \(("(?:[^"\\]|\\.)*"),[^)]*\)\s*\])?/g;
  // Each binding prints as `<def>`, then its attributes, then its pattern.
  for (const def of text.split(/^\s*<def>\s*$/m).slice(1)) {
    const name = def.match(/Ppat_var "([^"]+)"/)?.[1];
    const head = def.slice(0, def.indexOf("pattern"));
    const found = { requires: [], ensures: [] };
    for (const match of head.matchAll(attribute)) {
      if (!CONTRACT_ATTRIBUTES.has(match[1])) {
        continue;
      }
      if (!name || !match[2]) {
        throw new Error(
          `@${match[1]} on ${name ?? "a non-variable binding"} must carry one string literal`,
        );
      }
      found[match[1]].push(ocamlString(match[2]));
    }
    if (found.requires.length > 0 || found.ensures.length > 0) {
      contracts.set(name, found);
    }
  }
  return contracts;
}

// Contracts use `result` for the return value; `\result` would need `\\result`
// inside a ReScript string.
const toLemmaScript = (spec) => spec.replace(/\bresult\b/g, "\\result");

// ── Types from genType and rescript-tools doc ───────────────────────────

function genTypeDeclarations(genTs) {
  const sf = ts.createSourceFile("gen.ts", genTs, ts.ScriptTarget.Latest, true);
  const types = [];
  const signatures = new Map();
  for (const st of sf.statements) {
    if (ts.isTypeAliasDeclaration(st)) {
      types.push(st.getText(sf));
    }
    if (ts.isVariableStatement(st)) {
      for (const d of st.declarationList.declarations) {
        if (d.type && ts.isFunctionTypeNode(d.type)) {
          signatures.set(d.name.getText(sf), d.type);
        }
      }
    }
  }
  return { sf, types, signatures };
}

function splitTopLevel(text, separator) {
  const parts = [];
  let depth = 0;
  let current = "";
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("=>", i)) {
      current += "=>";
      i++;
      continue;
    }
    const ch = text[i];
    if ("(<{[".includes(ch)) {
      depth++;
    } else if (")>}]".includes(ch)) {
      depth--;
    }
    if (ch === separator && depth === 0) {
      parts.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * ReScript parameter and result types of a value, from its documentation
 * signature `let f: (a, b) => r`. Returns no parameters for anything that is
 * not a single top-level function arrow.
 */
export function signatureTypes(doc, name) {
  const signature = doc.items.find(
    (item) => item.kind === "value" && item.name === name,
  )?.signature;
  const body = signature?.replace(/^let [^:]+:\s*/, "") ?? "";
  const arrows = [];
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    if (body.startsWith("=>", i)) {
      if (depth === 0) {
        arrows.push(i);
      }
      i++;
    } else if ("(<{[".includes(body[i])) {
      depth++;
    } else if (")>}]".includes(body[i])) {
      depth--;
    }
  }
  if (arrows.length !== 1) {
    return { params: [], ret: null };
  }
  let params = body.slice(0, arrows[0]).trim();
  if (params.startsWith("(") && params.endsWith(")")) {
    params = params.slice(1, -1);
  }
  return {
    params: splitTopLevel(params, ",").map((p) => p.replace(/^~\w+:\s*/, "")),
    ret: body.slice(arrows[0] + 2).trim(),
  };
}

/**
 * For each variant type with an `int` field, directly or through another
 * such type, a predicate stating ReScript's typing guarantee that the field
 * fits in int32. genType maps `int` and `float` alike to `number`, so this
 * information exists only at the ReScript level.
 */
function rangePredicates(doc, genSf) {
  const variants = new Map(
    doc.items
      .filter((item) => item.kind === "type" && item.detail?.kind === "variant")
      .map((item) => [item.name, item.detail.items]),
  );
  const tags = new Map();
  for (const st of genSf.statements) {
    if (ts.isTypeAliasDeclaration(st) && ts.isUnionTypeNode(st.type)) {
      tags.set(
        st.name.text,
        st.type.types.map((member) => {
          const prop = member.members?.find(
            (m) => m.type && ts.isLiteralTypeNode(m.type),
          );
          return (
            prop && {
              field: prop.name.getText(genSf),
              tag: prop.type.literal.text,
            }
          );
        }),
      );
    }
  }
  const needs = (name, seen = new Set()) => {
    if (seen.has(name) || !variants.has(name)) {
      return false;
    }
    seen.add(name);
    return variants
      .get(name)
      .some((ctor) =>
        (ctor.payload?.fields ?? []).some(
          (f) => f.signature === "int" || needs(f.signature, seen),
        ),
      );
  };
  const predicates = new Map();
  for (const [name, ctors] of variants) {
    if (!needs(name)) {
      continue;
    }
    const memberTags = tags.get(name);
    if (
      !memberTags ||
      memberTags.length !== ctors.length ||
      memberTags.some((t) => !t)
    ) {
      throw new Error(
        `${name}: genType members do not line up with its constructors; give every constructor a record payload`,
      );
    }
    const cases = ctors.map((ctor, i) => {
      const conjuncts = (ctor.payload?.fields ?? []).flatMap((f) => {
        if (f.signature === "int") {
          return [`isInt32(v.${f.name})`];
        }
        return needs(f.signature)
          ? [`int32Typed_${f.signature}(v.${f.name})`]
          : [];
      });
      const body = conjuncts.length > 0 ? conjuncts.join(" && ") : "true";
      return `    case "${memberTags[i].tag}":\n      return ${body};`;
    });
    predicates.set(
      name,
      [
        "//@ pure",
        `function int32Typed_${name}(v: ${name}): boolean {`,
        `  switch (v.${memberTags[0].field}) {`,
        ...cases,
        "  }",
        "}",
      ].join("\n"),
    );
  }
  return predicates;
}

// ── The verification-only prelude ───────────────────────────────────────

export const INT32_PRELUDE = `// ReScript \`int\` is a wrapping int32; the compiler emits \`e | 0\`.
// TRUSTED: for safe integers x, int32(x) === (x | 0). Established by test.
//@ pure
function int32(x: number): number {
  //@ ensures -2147483648 <= \\result && \\result <= 2147483647
  //@ ensures -2147483648 <= x && x <= 2147483647 ==> \\result === x
  const m = ((x % 4294967296) + 4294967296) % 4294967296;
  return m >= 2147483648 ? m - 4294967296 : m;
}

//@ pure
function isInt32(x: number): boolean {
  return -2147483648 <= x && x <= 2147483647;
}`;

export const isPreludeName = (name) =>
  name === "int32" || name === "isInt32" || name.startsWith("int32Typed_");

// ── Production bodies from the compiled JavaScript ──────────────────────

export const dollarFree = (name) => name.replace(/\$/g, "__");

function isOrZero(node) {
  return (
    ts.isBinaryExpression(node) &&
    node.operatorToken.kind === ts.SyntaxKind.BarToken &&
    ts.isNumericLiteral(node.right) &&
    node.right.text === "0"
  );
}

function functionEdits(st, jsSf, sig, genSf, contract, typing) {
  const edits = [];
  const name = st.name.text;
  st.parameters.forEach((p, i) => {
    const type = sig.parameters[i]?.type?.getText(genSf);
    if (!type) {
      throw new Error(`${name}: genType gives no type for parameter ${i}`);
    }
    edits.push({ pos: p.end, end: p.end, text: `: ${type}` });
  });
  const close = st.parameters.end + 1;
  edits.push({ pos: close, end: close, text: `: ${sig.type.getText(genSf)}` });

  const lines = [
    ...(typing.requires.length + typing.ensures.length > 0
      ? ["  // ReScript typing: trusted on entry, proved on exit."]
      : []),
    ...typing.requires.map((r) => `  //@ requires ${r}`),
    ...typing.ensures.map((e) => `  //@ ensures ${e}`),
    ...contract.requires.map((r) => `  //@ requires ${toLemmaScript(r)}`),
    ...contract.ensures.map((e) => `  //@ ensures ${toLemmaScript(e)}`),
  ];
  if (lines.length > 0) {
    const open = st.body.getStart(jsSf) + 1;
    edits.push({ pos: open, end: open, text: `\n${lines.join("\n")}` });
  }

  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text.includes("$")) {
      edits.push({
        pos: node.getStart(jsSf),
        end: node.end,
        text: dollarFree(node.text),
      });
    }
    if (isOrZero(node)) {
      edits.push({
        pos: node.getStart(jsSf),
        end: node.left.getStart(jsSf),
        text: "int32(",
      });
      edits.push({ pos: node.left.end, end: node.end, text: ")" });
    }
    ts.forEachChild(node, visit);
  };
  visit(st.body);
  return edits;
}

function typingContracts(name, sig, genSf, doc, predicates) {
  const { params, ret } = signatureTypes(doc, name);
  const requires = sig.parameters.flatMap((p, i) => {
    const type = p.type?.getText(genSf);
    const param = p.name.getText(genSf);
    if (params[i] === "int") {
      return [`isInt32(${param})`];
    }
    return predicates.has(type) ? [`int32Typed_${type}(${param})`] : [];
  });
  const retType = sig.type.getText(genSf);
  let ensures = [];
  if (ret === "int") {
    ensures = ["isInt32(\\result)"];
  } else if (predicates.has(retType)) {
    ensures = [`int32Typed_${retType}(\\result)`];
  }
  return { requires, ensures };
}

/** Reads the four inputs for `resPath` without writing anything. */
export function readInputs(resPath, bin = rescriptBin()) {
  const stem = resPath.replace(/\.res$/, "");
  const parse = spawnSync(
    join(bin, "bsc.exe"),
    ["-only-parse", "-dparsetree", resPath],
    { encoding: "utf8" },
  );
  if (parse.status !== 0) {
    throw new Error(`bsc -dparsetree failed for ${resPath}: ${parse.stderr}`);
  }
  return {
    res: readFileSync(resPath, "utf8"),
    js: readFileSync(`${stem}.res.mjs`, "utf8"),
    genTs: readFileSync(`${stem}.gen.ts`, "utf8"),
    // Printast writes the tree to stderr; stdout carries JavaScript.
    parsetree: parse.stderr,
    doc: JSON.parse(
      execFileSync(join(bin, "rescript-tools.exe"), ["doc", resPath], {
        encoding: "utf8",
      }),
    ),
  };
}

/** Builds the unit text and manifest from already-read inputs. */
export function buildUnit(moduleName, inputs) {
  const contracts = contractsFromParsetree(inputs.parsetree);
  const { sf: genSf, types, signatures } = genTypeDeclarations(inputs.genTs);
  const predicates = rangePredicates(inputs.doc, genSf);
  const jsSf = ts.createSourceFile(
    `${moduleName}.res.mjs`,
    inputs.js,
    ts.ScriptTarget.Latest,
    true,
  );
  const functions = jsSf.statements.filter(
    (st) => ts.isFunctionDeclaration(st) && st.name,
  );
  if (functions.length === 0) {
    throw new Error(
      `${moduleName}.res.mjs has no function bodies: its values compile to aliases of other code, such as @rescript/runtime, which cannot be verified here`,
    );
  }

  const edits = [];
  const unbridged = [];
  for (const st of functions) {
    const name = st.name.text;
    if (isPreludeName(name)) {
      throw new Error(`${name} collides with a name the bridge reserves`);
    }
    const sig = signatures.get(name);
    if (!sig) {
      unbridged.push(name);
      continue;
    }
    const contract = contracts.get(name) ?? { requires: [], ensures: [] };
    const contracted = contract.requires.length + contract.ensures.length > 0;
    if (contracted && /[{]/.test(sig.getText(genSf))) {
      throw new Error(
        `${name}: genType inlines an anonymous object type in its signature; give that type a @genType name`,
      );
    }
    const typing = contracted
      ? typingContracts(name, sig, genSf, inputs.doc, predicates)
      : { requires: [], ensures: [] };
    edits.push(...functionEdits(st, jsSf, sig, genSf, contract, typing));
  }
  for (const name of contracts.keys()) {
    if (!signatures.has(name)) {
      throw new Error(`contract on ${name}, which has no @genType signature`);
    }
  }

  // Apply edits back to front; at equal positions the wider edit goes first,
  // so an insertion never lands inside text that is about to be replaced.
  let text = inputs.js;
  for (const e of [...edits].sort((a, b) => b.pos - a.pos || b.end - a.end)) {
    text = text.slice(0, e.pos) + e.text + text.slice(e.end);
  }
  const first = functions[0].getStart(jsSf);
  const last = functions.at(-1).end;
  const growth = edits
    .filter((e) => e.pos < last)
    .reduce((n, e) => n + e.text.length - (e.end - e.pos), 0);

  const unit = [
    `// Generated by res2ls ${BRIDGE_VERSION} from ${moduleName}.res; do not edit.`,
    `// Function bodies are ${moduleName}.res.mjs as the compiler emitted it.`,
    "",
    types.join("\n\n"),
    "",
    INT32_PRELUDE,
    "",
    [...predicates.values()].join("\n\n"),
    "",
    text.slice(first, last + growth).trim(),
    "",
  ].join("\n");

  const manifest = {
    bridge: BRIDGE_VERSION,
    module: moduleName,
    inputs: {
      [`${moduleName}.res`]: sha256(inputs.res),
      [`${moduleName}.res.mjs`]: sha256(inputs.js),
      [`${moduleName}.gen.ts`]: sha256(inputs.genTs),
    },
    unit: { [`${moduleName}.ts`]: sha256(unit) },
    contracts: Object.fromEntries(contracts),
    rangePredicates: [...predicates.keys()],
    unbridged,
  };
  return { unit, manifest };
}

/** Reads, builds, and writes the unit and manifest for one module. */
export function bridge(resPath, outDir, bin = rescriptBin()) {
  const moduleName = basename(resPath, ".res");
  const { unit, manifest } = buildUnit(moduleName, readInputs(resPath, bin));
  mkdirSync(outDir, { recursive: true });
  const unitPath = join(outDir, `${moduleName}.ts`);
  writeFileSync(unitPath, unit);
  writeFileSync(
    join(outDir, `${moduleName}.manifest.json`),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return { unitPath, manifest };
}

if (import.meta.main) {
  const [resPath, outDir] = process.argv.slice(2);
  if (!resPath || !outDir) {
    console.error("usage: bun res2ls-bridge.mjs <Module.res> <out-dir>");
    process.exit(2);
  }
  const { unitPath, manifest } = bridge(resPath, outDir);
  console.log(`wrote ${unitPath}`);
  for (const name of manifest.unbridged) {
    console.log(`not bridged (no @genType signature): ${name}`);
  }
}
