/**
Executable evidence for the `rescript-stdlib-and-data` examples.
*/
open RescriptBun.Test

let ada: JsonDecoding.user = {id: 1, name: "Ada", role: Admin, nickname: Some("countess")}

let parse = text =>
  switch JSON.parseOrThrow(text) {
  | json => json
  | exception JsExn(_) => JSON.Null
  }

describe("JsonDecoding", () => {
  test("decodes a valid payload", () => {
    let json = parse(`[{"id": 1, "name": "Ada", "role": "admin", "nickname": "countess"}]`)
    expect(JsonDecoding.users(json))->Expect.toEqual(Ok([ada]))
  })

  test("treats a missing key and null alike", () => {
    let missing = parse(`{"id": 2, "name": "Bo", "role": "member"}`)
    let explicitNull = parse(`{"id": 2, "name": "Bo", "role": "member", "nickname": null}`)
    expect(JsonDecoding.user(missing, "$"))->Expect.toEqual(JsonDecoding.user(explicitNull, "$"))
  })

  test("reports the path to the first bad value", () => {
    let json = parse(`[{"id": 1, "name": "Ada", "role": "admin"}, {"id": 1.5, "name": "x", "role": "admin"}]`)
    expect(JsonDecoding.users(json))->Expect.toEqual(
      Error({JsonDecoding.path: "$[1].id", expected: "a 32-bit integer"}),
    )
  })

  test("renders an error with its path", () => {
    expect(JsonDecoding.describeError({path: "$.id", expected: "a string"}))->Expect.toBe(
      "$.id: expected a string",
    )
  })

  test("rejects an unknown enum value", () => {
    let json = parse(`{"id": 1, "name": "Ada", "role": "owner"}`)
    expect(JsonDecoding.user(json, "$"))->Expect.toEqual(
      Error({JsonDecoding.path: "$.role", expected: `"admin" or "member"`}),
    )
  })

  test("encode then decode returns the original", () => {
    let member: JsonDecoding.user = {id: 2, name: "Bo", role: Member, nickname: None}
    [ada, member]->Array.forEach(
      user =>
        expect(JsonDecoding.user(JsonDecoding.encodeUser(user), "$"))->Expect.toEqual(Ok(user)),
    )
  })
})

describe("SuryUser", () => {
  test("parses and encodes with one schema", () => {
    let json = parse(`{"id": 1, "name": "Ada", "role": "admin", "nickname": "countess"}`)
    let parsed = SuryUser.parse(json)
    expect(parsed)->Expect.toEqual(
      Ok({SuryUser.id: 1, name: "Ada", role: Admin, nickname: Some("countess")}),
    )
    switch parsed {
    | Ok(user) =>
      expect(user->SuryUser.encode->Result.map(SuryUser.parse))->Expect.toEqual(Ok(parsed))
    | Error(message) => expect(message)->Expect.toBe("parsed")
    }
  })

  test("reports a schema violation as an Error", () => {
    let json = parse(`{"id": "1", "name": "Ada", "role": "admin"}`)
    switch SuryUser.parse(json) {
    | Error(message) => expect(message)->Expect.toInclude("id")
    | Ok(_) => expect("parsed")->Expect.toBe("rejected")
    }
  })

  test("accepts a member without a nickname", () => {
    let json = parse(`{"id": 2, "name": "Bo", "role": "member"}`)
    expect(SuryUser.parse(json))->Expect.toEqual(
      Ok({SuryUser.id: 2, name: "Bo", role: Member, nickname: None}),
    )
  })
})

describe("CollectionSemantics", () => {
  let p1: CollectionSemantics.point = {x: 1, y: 2}
  let p2: CollectionSemantics.point = {x: 1, y: 2}

  test("typed equality is structural and === is identity", () => {
    expect(CollectionSemantics.sameObject(p1, p2))->Expect.toBe(false)
    expect(CollectionSemantics.equalPoint(p1, p2))->Expect.toBe(true)
  })

  test("Set keys records by identity", () => {
    expect(CollectionSemantics.distinctByIdentity([p1, p2, p1]))->Expect.toBe(2)
    expect(CollectionSemantics.distinctByValue([p1, p2, p1]))->Expect.toBe(1)
  })

  test("toSorted copies and sort mutates", () => {
    let xs = [3, 1, 2]
    expect(CollectionSemantics.sortedCopy(xs))->Expect.toEqual([1, 2, 3])
    expect(xs)->Expect.toEqual([3, 1, 2])
    CollectionSemantics.sortInPlace(xs)
    expect(xs)->Expect.toEqual([1, 2, 3])
  })

  test("int arithmetic wraps at 32 bits", () => {
    expect(CollectionSemantics.addInts(Int.Constants.maxValue, 1))->Expect.toBe(
      Int.Constants.minValue,
    )
  })

  test("indexing returns an option", () => {
    expect(CollectionSemantics.third([1, 2]))->Expect.toBe(None)
    expect(CollectionSemantics.third([1, 2, 3]))->Expect.toEqual(Some(3))
  })

  test("String.length counts UTF-16 code units", () => {
    expect(CollectionSemantics.lengthInCodeUnits("ok"))->Expect.toBe(2)
    expect(CollectionSemantics.lengthInCodeUnits(`👍`))->Expect.toBe(2)
  })

  test("dict bindings alias unless copied", () => {
    let original = dict{"name": "first"}
    let _ = CollectionSemantics.renameWithCopy(original)
    expect(original->Dict.get("name"))->Expect.toEqual(Some("first"))
    let _ = CollectionSemantics.renameWithoutCopy(original)
    expect(original->Dict.get("name"))->Expect.toEqual(Some("renamed"))
  })
})
