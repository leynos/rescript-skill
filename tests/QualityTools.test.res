/**
Executable evidence for the `rescript-quality-tools` ReScript example.

Only `clamp` is called here. `main`, `PublicApi`, and `legacyRender` are
deliberately unused within the project; the reanalyze gate passing proves the
annotations account for them.
*/
open RescriptBun.Test

describe("ReanalyzeAnnotations", () => {
  test("clamp keeps values inside the range", () => {
    expect(ReanalyzeAnnotations.clamp(5, ~min=0, ~max=3))->Expect.toBe(3)
    expect(ReanalyzeAnnotations.clamp(-1, ~min=0, ~max=3))->Expect.toBe(0)
    expect(ReanalyzeAnnotations.clamp(2, ~min=0, ~max=3))->Expect.toBe(2)
  })
})
