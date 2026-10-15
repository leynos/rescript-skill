/**
@file Skill catalogue contracts: manifests, routing reach, links, and examples.

`make skill-manifest-check` validates each manifest against the Agent Skills
schema; this suite owns the catalogue-level invariants the schema cannot see.
Every shipped skill must be reachable from the router, every relative link must
resolve, every reference document must be linked from its skill, and every
ReScript example must be both linked from prose and exercised by a suite, so a
reader never copies an example that no test has run.
*/

import { describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";
import {
  exercisesModule,
  frontmatter,
  manifest,
  openaiPolicy,
  REPO_ROOT,
  ROUTER,
  relativeLinks,
  rescriptCode,
  resolveLink,
  SKILLS_ROOT,
  skillNames,
  walk,
} from "./support/catalogue.mjs";

const SKILLS = skillNames();
const NON_ROUTER = SKILLS.filter((skill) => skill !== ROUTER);
const ALLOWED_KEYS = new Set([
  "name",
  "description",
  "license",
  "allowed-tools",
  "metadata",
  "compatibility",
]);
// rust-skill admits deep dives of about 230 lines; first-class skills should
// stay well inside this so references carry the long comparison material.
const SKILL_LINE_BUDGET = 160;

/** Reads a file as UTF-8 text. */
const read = (path) => readFileSync(path, "utf8");
/** Reads the SKILL.md of `skill` as text. */
const skillDoc = (skill) => read(join(SKILLS_ROOT, skill, "SKILL.md"));

/**
 * Lists the Markdown files the documentation contracts check: those under the
 * skills and docs trees, plus the root README, AGENTS, and CHANGELOG files when
 * present.
 */
function markdownFiles() {
  const roots = [SKILLS_ROOT, join(REPO_ROOT, "docs")];
  const files = roots
    .filter((root) => existsSync(root))
    .flatMap((root) => walk(root, (name) => name.endsWith(".md")));
  for (const name of ["README.md", "AGENTS.md", "CHANGELOG.md"]) {
    const path = join(REPO_ROOT, name);
    if (existsSync(path)) {
      files.push(path);
    }
  }
  return files;
}

/**
 * Lists the ReScript example sources of `skill`, or an empty list when it has
 * none.
 */
function examplesOf(skill) {
  const dir = join(SKILLS_ROOT, skill, "references", "examples");
  return existsSync(dir)
    ? walk(dir, (name) => name.endsWith(".res") || name.endsWith(".resi"))
    : [];
}

describe("catalogue inventory", () => {
  test("ships the router and at least one routed skill", () => {
    expect(SKILLS).toContain(ROUTER);
    expect(NON_ROUTER.length).toBeGreaterThan(0);
  });
});

describe.each(SKILLS)("manifest for %s", (skill) => {
  const data = manifest(skill);

  test("names its own directory", () => {
    expect(data.name).toBe(skill);
  });

  test("carries a usable description", () => {
    expect(typeof data.description).toBe("string");
    expect(data.description.trim().length).toBeGreaterThan(20);
    expect(data.description.length).toBeLessThanOrEqual(1024);
  });

  test("uses only keys the Agent Skills schema admits", () => {
    const disallowed = Object.keys(data).filter(
      (key) => !ALLOWED_KEYS.has(key),
    );
    expect(disallowed).toEqual([]);
  });

  test("keeps metadata a mapping of strings with a globs hint", () => {
    expect(typeof data.metadata).toBe("object");
    expect(Array.isArray(data.metadata)).toBe(false);
    for (const value of Object.values(data.metadata)) {
      expect(typeof value).toBe("string");
    }
    expect(data.metadata.globs).toMatch(/\S/);
  });

  test("stays inside the line budget", () => {
    const lines = skillDoc(skill).split("\n").length;
    expect(lines).toBeLessThanOrEqual(SKILL_LINE_BUDGET);
  });
});

describe("invocation policy", () => {
  test.each(NON_ROUTER)("%s opts out of implicit invocation", (skill) => {
    const policy = openaiPolicy(join(SKILLS_ROOT, skill));
    expect(policy).not.toBeNull();
    expect(policy.allow_implicit_invocation).toBe(false);
  });

  test("the router stays implicitly invocable", () => {
    const policy = openaiPolicy(join(SKILLS_ROOT, ROUTER));
    expect(policy?.allow_implicit_invocation).not.toBe(false);
  });
});

describe("routing reach", () => {
  const router = skillDoc(ROUTER);
  const matrix = read(
    join(SKILLS_ROOT, ROUTER, "references", "routing-matrix.md"),
  );
  const status = read(join(REPO_ROOT, "docs", "skill-catalogue-status.md"));

  test.each(NON_ROUTER)("the router names %s", (skill) => {
    expect(router).toContain(`\`${skill}\``);
  });

  test.each(NON_ROUTER)("the routing matrix names %s", (skill) => {
    expect(matrix).toContain(`\`${skill}\``);
  });

  test.each(SKILLS)("the catalogue status lists %s", (skill) => {
    expect(status).toContain(`\`${skill}\``);
  });
});

describe("links and references", () => {
  test.each(markdownFiles().map((path) => [relative(REPO_ROOT, path), path]))(
    "%s has no broken relative links",
    (_, path) => {
      const missing = relativeLinks(read(path)).filter(
        (target) => !existsSync(resolveLink(path, target)),
      );
      expect(missing).toEqual([]);
    },
  );

  test.each(SKILLS)("every reference document of %s is linked", (skill) => {
    const dir = join(SKILLS_ROOT, skill, "references");
    if (!existsSync(dir)) {
      return;
    }
    const linked = new Set(
      walk(join(SKILLS_ROOT, skill), (name) => name.endsWith(".md")).flatMap(
        (doc) =>
          relativeLinks(read(doc)).map((target) => resolveLink(doc, target)),
      ),
    );
    const orphans = walk(dir, (name) => name.endsWith(".md")).filter(
      (doc) => !linked.has(doc),
    );
    expect(orphans.map((doc) => relative(REPO_ROOT, doc))).toEqual([]);
  });
});

describe("executable examples", () => {
  const suites = walk(join(REPO_ROOT, "tests"), (name) =>
    name.endsWith(".test.res"),
  ).map(read);
  const cases = SKILLS.flatMap((skill) =>
    examplesOf(skill).map((path) => [relative(REPO_ROOT, path), skill, path]),
  );

  test("the catalogue ships executable examples", () => {
    expect(cases.length).toBeGreaterThan(0);
  });

  test.each(cases)("%s is linked from its skill", (_, skill, path) => {
    const linked = walk(join(SKILLS_ROOT, skill), (name) =>
      name.endsWith(".md"),
    ).some((doc) =>
      relativeLinks(read(doc)).some(
        (target) => resolveLink(doc, target) === path,
      ),
    );
    expect(linked).toBe(true);
  });

  test.each(cases.filter(([rel]) => rel.endsWith(".res")))(
    "%s is exercised by a ReScript suite",
    (_, __, path) => {
      const module = basename(path, ".res");
      expect(suites.some((suite) => exercisesModule(suite, module))).toBe(true);
    },
  );

  test.each([
    ["a qualified call", "let x = Foo.make()", true],
    ["a pipe into a qualified function", "let y = 1->Foo.double", true],
    ["a use through an alias", "module F = Foo\nlet x = F.make()", true],
    ["a use inside a template interpolation", "let s = `${Foo.name}`", true],
    ["a comment only", "// Foo.make() is covered elsewhere\nlet x = 1", false],
    ["a block comment only", "/* Foo.make() */\nlet x = 1", false],
    ["a string only", 'let s = "Foo.make()"', false],
    ["an unused alias", "module F = Foo\nlet x = 1", false],
    ["a longer module name", "let x = FooBar.make()", false],
    ["a nested module of another", "let x = Bar.Foo.make()", false],
  ])("the exercise check sees %s", (_, suite, expected) => {
    expect(exercisesModule(suite, "Foo")).toBe(expected);
  });

  test("the code reader keeps interpolations and drops literals", () => {
    expect(rescriptCode('a /* b */ "c" `d${e}f` // g\nh')).toBe(
      'a  ""  e `` \nh',
    );
  });
});

describe("portable cores", () => {
  // Examples named `*Core.res` demonstrate the portable side of a runtime
  // boundary, so they must not reach for Bun or platform bindings.
  const cores = walk(SKILLS_ROOT, (name) => /Core\.resi?$/.test(name));
  const PLATFORM = /RescriptBun|@module\("bun|@module\("node:|@val external/;

  test("the catalogue ships at least one portable core", () => {
    expect(cores.length).toBeGreaterThan(0);
  });

  test.each(cores.map((path) => [relative(REPO_ROOT, path), path]))(
    "%s uses no runtime bindings",
    (_, path) => {
      expect(read(path)).not.toMatch(PLATFORM);
    },
  );

  test("the platform pattern recognizes a Bun binding", () => {
    expect('@module("bun:test") external x: int = "x"').toMatch(PLATFORM);
    expect("open RescriptBun.Globals").toMatch(PLATFORM);
  });
});

describe("helper negative controls", () => {
  test("frontmatter rejects a document without an opening fence", () => {
    expect(() => frontmatter("# Title\n")).toThrow(/does not open/);
  });

  test("frontmatter rejects an unterminated block", () => {
    expect(() => frontmatter("---\nname: x\n")).toThrow(/closing/);
  });

  test("frontmatter rejects a non-mapping block", () => {
    expect(() => frontmatter("---\n- a\n---\n")).toThrow(/mapping/);
  });

  test("relativeLinks ignores URLs, anchors, and fenced code", () => {
    const doc = [
      "[a](https://example.com) [b](#here) [c](local.md#part)",
      "```md",
      "[d](inside-fence.md)",
      "```",
    ].join("\n");
    expect(relativeLinks(doc)).toEqual(["local.md"]);
  });

  test("openaiPolicy distinguishes absent, malformed, and valid files", () => {
    const root = mkdtempSync(join(tmpdir(), "rescript-skill-policy-"));
    try {
      expect(openaiPolicy(root)).toBeNull();
      mkdirSync(join(root, "agents"));
      const config = join(root, "agents", "openai.yaml");
      writeFileSync(config, "policy: false\n");
      expect(() => openaiPolicy(root)).toThrow(/policy mapping/);
      writeFileSync(config, "- allow_implicit_invocation: false\n");
      expect(() => openaiPolicy(root)).toThrow(/YAML mapping/);
      writeFileSync(config, "policy:\n  allow_implicit_invocation: false\n");
      expect(openaiPolicy(root)).toEqual({ allow_implicit_invocation: false });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
