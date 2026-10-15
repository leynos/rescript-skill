/**
@file Catalogue inventory helpers shared only by the repository contract suites.

They read the shipped skill tree the way a strict Agent Skills loader would:
the frontmatter is parsed as YAML rather than matched as text, so assertions
inspect values instead of formatting. Each helper throws on malformed input
instead of returning a partial answer, so a contract cannot pass because a
helper silently skipped something.
*/

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";

export const REPO_ROOT = resolve(import.meta.dir, "..", "..");
export const SKILLS_ROOT = join(REPO_ROOT, "skills");
export const ROUTER = "rescript-router";

/** Lists every shipped skill directory name, sorted. */
export function skillNames(root = SKILLS_ROOT) {
  return readdirSync(root)
    .filter((name) => existsSync(join(root, name, "SKILL.md")))
    .sort();
}

/** Parses the YAML frontmatter block that opens a `SKILL.md`. */
export function frontmatter(text, label = "manifest") {
  const lines = text.split("\n");
  if (lines[0] !== "---") {
    throw new Error(`${label} does not open with a frontmatter fence`);
  }
  const closing = lines.indexOf("---", 1);
  if (closing === -1) {
    throw new Error(`${label} has no closing frontmatter fence`);
  }
  const parsed = parse(lines.slice(1, closing).join("\n"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} frontmatter is not a mapping`);
  }
  return parsed;
}

/** Reads and parses one shipped skill's manifest. */
export function manifest(skill, root = SKILLS_ROOT) {
  const path = join(root, skill, "SKILL.md");
  return frontmatter(readFileSync(path, "utf8"), path);
}

/** Reads a skill's `agents/openai.yaml` policy, or `null` when absent. */
export function openaiPolicy(skillDir) {
  const path = join(skillDir, "agents", "openai.yaml");
  if (!existsSync(path)) {
    return null;
  }
  const parsed = parse(readFileSync(path, "utf8"));
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} is not a YAML mapping`);
  }
  if (
    parsed.policy === null ||
    typeof parsed.policy !== "object" ||
    Array.isArray(parsed.policy)
  ) {
    throw new Error(`${path} carries no policy mapping`);
  }
  return parsed.policy;
}

/** Recursively lists files under `dir` whose names satisfy `accept`. */
export function walk(dir, accept) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...walk(path, accept));
    } else if (accept(entry)) {
      found.push(path);
    }
  }
  return found.sort();
}

const INLINE_LINK = /\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Returns the relative link targets in a Markdown document, skipping
 * external URLs, in-page anchors, and anything inside fenced code.
 */
export function relativeLinks(markdown) {
  const prose = markdown.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1\s*$/gm, "");
  const targets = [];
  for (const match of prose.matchAll(INLINE_LINK)) {
    const target = match[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith("#")) {
      continue;
    }
    targets.push(target.split("#")[0]);
  }
  return targets.filter((target) => target !== "");
}

/** Resolves a relative link from the document that contains it. */
export function resolveLink(document, target) {
  return resolve(dirname(document), decodeURIComponent(target));
}

/**
 * Returns the code of a ReScript source with comments and string contents
 * removed, keeping the code inside template interpolations (`${...}`), so a
 * name mentioned only in prose or a literal does not count as code.
 */
export function rescriptCode(source) {
  let out = "";
  const modes = ["code"];
  const braces = [];
  for (let i = 0; i < source.length; i++) {
    const mode = modes.at(-1);
    const char = source[i];
    const next = source[i + 1];
    if (mode === "line") {
      if (char === "\n") {
        modes.pop();
        out += char;
      }
    } else if (mode === "block") {
      if (char === "*" && next === "/") {
        modes.pop();
        i++;
      }
    } else if (mode === "string") {
      if (char === "\\") {
        i++;
      } else if (char === '"') {
        modes.pop();
        out += '""';
      }
    } else if (mode === "template") {
      if (char === "\\") {
        i++;
      } else if (char === "`") {
        modes.pop();
        out += "``";
      } else if (char === "$" && next === "{") {
        modes.push("code");
        braces.push(0);
        out += " ";
        i++;
      }
    } else if (char === "/" && next === "/") {
      modes.push("line");
      i++;
    } else if (char === "/" && next === "*") {
      modes.push("block");
      i++;
    } else if (char === '"') {
      modes.push("string");
    } else if (char === "`") {
      modes.push("template");
    } else if (char === "{" && braces.length > 0) {
      braces[braces.length - 1]++;
      out += char;
    } else if (char === "}" && braces.length > 0 && braces.at(-1) === 0) {
      braces.pop();
      modes.pop();
      out += " ";
    } else {
      if (char === "}" && braces.length > 0) {
        braces[braces.length - 1]--;
      }
      out += char;
    }
  }
  return out;
}

/**
 * True when a ReScript suite uses `module` in code: a qualified access such
 * as `Foo.x` or `->Foo.x`, or one through an alias declared as
 * `module F = Foo`. Comments, strings, and the alias declaration itself do
 * not count.
 */
export function exercisesModule(suite, module) {
  const aliasDeclaration = new RegExp(
    `\\bmodule\\s+([A-Z]\\w*)\\s*=\\s*${module}\\b`,
    "g",
  );
  let code = rescriptCode(suite);
  const aliases = [...code.matchAll(aliasDeclaration)].map((m) => m[1]);
  code = code.replace(aliasDeclaration, "");
  return [module, ...aliases].some((name) =>
    new RegExp(`(?<![\\w.])${name}\\.[A-Za-z_]`).test(code),
  );
}
