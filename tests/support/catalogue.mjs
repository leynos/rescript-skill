/**
Catalogue inventory helpers shared only by the repository contract suites.

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
