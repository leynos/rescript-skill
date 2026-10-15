/**
Executable evidence for the `rescript-interop` examples.
*/
open RescriptBun.Test

// `JSON.stringifyAny` throws on BigInt and cyclic values; handle it so the
// suite itself passes reanalyze's exception analysis.
let encode = value =>
  switch JSON.stringifyAny(value) {
  | json => json
  | exception JsExn(_) => None
  }

describe("PlatformBindings", () => {
  test("module and variadic bindings call node:path", () => {
    expect(PlatformBindings.joinPath("a", "b"))->Expect.toBe("a/b")
    expect(PlatformBindings.joinPaths(["a", "b", "..", "c"]))->Expect.toBe("a/c")
  })

  test("a throwing constructor becomes an option", () => {
    let hostname =
      PlatformBindings.parseUrl("https://example.org/x")->Option.map(PlatformBindings.hostname)
    expect(hostname)->Expect.toEqual(Some("example.org"))
    expect(PlatformBindings.parseUrl("not a url"))->Expect.toBe(None)
    let protocol = PlatformBindings.parseUrl("http://a.b")->Option.map(PlatformBindings.protocol)
    expect(protocol)->Expect.toEqual(Some("http:"))
  })

  test("@return(nullable) maps null to None", () => {
    expect(PlatformBindings.firstDigits("order 1234"))->Expect.toEqual(Some("1234"))
    expect(PlatformBindings.firstDigits("none"))->Expect.toBe(None)
  })

  test("an omitted optional argument is omitted from the call", () => {
    expect("7"->PlatformBindings.padStart(3, ~fill="0"))->Expect.toBe("007")
    expect("7"->PlatformBindings.padStart(3))->Expect.toBe("  7")
  })

  test("a missing global falls back through Nullable", () => {
    expect(PlatformBindings.region())->Expect.toBe("eu-west-2")
  })
})

describe("WireShapes", () => {
  test("@tag and @as produce the JavaScript object shape", () => {
    let click = WireShapes.Click({x: 1, y: 2})
    expect(encode(click))->Expect.toEqual(Some(`{"kind":"click","x":1,"y":2}`))
    expect(WireShapes.describeEvent(Key({key: "Enter"})))->Expect.toBe("key Enter")
    expect(WireShapes.describeEvent(click))->Expect.toBe("click at 1,2")
  })

  test("@unboxed payloads compile to bare values", () => {
    expect(encode([WireShapes.Spaces(2), Text("x")]))->Expect.toEqual(Some(`[2,"x"]`))
    expect(WireShapes.padLeft("7", 3, Text("0")))->Expect.toBe("007")
    expect(WireShapes.padLeft("7", 3, Spaces(1)))->Expect.toBe("  7")
  })

  test("a catch-all constructor absorbs unknown strings", () => {
    expect(WireShapes.planFromString("team"))->Expect.toBe(Team)
    expect(WireShapes.planFromString("enterprise"))->Expect.toEqual(Other("enterprise"))
    expect(WireShapes.planFromString("free"))->Expect.toBe(Free)
    expect(WireShapes.seats(Free))->Expect.toEqual(Some(1))
    expect(WireShapes.seats(Other("enterprise")))->Expect.toBe(None)
  })
})
