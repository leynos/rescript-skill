/***
Resetting Bun's mocked clock.

`RescriptBun.Test.setSystemTime` always passes a time. Bun restores the real
clock only when `setSystemTime` is called with no argument, so reset needs its
own binding: a `unit` parameter compiles to a call with no arguments.
*/

@module("bun:test") external reset: unit => unit = "setSystemTime"
