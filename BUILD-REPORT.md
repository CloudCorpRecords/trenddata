# BUILD REPORT — trenddata

Rebuild of `com.hasdata/google-trends` v1.0.7 (remote-only, keyless capture)
as `@reneturcios/trenddata` 0.1.0 / `io.github.CloudCorpRecords/trenddata`.

## Fixture conflicts

**None.** The brief, the spec prose, and the fixture agree on the tool
name and its required field. Required field as served, taken from
the fixture (`harness/fixtures/hasdata-google-trends-tools-original.json`):

- `hasdata_google_trends_search_getTrendsData` — required: `q`

The fixture's tool literal (name, title, description, inputSchema —
including the `title` key, every property description and enum, the
trailing newlines in the `region`, `dataType`, `tz` and `date` property
descriptions, `additionalProperties: false`, and the `$schema` key) is
served verbatim from `src/forward.ts`; the literal was generated
programmatically from the fixture JSON (parsed and re-serialised, not
retyped) and verified by the registration-integrity test (served
tools/list deep-equals the fixture's 1 tool object) and again by the
parity harness.

## What was built

All 19 factory files under `builds/trenddata/`:

- `package.json` (`@reneturcios/trenddata` 0.1.0, bin
  `trenddata` → `dist/cli.js`, deps exactly `@modelcontextprotocol/sdk ^1`
  + `zod ^3`; devDeps `@types/node ^20`, `tsx ^4`, `typescript ^5`)
- `server.json` (description exactly the prescribed 83-char string
  "Google Trends data as JSON: interest over time, geo breakdowns and related queries.";
  npm entry carries `"version": "0.1.0"`; OCI entry
  `ghcr.io/cloudcorprecords/trenddata:0.1.0` carries **no** version field)
- `Dockerfile` (node:20-alpine both stages; server-name label
  `io.modelcontextprotocol.server.name="io.github.CloudCorpRecords/trenddata"`
  matches `server.json`)
- `tsconfig.json` (fleet-identical, 318 bytes), `.gitignore`,
  `package-lock.json`, `README.md` (fresh prose), `LICENSE` (MIT,
  Copyright (c) 2026 Rene Turcios), `CHANGELOG.md` (single 0.1.0 entry,
  2026-10-28)
- `src/index.ts`, `src/cli.ts`, `src/mcp.ts`, `src/types.ts`,
  `src/forward.ts` (core; exports `VERSION = "0.1.0"`)
- `test/forward.test.ts`
- `.github/workflows/{ci.yml, publish.yml, publish-container.yml,
  registry-publish.yml}` (container workflow: IMAGE
  `ghcr.io/cloudcorprecords/trenddata`, smoke assertion on server name
  `trenddata`)

Plus `BUILD-REPORT.md` (this file) and the `parity-out/` harness output.

## Design

- Forwarding client to `https://mcp.hasdata.com/mcp?apis=google_trends`
  (pinned; the query string is part of the pinned URL), overridable via
  `HASDATA_GOOGLE_TRENDS_MCP_URL` (labelled reconstruction). tools/call is
  forwarded as a streamable-HTTP JSON-RPC client: initialize
  (protocolVersion `2025-03-26`, clientInfo `trenddata`) →
  notifications/initialized → tools/call, honouring `Mcp-Session-Id`
  when issued; session established lazily and reused per client.
  Plain-JSON and SSE replies both parsed; the matching-id message
  wins; upstream results pass through verbatim (including `isError`
  and extra fields such as `structuredContent`).
- When `HASDATA_API_KEY` is set, an `x-api-key` header is
  sent on every upstream request (header name pinned by the registry
  record's remote declaration; forwarding it from this env var is a
  labelled reconstruction — the capture was keyless). When unset, no
  key header is sent. No `Authorization` header is sent in either
  case. Both branches are covered by tests.
- Upstream failures (JSON-RPC error, non-2xx status, malformed body,
  throwing/timing-out fetch) surface as `trenddata error:` text
  results (labelled reconstruction).
- Registration via the MCP SDK **low-level** `Server` API
  (`ListToolsRequestSchema` / `CallToolRequestSchema` handlers) serving
  the fixture literal exactly; no `McpServer` + zod registration
  (per the task brief, overriding TEMPLATE.md §2 item 12).
  `src/mcp.ts` also exports `createServer` / `startMcpServer` /
  `handleCallTool` so the MCP layer is testable without a transport;
  the CLI's `mcp` subcommand starts it over stdio.
- Core takes an injectable fetch (`ForwardDeps.fetchFn`), so all tests
  run against a stubbed JSON-RPC upstream. No live network calls in
  tests; no live call claimed anywhere. The captured surface is one
  read-only trends fetch; no write, messaging, or payment tool exists
  in the surface — none was added.

## Lockfile (Route 3, clean from birth)

Generated in a temp dir (`/tmp/trenddata-lock`) containing only the
new `package.json`, with no `node_modules` present:
`npm install --package-lock-only --ignore-scripts --offline`.
Verified: parses, `name == @reneturcios/trenddata`,
**128 package entries**; placed into the build dir with matching
sha256 (`8ade1971…99ea` on both sides: full value
`8ade19719bb1b1a1171e2caf25a9e11d0bc05910d48ff9cec49b2b0728e199ea`).
Then `npm install --offline --ignore-scripts` in the build dir for
`node_modules`. Note: a runtime restart interrupted the first
in-tree install (incomplete `node_modules`, `/tmp` wiped); the
install was re-run to completion and the build-dir lockfile
re-verified at the same sha256 before building. `dist/` was built
in-tree normally.

## Verification (all in the build dir unless noted)

- `npx tsc --noEmit` → exit 0
- `npm run build` → real `dist/` (cli.js 2292 B, forward.js 13696 B,
  mcp.js 2680 B, all non-empty, with `.d.ts` + source maps)
- `node dist/cli.js --version` → `0.1.0`
- `npm test` → **51 tests, 51 pass, 0 fail** (8 suites: registration
  integrity — served tools deep-equal the fixture's full 1 tool
  object, name in order, exactly the fixture's keys, title key,
  required field, every property key in order, region/dataType/gprop
  enums, additionalProperties/$schema, isKnownTool; session
  establishment/reuse/session-id handling, clientInfo/protocol
  version; env URL override, explicit url override, explicit-over-env
  precedence, blank-env fallback; x-api-key header present on every
  request when the key is set / absent when unset / no Authorization
  header in either case; verbatim argument forwarding incl. geo and
  dataType options and a q-only query; verbatim result pass-through
  incl. upstream isError and SSE; JSON-RPC/init/malformed/no-result/
  HTTP/throw/timeout failures → `trenddata error:`; parseRpcBody JSON
  + SSE + matching-id + [DONE] cases; MCP-layer MethodNotFound /
  InvalidParams validation; CLI --version / -v / unknown exit 2 /
  bad-JSON exit 2 / `mcp extra` exit 2)
- Parity: `python3 harness/parity.py --original
  harness/fixtures/hasdata-google-trends-tools-original.json --rebuild
  "stdio:node builds/trenddata/dist/cli.js mcp" --out
  builds/trenddata/parity-out` (run from `~/workspace/mcp-rebuild-100`)
  → **PASS, parity 100.0, 1/1 identical, no missing/extra/schema
  diffs** (see `parity-out/parity.json`)
- Consistency sweep: package.json version = server.json top-level =
  npm-entry version = OCI tag = core `VERSION` = CHANGELOG heading
  (0.1.0); package.json `mcpName` = server.json `name` = Dockerfile
  label; server.json description measured at 83 chars; OCI entry
  confirmed to have no `version` field.

Clean-room: all prose and code written fresh for trenddata; only the
mechanics were patterned on the sibling bingdata build, and only the
fixture's tool literal is served verbatim.
