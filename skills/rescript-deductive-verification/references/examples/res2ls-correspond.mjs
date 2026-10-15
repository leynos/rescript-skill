/**
@file res2ls correspondence audit: show that a verification unit is the production
JavaScript the ReScript compiler emitted, not a model of it.

  bun res2ls-correspond.mjs <path/to/Module.res> <out-dir>

Passes only when:

1. every input hash in the manifest matches the files beside `Module.res`,
   and the unit's own hash matches, so the unit was generated from exactly
   these sources and not edited since; and
2. erasing the unit's types with TypeScript's own transpiler, dropping the
   bridge's prelude, and undoing the two documented rewrites (`int32(e)` back
   to `e | 0`, `x__n` back to `x$n`) yields function declarations that print
   identically to those in `Module.res.mjs`.

Every compiled function must appear in the unit: one without a @genType
signature is reported as unverified, not silently ignored.
*/

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import ts from "typescript";
import { isPreludeName } from "./res2ls-bridge.mjs";

/** Returns the hex SHA-256 digest of `text`. */
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/**
 * Returns a transform that reverses the bridge's two rewrites: `int32(e)` back
 * to `e | 0`, and `x__n` back to `x$n`.
 */
function undoRewrites(context) {
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "int32" &&
      node.arguments.length === 1
    ) {
      return ts.factory.createBinaryExpression(
        ts.visitNode(node.arguments[0], visit),
        ts.SyntaxKind.BarToken,
        ts.factory.createNumericLiteral(0),
      );
    }
    // The bridge refuses production names containing `__`, so every `__n`
    // here is one of its own `$n` rewrites.
    if (ts.isIdentifier(node) && /__\d+$/.test(node.text)) {
      return ts.factory.createIdentifier(node.text.replace(/__(\d+)$/, "$$$1"));
    }
    return ts.visitEachChild(node, visit, context);
  };
  return (node) => ts.visitNode(node, visit);
}

/** Prints each non-prelude function declaration, comments removed. */
export function printedFunctions(source, fileName, undo) {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const [out] = ts.transform(sf, undo ? [undoRewrites] : []).transformed;
  const printer = ts.createPrinter({ removeComments: true });
  return new Map(
    out.statements
      .filter(
        (st) =>
          ts.isFunctionDeclaration(st) &&
          st.name &&
          !isPreludeName(st.name.text),
      )
      .map((st) => [
        st.name.text,
        printer.printNode(ts.EmitHint.Unspecified, st, out),
      ]),
  );
}

/** Compares a unit's text with production JavaScript; returns problems. */
export function compareUnit(unitText, productionJs) {
  const erased = ts.transpileModule(unitText, {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
  const unit = printedFunctions(erased, "unit.js", true);
  const production = printedFunctions(productionJs, "production.js", false);
  const problems = [];
  const identical = [];
  for (const name of new Set([...unit.keys(), ...production.keys()])) {
    if (!production.has(name)) {
      problems.push(`${name} is in the unit but not in production`);
    } else if (!unit.has(name)) {
      problems.push(`${name} is in production but was not verified`);
    } else if (unit.get(name) === production.get(name)) {
      identical.push(name);
    } else {
      problems.push(`${name} differs from production`);
    }
  }
  return { identical, problems };
}

/**
 * Checks a generated unit against its manifest and the production JavaScript.
 * Returns the functions that match production and any problems found.
 */
export function correspond(resPath, outDir) {
  const moduleName = basename(resPath, ".res");
  const sourceDir = dirname(resPath);
  const manifest = JSON.parse(
    readFileSync(join(outDir, `${moduleName}.manifest.json`), "utf8"),
  );
  const problems = [];
  for (const [file, hash] of Object.entries(manifest.inputs)) {
    if (sha256(readFileSync(join(sourceDir, file), "utf8")) !== hash) {
      problems.push(`${file} changed after the unit was generated`);
    }
  }
  const unitText = readFileSync(join(outDir, `${moduleName}.ts`), "utf8");
  if (sha256(unitText) !== manifest.unit[`${moduleName}.ts`]) {
    problems.push(`${moduleName}.ts was edited after generation`);
  }
  const productionJs = readFileSync(
    join(sourceDir, `${moduleName}.res.mjs`),
    "utf8",
  );
  const compared = compareUnit(unitText, productionJs);
  return {
    identical: compared.identical,
    problems: [...problems, ...compared.problems],
  };
}

if (import.meta.main) {
  const [resPath, outDir] = process.argv.slice(2);
  if (!resPath || !outDir) {
    console.error("usage: bun res2ls-correspond.mjs <Module.res> <out-dir>");
    process.exit(2);
  }
  const { identical, problems } = correspond(resPath, outDir);
  console.log(`identical to production: ${identical.join(", ") || "none"}`);
  for (const problem of problems) {
    console.log(`MISMATCH: ${problem}`);
  }
  process.exit(problems.length > 0 ? 1 : 0);
}
