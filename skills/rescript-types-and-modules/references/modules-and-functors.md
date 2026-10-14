# Modules and functors

Every file is a module, and every module can contain nested modules. Module
names are global within a project (without folder namespacing), so two files
called `Utils.res` cannot coexist; see `rescript-build-and-config`.

## Module types

A module type names a signature. Use one when several modules must provide the
same shape, or as a functor's parameter:

```rescript
module type Key = {
  type t
  let toKey: t => string
}
```

## Functors

A functor is a function from modules to modules. It earns its keep when one
implementation must work over several types and the result must keep those
types apart:

```rescript
module Make = (K: Key): (Store with type key = K.t) => {
  type key = K.t
  type t<'v> = dict<'v>
  let empty = () => Dict.make()
  let get = (store, key) => store->Dict.get(K.toKey(key))
  // ...
}

module UserStore = Make(UserId)
module OrderStore = Make(OrderId)
```

`UserStore.t<'v>` and `OrderStore.t<'v>` are different abstract types even
though both are a `dict` underneath, so passing an order store where a user
store is expected is a compile error. The full example is
[KeyedStore.res](examples/KeyedStore.res).

`with type key = K.t` exposes the relationship between the functor's argument
and its result. Without it, `key` is abstract and callers cannot pass a
`UserId.t` at all.

### When not to use a functor

- The parameter module has one function: pass the function.
- The "configuration" is runtime data: pass a record.
- Only one instantiation exists: write the module directly.

Functors are applied at module level and their results are fixed at compile
time. Generated JavaScript is a function returning an object of closures, which
is fast, but the indirection costs readers more than the CPU.

## First-class modules

A module can be packed into a value and unpacked later, which lets you choose
an implementation at runtime while keeping its types:

```rescript
module type Clock = {
  let now: unit => float
}

module SystemClock = {
  let now = () => Date.now()
}

let clock: module(Clock) = module(SystemClock)

let elapsed = (module(C: Clock), start) => C.now() -. start
```

A record of functions (`type clock = {now: unit => float}`) does the same job
with less ceremony when no abstract types are involved, and is easier to fake
in tests. Prefer it unless the module carries types.

## Opening modules

`open M` brings every name in `M` into scope. Keep opens local
(`let f = () => { open M; ... }`) and narrow. A global open in `compiler-flags`
makes every file depend on the opened module and hides where names come from;
this catalogue never uses one.

## Recursive modules and recursive types

`type rec` declares mutually recursive types; `let rec ... and ...` declares
mutually recursive functions. Recursive modules (`module rec`) exist but
complicate initialization order in the generated JavaScript; restructure into a
recursive type plus functions first.
