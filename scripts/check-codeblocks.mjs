/**
Formatting and syntax gate for ReScript code fences in Markdown.

Each fence whose info string starts with `rescript`, `res`, or `resi` is piped
through `rescript format --stdin .res` (or `.resi`), which exits non-zero on a
syntax error. A fence that parses but differs from its canonical form fails
`--check` and is rewritten in place by `--write`. Only fence bodies are ever
rewritten; surrounding prose is untouched.

`rescript-tools format-codeblocks` is deliberately not used: in ReScript
12.3.1 it reprints the whole Markdown document, escaping table pipes, emphasis
characters, and frontmatter, and it exits 0 on syntax errors.

Usage: `bun scripts/check-codeblocks.mjs --check|--write [file.md ...]`. With
no files it selects the Markdown files Git tracks plus untracked files Git does
not ignore, matching the `mdtablefix --git --include-untracked` selection.
*/

import { readFileSync, writeFileSync } from "node:fs";

const OPENING = /^(?<indent>[ \t]*)(?<marker>`{3,}|~{3,})(?<info>[^\n`]*)$/;
const RESCRIPT_INFO = /^(rescript|res|resi)(\s|$)/;

/**
 * Finds fenced code blocks in Markdown text.
 *
 * Returns `{info, indent, start, end, body}` per fence, where `start` and
 * `end` are the line indices of the opening and closing fence lines and
 * `body` has the opening fence's indentation removed from every line.
 */
export function findFences(text) {
  const lines = text.split("\n");
  const fences = [];
  for (let index = 0; index < lines.length; index += 1) {
    const opening = OPENING.exec(lines[index]);
    if (!opening) {
      continue;
    }
    const { indent, marker } = opening.groups;
    const closing = new RegExp(`^[ \\t]*${marker[0]}{${marker.length},}\\s*$`);
    let end = index + 1;
    while (end < lines.length && !closing.test(lines[end])) {
      end += 1;
    }
    const body = lines
      .slice(index + 1, end)
      .map((line) =>
        line.startsWith(indent) ? line.slice(indent.length) : line,
      )
      .join("\n");
    fences.push({
      info: opening.groups.info.trim(),
      indent,
      start: index,
      end,
      body,
    });
    index = end;
  }
  return fences;
}

/** Returns the formatter extension for a fence, or `null` for other languages. */
export function extensionFor(info) {
  const match = RESCRIPT_INFO.exec(info);
  if (!match) {
    return null;
  }
  return match[1] === "resi" ? ".resi" : ".res";
}

function formatSource(body, extension) {
  const result = Bun.spawnSync(
    [
      process.execPath,
      "run",
      "--bun",
      "rescript",
      "format",
      "--stdin",
      extension,
    ],
    { stdin: new TextEncoder().encode(`${body}\n`) },
  );
  return {
    ok: result.exitCode === 0,
    output: result.stdout.toString(),
    error: result.stderr.toString(),
  };
}

/**
 * Checks one Markdown document and returns its problems plus the text it
 * would have after formatting every ReScript fence.
 */
export function checkDocument(path, text, format = formatSource) {
  const lines = text.split("\n");
  const problems = [];
  const fences = findFences(text);
  for (const fence of fences.reverse()) {
    const extension = extensionFor(fence.info);
    if (extension === null) {
      continue;
    }
    if (fence.end >= lines.length) {
      problems.push({
        kind: "broken",
        line: fence.start + 1,
        detail: "unterminated fence",
      });
      continue;
    }
    const formatted = format(fence.body, extension);
    if (!formatted.ok) {
      problems.push({
        kind: "broken",
        line: fence.start + 1,
        detail: formatted.error.trim(),
      });
      continue;
    }
    const canonical = formatted.output.replace(/\n+$/, "");
    if (canonical !== fence.body.replace(/\n+$/, "")) {
      problems.push({
        kind: "unformatted",
        line: fence.start + 1,
        detail: "not canonical",
      });
      const replacement = canonical
        .split("\n")
        .map((line) => (line === "" ? "" : fence.indent + line));
      lines.splice(
        fence.start + 1,
        fence.end - fence.start - 1,
        ...replacement,
      );
    }
  }
  return { problems: problems.reverse(), formatted: lines.join("\n"), path };
}

function selectMarkdown() {
  const listed = Bun.spawnSync([
    "git",
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
    "--",
    "*.md",
  ]);
  if (listed.exitCode !== 0) {
    throw new Error(`git ls-files failed: ${listed.stderr.toString()}`);
  }
  return listed.stdout
    .toString()
    .split("\0")
    .filter((path) => path !== "");
}

function main(argv) {
  const mode = argv[0];
  if (mode !== "--check" && mode !== "--write") {
    console.error("usage: check-codeblocks.mjs --check|--write [file.md ...]");
    return 2;
  }
  const files = argv.length > 1 ? argv.slice(1) : selectMarkdown();
  let failures = 0;
  for (const path of files) {
    const text = readFileSync(path, "utf8");
    const { problems, formatted } = checkDocument(path, text);
    const broken = problems.filter((problem) => problem.kind === "broken");
    const unformatted = problems.filter(
      (problem) => problem.kind === "unformatted",
    );
    for (const problem of broken) {
      console.error(
        `${path}:${problem.line}: ReScript fence does not parse\n${problem.detail}`,
      );
    }
    if (mode === "--write" && unformatted.length > 0) {
      writeFileSync(path, formatted);
    } else {
      for (const problem of unformatted) {
        console.error(
          `${path}:${problem.line}: ReScript fence is not canonically formatted`,
        );
      }
    }
    failures += broken.length + (mode === "--check" ? unformatted.length : 0);
  }
  if (failures > 0) {
    console.error(
      `${failures} ReScript fence(s) failed the Markdown fence gate`,
    );
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main(process.argv.slice(2)));
}
