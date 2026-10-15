/**
@file Translation check for VerifiedLease, run by `make prove`: the Dafny that
LemmaScript generated, compiled back to JavaScript by `dafny translate js`,
must agree with the production `step` the ReScript compiler emitted.

  bun VerifiedLease.differential.mjs <VerifiedLease.js> <package-dir> [count]

`<package-dir>` is where `bignumber.js`, which Dafny's JavaScript runtime
needs, is installed. Agreement on many inputs is evidence, not proof, that the
translation to Dafny kept the meaning of the code the proof is about; it
narrows the trust placed in LemmaScript rather than removing it. The inputs
are the proof's domain: well-typed values with int32 fields and a
non-negative handle count, weighted towards the boundaries.
*/

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { step as productionStep } from "./VerifiedLease.res.mjs";

/** Loads Dafny's CommonJS output, resolving `require` from `packageDir`. */
function loadDafny(path, packageDir) {
  const require = createRequire(join(resolve(packageDir), "package.json"));
  const source = `${readFileSync(path, "utf8")}\nmodule.exports = { _module, _dafny };`;
  const mod = { exports: {} };
  new Function("module", "exports", "require", source)(
    mod,
    mod.exports,
    require,
  );
  return { ...mod.exports, BigNumber: require("bignumber.js") };
}

/** Converts production values to the Dafny datatypes they correspond to. */
function converters({ _module: D, _dafny, BigNumber }) {
  const str = (s) => _dafny.Seq.UnicodeFromString(s);
  const int = (n) => new BigNumber(n);
  const cause = (c) =>
    ({
      normal: () => D.cause.create_normal(int(c.code)),
      timeout: () => D.cause.create_timeout(int(c.afterMs)),
      failed: () => D.cause.create_failed(str(c.message)),
    })[c.TAG]();
  const state = (s) =>
    ({
      idle: () => D.state.create_idle(int(s.generation)),
      held: () =>
        D.state.create_held(int(s.generation), str(s.owner), int(s.handles)),
      released: () =>
        D.state.create_released(int(s.generation), cause(s.cause)),
    })[s.kind]();
  const event = (e) =>
    ({
      acquire: () => D.event.create_acquire(str(e.owner)),
      open: () => D.event.create_open(str(e.by)),
      close: () => D.event.create_close(str(e.by)),
      release: () => D.event.create_release(str(e.by), cause(e.cause)),
    })[e.kind]();
  const failure = (f) =>
    ({
      notOwner: () => D.failure.create_notOwner(str(f.by)),
      noHandles: () => D.failure.create_noHandles(int(f.generation)),
      alreadyReleased: () => D.failure.create_alreadyReleased(cause(f.cause)),
      invalid: () => D.failure.create_invalid(int(f.generation)),
      tooManyHandles: () => D.failure.create_tooManyHandles(int(f.generation)),
    })[f.kind]();
  const outcome = (o) =>
    o.kind === "ok"
      ? D.outcome.create_ok(state(o.state))
      : D.outcome.create_error(failure(o.failure));
  return { str, int, state, event, outcome };
}

/** A deterministic xorshift generator of well-typed lease inputs. */
function inputs(seed = 0x2545f491) {
  let s = seed;
  const next = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return s >>> 0;
  };
  const pick = (xs) => xs[next() % xs.length];
  const edges = [0, 1, 2, 999_999, 1_000_000, 1_000_001, 2 ** 31 - 1];
  const i32 = () => pick([...edges, -1, -(2 ** 31), next() | 0]);
  const nat32 = () => pick([...edges, 2 ** 31 - 2, next() >>> 1]);
  const who = () => pick(["a", "b", "", "é", "a\u0000"]);
  const cause = () =>
    pick([
      () => ({ TAG: "normal", code: i32() }),
      () => ({ TAG: "timeout", afterMs: i32() }),
      () => ({ TAG: "failed", message: who() }),
    ])();
  const state = () =>
    pick([
      () => ({ kind: "idle", generation: i32() }),
      () => ({
        kind: "held",
        generation: i32(),
        owner: who(),
        handles: nat32(),
      }),
      () => ({ kind: "released", generation: i32(), cause: cause() }),
    ])();
  const event = () =>
    pick([
      () => ({ kind: "acquire", owner: who() }),
      () => ({ kind: "open", by: who() }),
      () => ({ kind: "close", by: who() }),
      () => ({ kind: "release", by: who(), cause: cause() }),
    ])();
  return () => [state(), event()];
}

if (import.meta.main) {
  const [dafnyJs, packageDir, countArg = "200000"] = process.argv.slice(2);
  if (!dafnyJs || !packageDir) {
    console.error(
      "usage: bun VerifiedLease.differential.mjs <VerifiedLease.js> <package-dir> [count]",
    );
    process.exit(2);
  }
  const dafny = loadDafny(dafnyJs, packageDir);
  const { _module: D, _dafny } = dafny;
  const to = converters(dafny);
  const agree = (s, e, actual) =>
    _dafny.areEqual(to.outcome(productionStep(s, e)), actual);

  // Negative control: the comparison must be able to tell outcomes apart.
  const held = { kind: "held", generation: 1, owner: "a", handles: 0 };
  const wrong = D.outcome.create_ok(
    D.state.create_held(to.int(1), to.str("a"), to.int(2)),
  );
  if (agree(held, { kind: "open", by: "a" }, wrong)) {
    console.error("negative control failed: a wrong outcome compared equal");
    process.exit(1);
  }

  const count = Number(countArg);
  // Zero comparisons would print success having checked nothing.
  if (!Number.isSafeInteger(count) || count < 1) {
    console.error(`count must be a positive integer, got ${countArg}`);
    process.exit(2);
  }
  const sample = inputs();
  for (let i = 0; i < count; i++) {
    const [s, e] = sample();
    const actual = D.__default.step(to.state(s), to.event(e));
    if (!agree(s, e, actual)) {
      console.error(
        `disagree on ${JSON.stringify([s, e])}: production ${JSON.stringify(productionStep(s, e))}, Dafny ${actual}`,
      );
      process.exit(1);
    }
  }
  console.log(`Dafny-compiled step agrees with production on ${count} inputs`);
}
