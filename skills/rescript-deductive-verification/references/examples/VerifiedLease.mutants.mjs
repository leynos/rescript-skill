/**
@file Mutants of the compiled VerifiedLease.res.mjs, run by `make prove` through
res2ls-mutate.mjs. Each breaks one behaviour of `step`, and `breaks` lists a
fragment of every contract that must then fail, and no other. A contract no
mutant breaks would be unchecked; together these break all twelve.

Dafny assumes a postcondition after reporting it, so on one return path only
the first failing contract in source order is reported; a later one that the
same edit also breaks is masked. `released-reopens` therefore reports nothing
about the cause, and `open-unbounded` nothing about the count, and each masked
contract has a mutant of its own.
*/

const WELL_FORMED = "==> wellFormed(result.state)";
const GENERATION = "generationOf(result.state)";
const OWNER_ONLY = "!isOwner(state, event.by)";
const RELEASED_REFUSES = "state.kind === 'released' ==> result.kind";
const RELEASED_KEEPS_CAUSE = "result.failure.cause === state.cause";
const RELEASE_STORES_CAUSE = "result.state.cause === event.cause";
const OPEN_EFFECT = "state.handles + 1";
const CLOSE_EFFECT = "state.handles - 1";
const ACQUIRE_PROGRESS = "state.kind === 'idle' && event.kind === 'acquire'";
const OPEN_PROGRESS = "state.handles < 1000000";
const CLOSE_PROGRESS = "state.handles > 0";
const RELEASE_PROGRESS = "event.kind === 'release' && event.by === state.owner";

export default [
  {
    name: "release-drops-cause",
    breaks: [RELEASE_STORES_CAUSE],
    edits: [
      { old: "cause: event.cause", new: 'cause: {TAG: "normal", code: 0}' },
    ],
  },
  {
    name: "released-reopens",
    breaks: [OWNER_ONLY, RELEASED_REFUSES],
    edits: [
      {
        old: 'kind: "error",\n        failure: {\n          kind: "alreadyReleased",\n          cause: state.cause\n        }',
        new: 'kind: "ok",\n        state: {\n          kind: "idle",\n          generation: state.generation\n        }',
      },
    ],
  },
  {
    name: "released-replaces-cause",
    breaks: [RELEASED_KEEPS_CAUSE],
    edits: [
      { old: "cause: state.cause", new: 'cause: {TAG: "timeout", afterMs: 0}' },
    ],
  },
  {
    name: "non-owner-closes",
    breaks: [OWNER_ONLY],
    edits: [{ old: "if (by$1 !== owner)", new: "if (false)" }],
  },
  {
    name: "acquire-bumps-generation",
    breaks: [GENERATION],
    edits: [
      {
        old: "generation: state.generation,\n            owner: event.owner",
        new: "generation: state.generation + 1 | 0,\n            owner: event.owner",
      },
    ],
  },
  {
    // The handle bound can never trigger, so `handles + 1 | 0` wraps.
    name: "open-unbounded",
    breaks: [WELL_FORMED],
    edits: [{ old: "handles >= 1000000", new: "handles > 2147483647" }],
  },
  {
    name: "open-keeps-count",
    breaks: [OPEN_EFFECT],
    edits: [{ old: "handles: handles + 1 | 0", new: "handles: handles" }],
  },
  {
    name: "open-drops-owner",
    breaks: [OPEN_EFFECT],
    edits: [
      {
        old: "owner: owner,\n                handles: handles + 1 | 0",
        new: 'owner: "",\n                handles: handles + 1 | 0',
      },
    ],
  },
  {
    name: "close-drops-two",
    breaks: [WELL_FORMED, CLOSE_EFFECT],
    edits: [{ old: "handles - 1 | 0", new: "handles - 2 | 0" }],
  },
  {
    name: "open-refuses-early",
    breaks: [OPEN_PROGRESS],
    edits: [{ old: "handles >= 1000000", new: "handles >= 999999" }],
  },
  {
    name: "close-refuses-last",
    breaks: [CLOSE_PROGRESS],
    edits: [{ old: "handles === 0", new: "handles <= 1" }],
  },
  {
    name: "release-refuses-owner",
    breaks: [RELEASE_PROGRESS],
    edits: [{ old: "if (by$2 !== owner)", new: "if (true)" }],
  },
  {
    // Safety contracts alone admit a function that refuses everything.
    name: "refuses-everything",
    breaks: [
      RELEASED_KEEPS_CAUSE,
      ACQUIRE_PROGRESS,
      OPEN_PROGRESS,
      CLOSE_PROGRESS,
      RELEASE_PROGRESS,
    ],
    edits: [
      {
        old: "function step(state, event) {",
        new: 'function step(state, event) {\n  return {\n    kind: "error",\n    failure: {\n      kind: "invalid",\n      generation: 0\n    }\n  };',
      },
    ],
  },
];
