/***
A bounded FIFO that drops the oldest item when full.

Small, stateful, and easy to get subtly wrong at the wrap-around point, which
makes it a good target for a model-based property: any sequence of operations
must leave it agreeing with a plain array model.
*/

type t<'a> = {
  items: array<option<'a>>,
  mutable start: int,
  mutable length: int,
}

/** Creates an empty buffer that holds up to `capacity` items. */
let make = (~capacity: int): t<'a> => {
  items: Array.make(~length=capacity, None),
  start: 0,
  length: 0,
}

/** Returns the most items the buffer can hold. */
let capacity = (buffer: t<'a>): int => buffer.items->Array.length

/** Returns the number of items the buffer currently holds. */
let size = (buffer: t<'a>): int => buffer.length

/**
Wraps `index` into `0..<capacity`, for an index below twice `capacity`.
Indices wrap by subtraction rather than `mod`: `start < capacity` and
`offset <= capacity` always hold, and `mod` would make every caller "might
throw Division_by_zero" for reanalyze's exception analysis.
*/
let wrap = (index: int, ~capacity: int): int => index >= capacity ? index - capacity : index

/** Appends `value`, dropping the oldest item when the buffer is full. */
let push = (buffer: t<'a>, value: 'a): unit => {
  let cap = buffer->capacity
  if cap > 0 {
    let slot = wrap(buffer.start + buffer.length, ~capacity=cap)
    buffer.items->Array.setUnsafe(slot, Some(value))
    if buffer.length == cap {
      buffer.start = wrap(buffer.start + 1, ~capacity=cap)
    } else {
      buffer.length = buffer.length + 1
    }
  }
}

/** Removes and returns the oldest item, or `None` when the buffer is empty. */
let pop = (buffer: t<'a>): option<'a> =>
  if buffer.length == 0 {
    None
  } else {
    let value = buffer.items->Array.getUnsafe(buffer.start)
    buffer.items->Array.setUnsafe(buffer.start, None)
    buffer.start = wrap(buffer.start + 1, ~capacity=buffer->capacity)
    buffer.length = buffer.length - 1
    value
  }

/** Returns the held items, oldest first. */
let toArray = (buffer: t<'a>): array<'a> =>
  Array.fromInitializer(~length=buffer.length, offset =>
    buffer.items->Array.getUnsafe(wrap(buffer.start + offset, ~capacity=buffer->capacity))
  )->Array.filterMap(value => value)
