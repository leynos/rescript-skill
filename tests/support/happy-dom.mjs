/**
@file Preload for the DOM suites under `tests/dom/`.

Registers happy-dom's `window`, `document`, and DOM classes as globals before
any suite module loads, so React DOM sees a browser at import time, and marks
the environment as one where React's `act` is in use. Registration replaces
globals such as `fetch`, so `make test` runs these suites in their own
`bun test` process rather than alongside the others.
*/

import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
