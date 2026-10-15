// A resource lease whose transition function is proved in place: the
// contracts below are discharged by Dafny against the compiled JavaScript.
// `make prove` runs the proof; tests/DeductiveVerification.test.res checks
// the same properties at runtime on chosen examples.

// `@tag` with a payload on every constructor compiles to objects with a
// string discriminant, which the verifier models as a datatype. A constant
// constructor would compile to a bare string and need `typeof`, which it
// cannot model.
@genType
type cause =
  | @as("normal") Normal({code: int})
  | @as("timeout") Timeout({afterMs: int})
  | @as("failed") Failed({message: string})

@genType @tag("kind")
type state =
  | @as("idle") Idle({generation: int})
  | @as("held") Held({generation: int, owner: string, handles: int})
  | @as("released") Released({generation: int, cause: cause})

@genType @tag("kind")
type event =
  | @as("acquire") Acquire({owner: string})
  | @as("open") Open({by: string})
  | @as("close") Close({by: string})
  | @as("release") Release({by: string, cause: cause})

@genType @tag("kind")
type failure =
  | @as("notOwner") NotOwner({by: string})
  | @as("noHandles") NoHandles({generation: int})
  | @as("alreadyReleased") AlreadyReleased({cause: cause})
  | @as("invalid") Invalid({generation: int})
  | @as("tooManyHandles") TooManyHandles({generation: int})

@genType @tag("kind")
type outcome =
  | @as("ok") Ok({state: state})
  | @as("error") Error({failure: failure})

// Without this bound, `handles + 1` wraps from 2147483647 to -2147483648 and
// breaks `wellFormed`. The proof found that; an unbounded-integer model would
// not have.
let maxHandles = 1_000_000

// Predicates named in contracts must be pure functions the verifier can
// translate; switch-and-return bodies qualify.
@genType
let isOwner = (state: state, who: string): bool =>
  switch state {
  | Held({owner, _}) => owner == who
  | Idle(_) | Released(_) => false
  }

@genType
let wellFormed = (state: state): bool =>
  switch state {
  | Held({handles, _}) => handles >= 0
  | Idle(_) | Released(_) => true
  }

@genType
let generationOf = (state: state): int =>
  switch state {
  | Idle({generation}) | Held({generation, _}) | Released({generation, _}) => generation
  }

@genType
@requires("wellFormed(state)")
@ensures("result.kind === 'ok' ==> wellFormed(result.state)")
@ensures("result.kind === 'ok' ==> generationOf(result.state) === generationOf(state)")
@ensures("event.kind !== 'acquire' && !isOwner(state, event.by) ==> result.kind === 'error'")
@ensures("state.kind === 'released' ==> result.kind === 'error'")
@ensures(
  "state.kind === 'released' ==> result.failure.kind === 'alreadyReleased' && result.failure.cause === state.cause"
)
@ensures(
  "event.kind === 'release' && result.kind === 'ok' ==> result.state.kind === 'released' && result.state.cause === event.cause"
)
@ensures(
  "state.kind === 'held' && event.kind === 'open' && result.kind === 'ok' ==> result.state.kind === 'held' && result.state.owner === state.owner && result.state.handles === state.handles + 1"
)
@ensures(
  "state.kind === 'held' && event.kind === 'close' && result.kind === 'ok' ==> result.state.kind === 'held' && result.state.owner === state.owner && result.state.handles === state.handles - 1"
)
@ensures("state.kind === 'idle' && event.kind === 'acquire' ==> result.kind === 'ok'")
@ensures(
  "state.kind === 'held' && event.kind === 'open' && event.by === state.owner && state.handles < 1000000 ==> result.kind === 'ok'"
)
@ensures(
  "state.kind === 'held' && event.kind === 'close' && event.by === state.owner && state.handles > 0 ==> result.kind === 'ok'"
)
@ensures(
  "state.kind === 'held' && event.kind === 'release' && event.by === state.owner ==> result.kind === 'ok'"
)
let step = (state: state, event: event): outcome =>
  switch state {
  | Released({cause, _}) => Error({failure: AlreadyReleased({cause: cause})})
  | Idle({generation}) =>
    switch event {
    | Acquire({owner}) => Ok({state: Held({generation, owner, handles: 0})})
    | Open({by}) | Close({by}) | Release({by, _}) => Error({failure: NotOwner({by: by})})
    }
  | Held({generation, owner, handles}) =>
    switch event {
    | Acquire(_) => Error({failure: Invalid({generation: generation})})
    | Open({by}) =>
      if by != owner {
        Error({failure: NotOwner({by: by})})
      } else if handles >= maxHandles {
        Error({failure: TooManyHandles({generation: generation})})
      } else {
        Ok({state: Held({generation, owner, handles: handles + 1})})
      }
    | Close({by}) =>
      if by != owner {
        Error({failure: NotOwner({by: by})})
      } else if handles == 0 {
        Error({failure: NoHandles({generation: generation})})
      } else {
        Ok({state: Held({generation, owner, handles: handles - 1})})
      }
    | Release({by, cause}) =>
      if by != owner {
        Error({failure: NotOwner({by: by})})
      } else {
        Ok({state: Released({generation, cause})})
      }
    }
  }
