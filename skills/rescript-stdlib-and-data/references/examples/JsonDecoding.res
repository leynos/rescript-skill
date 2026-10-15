/***
Decoding and encoding JSON with the standard library alone.

`JSON.t` is an `@unboxed` variant (`Null`, `Boolean`, `String`, `Number`,
`Object`, `Array`), so a decoder is an ordinary pattern match. Errors carry the
path to the offending value, which is what a caller debugging a payload needs.
*/

type role =
  | Admin
  | Member

type user = {
  id: int,
  name: string,
  role: role,
  nickname: option<string>,
}

type decodeError = {path: string, expected: string}

/** Builds a decode error at `path`, saying what was `expected` there. */
let fail = (path, expected) => Error({path, expected})

/** Renders a decode error as `path: expected ...`. */
let describeError = ({path, expected}: decodeError): string => `${path}: expected ${expected}`

/**
Decodes the value under `key` with `decode`, or fails at `path.key` when the key
is absent.
*/
let field = (fields: dict<JSON.t>, path: string, key: string, decode) =>
  switch fields->Dict.get(key) {
  | Some(value) => decode(value, `${path}.${key}`)
  | None => fail(`${path}.${key}`, "a value")
  }

/**
Decodes a JSON number that is a whole 32-bit integer. `JSON.Decode.*` returns an
option per JSON kind. Matching on that option is exhaustive without a `_` case,
which warning 4 (part of `+A`) would reject on the six-constructor `JSON.t`
variant.
*/
let int = (json: JSON.t, path) =>
  switch json->JSON.Decode.float {
  | Some(n) if Math.trunc(n) == n && n <= 2147483647. && n >= -2147483648. => Ok(n->Float.toInt)
  | Some(_) | None => fail(path, "a 32-bit integer")
  }

/** Decodes a JSON string. */
let string = (json: JSON.t, path) =>
  switch json->JSON.Decode.string {
  | Some(s) => Ok(s)
  | None => fail(path, "a string")
  }

/** Decodes the JSON string `"admin"` or `"member"` as a `role`. */
let role = (json: JSON.t, path) =>
  switch json->JSON.Decode.string {
  | Some("admin") => Ok(Admin)
  | Some("member") => Ok(Member)
  | Some(_) | None => fail(path, `"admin" or "member"`)
  }

/**
Decodes an optional string field. An absent key and an explicit `null` both
mean "no nickname".
*/
let optionalString = (fields: dict<JSON.t>, path, key) =>
  switch fields->Dict.get(key) {
  | None => Ok(None)
  | Some(value) =>
    switch value->JSON.Decode.null {
    | Some(_) => Ok(None)
    | None => string(value, `${path}.${key}`)->Result.map(s => Some(s))
    }
  }

/** Decodes a user object, reporting the path of the first bad field. */
let user = (json: JSON.t, path: string): result<user, decodeError> =>
  switch json->JSON.Decode.object {
  | Some(fields) =>
    fields
    ->field(path, "id", int)
    ->Result.flatMap(id =>
      fields
      ->field(path, "name", string)
      ->Result.flatMap(name =>
        fields
        ->field(path, "role", role)
        ->Result.flatMap(
          role =>
            fields
            ->optionalString(path, "nickname")
            ->Result.map(nickname => {id, name, role, nickname}),
        )
      )
    )
  | None => fail(path, "an object")
  }

/**
Decodes an array of users, reporting the path of the first bad element.
*/
let users = (json: JSON.t): result<array<user>, decodeError> =>
  switch json->JSON.Decode.array {
  | Some(items) =>
    items->Array.mapWithIndex((item, index) => user(item, `$[${index->Int.toString}]`))->Result.all
  | None => fail("$", "an array")
  }

/**
Encodes a user as a JSON object, leaving out `nickname` when it is `None`.
*/
let encodeUser = (u: user): JSON.t => {
  let fields = dict{
    "id": JSON.Number(u.id->Int.toFloat),
    "name": JSON.String(u.name),
    "role": JSON.String(
      switch u.role {
      | Admin => "admin"
      | Member => "member"
      },
    ),
  }
  u.nickname->Option.forEach(nickname => fields->Dict.set("nickname", JSON.String(nickname)))
  JSON.Object(fields)
}
