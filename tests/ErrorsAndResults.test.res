/**
Executable evidence for the `rescript-errors-and-results` examples.
*/
open RescriptBun.Test

/** Builds a string dictionary from key-value pairs. */
let env = pairs => Dict.fromArray(pairs)

describe("ConfigParsing", () => {
  test("parses a complete environment", () => {
    let parsed = ConfigParsing.fromEnv(env([("HOST", " example.org "), ("PORT", "8080")]))
    expect(parsed)->Expect.toEqual(Ok({ConfigParsing.host: "example.org", port: 8080}))
  })

  test("stops at the first missing key", () => {
    expect(ConfigParsing.fromEnv(env([("PORT", "80")])))->Expect.toEqual(
      Error(ConfigParsing.MissingKey("HOST")),
    )
  })

  test("rejects the trailing garbage that Int.fromString accepts", () => {
    expect(Int.fromString("80abc"))->Expect.toEqual(Some(80))
    expect(ConfigParsing.parsePort("80abc"))->Expect.toEqual(
      Error(ConfigParsing.InvalidPort("80abc")),
    )
  })

  test("let? and flatMap pipelines agree", () => {
    let cases = [
      env([("HOST", "a"), ("PORT", "1")]),
      env([("HOST", ""), ("PORT", "1")]),
      env([("HOST", "a"), ("PORT", "70000")]),
      env([]),
    ]
    cases->Array.forEach(
      input =>
        expect(ConfigParsing.fromEnv(input))->Expect.toEqual(
          ConfigParsing.fromEnvWithFlatMap(input),
        ),
    )
  })

  test("formats a parsed config as an address", () => {
    expect(ConfigParsing.address({host: "h", port: 1}))->Expect.toBe("h:1")
  })

  test("renders errors only at the edge", () => {
    expect(ConfigParsing.describe(InvalidPort("x")))->Expect.toBe(`invalid port "x"`)
  })
})

describe("JsBoundary", () => {
  test("turns a thrown SyntaxError into an Error result", () => {
    switch JsBoundary.parseJson("{") {
    | Error(InvalidJson(message)) => expect(message->String.length)->Expect.toBeGreaterThan(0.)
    | Ok(_) => expect("parsed")->Expect.toBe("rejected")
    }
  })

  test("keeps valid JSON", () => {
    expect(JsBoundary.parseJson(`[1]`))->Expect.toEqual(Ok(JSON.Array([JSON.Number(1.)])))
  })

  test("catches a ReScript exception by constructor", () => {
    expect(JsBoundary.ratioOrNone(1, 0))->Expect.toEqual(None)
    expect(JsBoundary.ratioOrNone(1, 4))->Expect.toEqual(Some(0.25))
  })

  test("throws a JS Error instance JavaScript callers can inspect", () => {
    expect(() => JsBoundary.requireNonEmpty("name", ""))->Expect.toThrow(
      ~expected=String("name must not be empty"),
    )
  })
})
