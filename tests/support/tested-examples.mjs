/**
@file Loader for the marked examples in user-facing documents.

Every fenced block in a loaded document must be preceded by a marker comment,
`<!-- tested-example: <identifier> -->`, with only blank lines between the
two. The loader reads the published document itself, so the suites exercise
the text readers see rather than a copied fixture. It throws, rather than
skipping, on an unmarked fence, an unterminated fence, a marker with no
identifier, a marker with no fence after it, and a duplicate identifier.
*/

const MARKER = /^<!--\s*tested-example:\s*(.*?)\s*-->\s*$/;
const FENCE = /^(`{3,}|~{3,})(.*)$/;
const IDENTIFIER = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Returns the marked examples in `markdown`, in document order, as
 * `{ id, info, body, line }`, where `line` is the fence's 1-based line.
 */
export function testedExamples(markdown, label = "document") {
  const lines = markdown.split("\n");
  const examples = [];
  const seen = new Set();
  let pending = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const marker = line.match(MARKER);
    if (marker) {
      if (pending) {
        throw new Error(
          `${label}:${pending.line}: marker "${pending.id}" has no fence after it`,
        );
      }
      const id = marker[1];
      if (!IDENTIFIER.test(id)) {
        throw new Error(
          `${label}:${i + 1}: marker has a missing or malformed identifier "${id}"`,
        );
      }
      if (seen.has(id)) {
        throw new Error(`${label}:${i + 1}: duplicate identifier "${id}"`);
      }
      seen.add(id);
      pending = { id, line: i + 1 };
      continue;
    }
    const fence = line.match(FENCE);
    if (fence) {
      if (!pending) {
        throw new Error(
          `${label}:${i + 1}: fence has no tested-example marker`,
        );
      }
      const [, delimiter, info] = fence;
      // A closing fence repeats the opening character at least as many times
      // and carries nothing else.
      const closing = new RegExp(
        `^\\${delimiter[0]}{${delimiter.length},}\\s*$`,
      );
      const close = lines.findIndex(
        (candidate, j) => j > i && closing.test(candidate),
      );
      if (close === -1) {
        throw new Error(`${label}:${i + 1}: fence is never closed`);
      }
      examples.push({
        id: pending.id,
        info: info.trim(),
        body: lines.slice(i + 1, close).join("\n"),
        line: i + 1,
      });
      pending = null;
      i = close;
      continue;
    }
    if (pending && line.trim() !== "") {
      throw new Error(
        `${label}:${pending.line}: marker "${pending.id}" has no fence after it`,
      );
    }
  }
  if (pending) {
    throw new Error(
      `${label}:${pending.line}: marker "${pending.id}" has no fence after it`,
    );
  }
  return examples;
}
