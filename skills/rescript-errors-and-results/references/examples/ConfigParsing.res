/***
Expected failure as data: a closed error variant, `result`, and `let?`.

Every step returns `result<_, configError>`, so `let?` can short-circuit on the
first `Error` without a nested `switch`. `let?` is experimental in ReScript 12
and needs `"experimental-features": {"LetUnwrap": true}` in `rescript.json`;
`fromEnvWithFlatMap` is the same pipeline without the flag.
*/

type configError =
  | MissingKey(string)
  | InvalidHost(string)
  | InvalidPort(string)

type config = {host: string, port: int}

let lookup = (env: dict<string>, key: string): result<string, configError> =>
  switch env->Dict.get(key) {
  | Some(value) => Ok(value)
  | None => Error(MissingKey(key))
  }

let parseHost = (raw: string): result<string, configError> => {
  let host = raw->String.trim
  host->String.isEmpty ? Error(InvalidHost(raw)) : Ok(host)
}

// `Int.fromString` wraps `parseInt`, so "80abc" and "8.5" both parse. Check
// the whole string first when the input format is strict.
let parsePort = (raw: string): result<int, configError> =>
  switch /^[0-9]+$/->RegExp.test(raw) ? Int.fromString(raw) : None {
  | Some(port) if port > 0 && port < 65536 => Ok(port)
  | _ => Error(InvalidPort(raw))
  }

let fromEnv = (env: dict<string>): result<config, configError> => {
  let? Ok(rawHost) = env->lookup("HOST")
  let? Ok(host) = parseHost(rawHost)
  let? Ok(rawPort) = env->lookup("PORT")
  let? Ok(port) = parsePort(rawPort)
  Ok({host, port})
}

let fromEnvWithFlatMap = (env: dict<string>): result<config, configError> =>
  env
  ->lookup("HOST")
  ->Result.flatMap(parseHost)
  ->Result.flatMap(host =>
    env
    ->lookup("PORT")
    ->Result.flatMap(parsePort)
    ->Result.map(port => {host, port})
  )

// Render at the edge; keep the variant everywhere else so callers can match.
let describe = (error: configError): string =>
  switch error {
  | MissingKey(key) => `missing ${key}`
  | InvalidHost(raw) => `invalid host "${raw}"`
  | InvalidPort(raw) => `invalid port "${raw}"`
  }

let address = ({host, port}: config): string => `${host}:${port->Int.toString}`
