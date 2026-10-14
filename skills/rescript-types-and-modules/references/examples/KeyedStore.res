/***
A functor: one implementation, many key types, no runtime type tests.

`Make` takes any module that can turn its key into a string and returns a store
whose type is abstract outside the functor. Two stores built from different key
modules cannot be mixed up, even though both use a `dict` underneath.
*/

module type Key = {
  type t
  let toKey: t => string
}

module type Store = {
  type key
  type t<'v>
  let empty: unit => t<'v>
  let set: (t<'v>, key, 'v) => t<'v>
  let get: (t<'v>, key) => option<'v>
  let size: t<'v> => int
}

module Make = (K: Key): (Store with type key = K.t) => {
  type key = K.t
  type t<'v> = dict<'v>

  let empty = () => Dict.make()

  // Copy on write keeps `t` immutable from the caller's point of view.
  let set = (store, key, value) => {
    let next = store->Dict.copy
    next->Dict.set(K.toKey(key), value)
    next
  }

  let get = (store, key) => store->Dict.get(K.toKey(key))
  let size = store => store->Dict.size
}

module UserId = {
  type t = UserId(int)
  let toKey = (UserId(id)) => Int.toString(id)
}

module UserStore = Make(UserId)
