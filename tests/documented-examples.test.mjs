/**
@file Every fenced example in a user-facing document is a contract.

The README and the users' guide are loaded as published, through the shared
loader, and each marked example is exercised by the handler registered under
its identifier: install commands run against a scratch home directory and
must install the committed catalogue there, and agent prompts must name
skills that exist. An example without a handler, or a handler without an
example, fails the suite, so documentation and tests cannot drift apart.
*/

import { describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT, ROUTER, skillNames } from "./support/catalogue.mjs";
import { testedExamples } from "./support/tested-examples.mjs";

const DOCUMENTS = ["README.md", "docs/users-guide.md"];
const SKILLS = skillNames();

/** Runs `command` and asserts it installed every shipped skill under `dir`. */
function expectInstalls(command, dir) {
  const home = mkdtempSync(join(tmpdir(), "rescript-skill-home-"));
  try {
    const env = { ...process.env, HOME: home };
    delete env.SKILLS_DEST;
    const run = Bun.spawnSync(["bash", "-c", command], {
      cwd: REPO_ROOT,
      env,
    });
    expect({ exitCode: run.exitCode, stderr: run.stderr.toString() }).toEqual({
      exitCode: 0,
      stderr: "",
    });
    const installed = SKILLS.filter((skill) =>
      existsSync(join(home, dir, skill, "SKILL.md")),
    );
    expect(installed).toEqual(SKILLS);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

/** Asserts a prompt names only shipped skills, and returns the names. */
function namedSkills(body) {
  const names = [...body.matchAll(/\$([a-z0-9-]+)/g)].map((m) => m[1]);
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) {
    expect(SKILLS).toContain(name);
  }
  return names;
}

/** Asserts a plaintext prompt names only the router skill. */
const routerPrompt = (example) => {
  expect(example.info).toBe("plaintext");
  expect(namedSkills(example.body)).toEqual([ROUTER]);
};

/**
 * Asserts a plaintext prompt names exactly one shipped skill, which is not the
 * router.
 */
const directPrompt = (example) => {
  expect(example.info).toBe("plaintext");
  const names = namedSkills(example.body);
  expect(names).toHaveLength(1);
  expect(names[0]).not.toBe(ROUTER);
};

const HANDLERS = {
  "README.md": {
    "install-from-clone": (example) => {
      expect(example.info).toBe("bash");
      const [clone, cd, install, ...rest] = example.body.split("\n");
      expect(rest).toEqual([]);
      // The clone itself needs the network; check it names this repository.
      const repository = JSON.parse(
        readFileSync(join(REPO_ROOT, "package.json"), "utf8"),
      ).repository.url.replace(/^git\+/, "");
      expect(clone).toBe(`git clone ${repository}`);
      expect(cd).toBe(
        `cd ${repository
          .split("/")
          .at(-1)
          .replace(/\.git$/, "")}`,
      );
      expect(install).toBe("make install-skills");
      expectInstalls(install, ".codex/skills");
    },
    "prompt-router": routerPrompt,
    "prompt-direct": directPrompt,
  },
  "docs/users-guide.md": {
    "install-default": (example) => {
      expect(example.info).toBe("bash");
      expect(example.body).toBe("make install-skills");
      expectInstalls(example.body, ".codex/skills");
    },
    "install-elsewhere": (example) => {
      expect(example.info).toBe("bash");
      expect(example.body).toBe(
        "make install-skills SKILLS_DEST=~/.claude/skills",
      );
      expectInstalls(example.body, ".claude/skills");
    },
    "prompt-router": routerPrompt,
    "prompt-direct": directPrompt,
  },
};

describe.each(DOCUMENTS)("tested examples in %s", (document) => {
  const examples = testedExamples(
    readFileSync(join(REPO_ROOT, document), "utf8"),
    document,
  );
  const handlers = HANDLERS[document];

  test("every example has a handler, and every handler an example", () => {
    expect(examples.map((e) => e.id).sort()).toEqual(
      Object.keys(handlers).sort(),
    );
  });

  test.each(examples.map((example) => [example.id, example]))(
    "%s",
    (_, example) => {
      handlers[example.id](example);
    },
  );
});

describe("the tested-example loader", () => {
  const marked = (id, body = "x") =>
    `<!-- tested-example: ${id} -->\n\n\`\`\`plaintext\n${body}\n\`\`\`\n`;

  test("reads identifiers, info strings, bodies, and fence lines", () => {
    const doc = `Intro.\n\n${marked("one", "a\nb")}\nText.\n\n${marked("two")}`;
    expect(testedExamples(doc)).toEqual([
      { id: "one", info: "plaintext", body: "a\nb", line: 5 },
      { id: "two", info: "plaintext", body: "x", line: 14 },
    ]);
  });

  test("keeps a longer fence open across shorter ones", () => {
    const doc =
      "<!-- tested-example: outer -->\n````markdown\n```bash\nls\n```\n````\n";
    expect(testedExamples(doc)[0].body).toBe("```bash\nls\n```");
  });

  test.each([
    ["an unmarked fence", "```bash\nls\n```\n", /no tested-example marker/],
    [
      "an unterminated fence",
      "<!-- tested-example: open -->\n```bash\nls\n",
      /never closed/,
    ],
    [
      "a missing identifier",
      "<!-- tested-example: -->\n```bash\nls\n```\n",
      /missing or malformed identifier/,
    ],
    [
      "a malformed identifier",
      "<!-- tested-example: Not Kebab -->\n```bash\nls\n```\n",
      /missing or malformed identifier/,
    ],
    [
      "a marker followed by prose",
      "<!-- tested-example: lost -->\nProse.\n```bash\nls\n```\n",
      /"lost" has no fence after it/,
    ],
    [
      "a marker at the end of the document",
      "Text.\n<!-- tested-example: last -->\n",
      /"last" has no fence after it/,
    ],
    [
      "a duplicate identifier",
      `${marked("same")}\n${marked("same")}`,
      /duplicate identifier "same"/,
    ],
  ])("rejects %s", (_, doc, message) => {
    expect(() => testedExamples(doc)).toThrow(message);
  });
});
