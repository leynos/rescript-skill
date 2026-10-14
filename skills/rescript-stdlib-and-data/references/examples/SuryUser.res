/***
The same `user` contract as `JsonDecoding`, declared once as a Sury schema.

A schema both parses and encodes, so the two directions cannot drift apart.
Sury compiles each schema to a specialised JavaScript function with `eval` on
first use; that is fast, but environments whose Content Security Policy
forbids `unsafe-eval` cannot use it.
*/

type role =
  | @as("admin") Admin
  | @as("member") Member

// The schema reads these fields at runtime, where reanalyze cannot see it.
@live
type user = {
  id: int,
  name: string,
  role: role,
  nickname: option<string>,
}

let roleSchema = S.union([S.literal(Admin), S.literal(Member)])

let userSchema = S.object(s => {
  id: s.field("id", S.int),
  name: s.field("name", S.string),
  role: s.field("role", roleSchema),
  nickname: s.field("nickname", S.option(S.string)),
})

// Sury reports failure by throwing `S.Exn`; convert it to a result here.
let parse = (input: JSON.t): result<user, string> =>
  try Ok(input->S.parseOrThrow(~to=userSchema)) catch {
  | S.Exn(error) => Error(error.message)
  }

let encode = (value: user): result<JSON.t, string> =>
  try Ok(value->S.convertOrThrow(~from=userSchema, ~to=S.json)) catch {
  | S.Exn(error) => Error(error.message)
  }
