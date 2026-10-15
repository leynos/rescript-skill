/**
@file Makefile contracts: gate order, suite selection, and the manifest gate.

The `all` target must run its gates sequentially and stop at the first failure
even under `make -j`, so a parallel run cannot hide a broken gate behind an
unrelated success. No target may list two prerequisites, which `make -j` would
run at once against the shared build and tool caches. The test target must name every ReScript suite from its
source, so a suite cannot silently drop out of the run. The manifest gate must
reject unusable manifests, including one that a conformant skill sorted after
it would otherwise mask in a shell loop.

The manifest cases call the real `yamllint` and `skills-ref` through
`uv tool run`, so the first run needs network access to populate the cache.
*/

import { describe, expect, test } from "bun:test";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { REPO_ROOT } from "./support/catalogue.mjs";

const makefile = readFileSync(join(REPO_ROOT, "Makefile"), "utf8");

function make(args, env = {}) {
  const result = Bun.spawnSync(["make", "--no-print-directory", ...args], {
    cwd: REPO_ROOT,
    env: { ...process.env, ...env },
  });
  return {
    exitCode: result.exitCode,
    output: result.stdout.toString() + result.stderr.toString(),
  };
}

function withScratch(prefix, body) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  try {
    return body(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("gate ordering", () => {
  const gates = ["check-fmt", "lint", "test", "spelling"];

  test("make -j all runs sequential gates and stops on failure", () => {
    withScratch("rescript-skill-make-", (directory) => {
      const probe = join(directory, "probe.sh");
      const log = join(directory, "gates.log");
      writeFileSync(
        probe,
        '#!/bin/bash\nprintf "%s\\n" "$1" >> "$GATE_LOG"\nif [ "$1" = "$FAIL_GATE" ]; then exit 1; fi\n',
        { mode: 0o755 },
      );
      for (const failOn of ["", "lint", "spelling"]) {
        writeFileSync(log, "");
        const result = make(["-j8", "all", `MAKE=${probe}`], {
          GATE_LOG: log,
          FAIL_GATE: failOn,
        });
        expect(result.exitCode === 0).toBe(failOn === "");
        const expected = failOn
          ? gates.slice(0, gates.indexOf(failOn) + 1)
          : gates;
        expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(expected);
      }
    });
  });
});

describe("sequential composition", () => {
  /** Returns each rule's name and prerequisites, skipping special targets. */
  function rules(text) {
    return [...text.matchAll(/^([a-z][\w-]*):(?!=)([^#\n]*)/gm)].map(
      ([, name, deps]) => ({
        name,
        deps: deps.trim().split(/\s+/).filter(Boolean),
      }),
    );
  }

  test("no target lists more than one prerequisite", () => {
    const parallel = rules(makefile).filter(({ deps }) => deps.length > 1);
    expect(parallel).toEqual([]);
  });

  test("the rule reader sees a target with two prerequisites", () => {
    expect(rules("a: b c ## both\nd: e\nX := y\n")).toEqual([
      { name: "a", deps: ["b", "c"] },
      { name: "d", deps: ["e"] },
    ]);
  });

  test("make -j runs the manifest checks in order and stops on failure", () => {
    withScratch("rescript-skill-make-", (directory) => {
      const probe = join(directory, "probe.sh");
      const log = join(directory, "steps.log");
      writeFileSync(
        probe,
        '#!/bin/bash\nprintf "%s\\n" "$1" >> "$GATE_LOG"\nif [ "$1" = "$FAIL_GATE" ]; then exit 1; fi\n',
        { mode: 0o755 },
      );
      const steps = ["skill-frontmatter-lint", "skill-manifest-validate"];
      for (const failOn of ["", steps[0]]) {
        writeFileSync(log, "");
        const result = make(["-j8", "skill-manifest-check", `MAKE=${probe}`], {
          GATE_LOG: log,
          FAIL_GATE: failOn,
        });
        expect(result.exitCode === 0).toBe(failOn === "");
        expect(readFileSync(log, "utf8").trim().split("\n")).toEqual(
          failOn ? [failOn] : steps,
        );
      }
    });
  });
});

describe("suite selection", () => {
  test("make test names every ReScript and JavaScript suite", () => {
    const dryRun = make(["-n", "test", "MAKE=true"]);
    expect(dryRun.exitCode).toBe(0);
    const tests = readdirSync(join(REPO_ROOT, "tests"));
    const resSuites = tests.filter((name) => name.endsWith(".test.res"));
    const jsSuites = tests.filter((name) => name.endsWith(".test.mjs"));
    expect(resSuites.length).toBeGreaterThan(0);
    for (const suite of resSuites) {
      expect(dryRun.output).toContain(`./tests/${suite}.mjs`);
    }
    for (const suite of jsSuites) {
      expect(dryRun.output).toContain(`./tests/${suite}`);
    }
  });
});

describe("environment defaults", () => {
  test("uv cache and tool directories are overridable defaults", () => {
    expect(makefile).toMatch(/^UV_CACHE_DIR \?= \.uv-cache$/m);
    expect(makefile).toMatch(/^UV_TOOL_DIR \?= \.uv-tools$/m);
    expect(makefile).toContain("UV_CACHE_DIR=$(UV_CACHE_DIR)");
  });

  test("third-party tools are pinned to immutable versions", () => {
    expect(makefile).toMatch(/typos-config-builder\.git@[0-9a-f]{40}/);
    expect(makefile).toMatch(/agentskills\.git@[0-9a-f]{40}/);
    expect(makefile).toMatch(/yamllint==\d+\.\d+\.\d+/);
  });
});

describe("skill manifest gate", () => {
  const fixture = (root, name, body) => {
    const directory = join(root, name);
    mkdirSync(directory);
    writeFileSync(join(directory, "SKILL.md"), body);
    return `${directory}/`;
  };
  const check = (...dirs) =>
    make(["skill-manifest-check", `SKILL_DIRS=${dirs.join(" ")}`]);

  test("accepts a conformant manifest", () => {
    withScratch("rescript-skill-manifest-", (root) => {
      const valid = fixture(
        root,
        "a-valid",
        "---\nname: a-valid\ndescription: A conformant fixture skill.\n---\n\n# Valid\n",
      );
      const result = check(valid);
      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("Valid skill:");
    });
  });

  test.each([
    [
      "missing-name",
      "description: A fixture that lacks the required name.\n",
      "Missing required field in frontmatter: name",
    ],
    [
      "empty-description",
      'name: empty-description\ndescription: ""\n',
      "Field 'description' must be a non-empty string",
    ],
    [
      "list-description",
      "name: list-description\ndescription:\n  - one\n  - two\n",
      "Field 'description' must be a non-empty string",
    ],
  ])("rejects %s", (name, frontmatter, expected) => {
    withScratch("rescript-skill-manifest-", (root) => {
      const result = check(
        fixture(root, name, `---\n${frontmatter}---\n\n# Fixture\n`),
      );
      expect(result.exitCode).not.toBe(0);
      expect(result.output).toContain(expected);
    });
  });

  test("a trailing conformant skill cannot mask malformed YAML", () => {
    withScratch("rescript-skill-manifest-", (root) => {
      const broken = fixture(
        root,
        "a-broken",
        "---\nname: [unclosed\n---\n\n# Broken\n",
      );
      const valid = fixture(
        root,
        "z-valid",
        "---\nname: z-valid\ndescription: A conformant trailing fixture.\n---\n\n# Valid\n",
      );
      const result = check(broken, valid);
      expect(result.exitCode).not.toBe(0);
      expect(result.output).toContain("syntax error");
    });
  });
});

describe("skill installation", () => {
  test("install-skills copies committed files only", () => {
    const dryRun = make([
      "-n",
      "install-skills",
      "SKILLS_DEST=/tmp/skills-dest",
    ]);
    expect(dryRun.exitCode).toBe(0);
    expect(dryRun.output).toContain("git archive --format=tar HEAD skills");
    expect(dryRun.output).toContain(
      'tar -x -C "/tmp/skills-dest" --strip-components=1',
    );
  });

  test("generated JavaScript is ignored and never tracked under skills/", () => {
    const tracked = Bun.spawnSync(["git", "ls-files", "--", "*.res.mjs"], {
      cwd: REPO_ROOT,
    });
    expect(tracked.stdout.toString()).toBe("");
    const ignored = Bun.spawnSync(
      ["git", "check-ignore", "-q", "skills/x/references/examples/X.res.mjs"],
      { cwd: REPO_ROOT },
    );
    expect(ignored.exitCode).toBe(0);
  });
});
