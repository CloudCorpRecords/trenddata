# trenddata

trenddata is a small local bridge to the hosted HasData
Google Trends MCP server, which returns Google Trends
data as JSON. Give it one or more search terms, and it
fetches interest over time, interest by region, and the
related topics and related queries for those terms.
Lookups can be narrowed by geography, region
granularity (country, subregion, metro, or city), date
range, category, time zone offset, and Google property
(web search by default, or images, news, shopping, or
YouTube).

The bridge stores no trends data of its own. It serves
the upstream server's tool list locally, exactly as
captured from the live endpoint, and forwards each
tool call upstream, returning the result untouched.
The captured surface is a single read-only fetch:
there is no write, messaging, or payment tool in it.

## Tools

- `hasdata_google_trends_search_getTrendsData` — fetch
  Google Trends data for a query. Required: `q` (the
  search term). Optional: `geo` (location code;
  worldwide when unset or empty), `region` (`country` /
  `region` / `dma` / `city`, used with the
  interest-by-region data type), `dataType`
  (`timeseries` / `geoMap` / `relatedTopics` /
  `relatedQueries`), `tz` (time zone offset in minutes,
  default 420), `cat` (category code, default `0` for
  all categories), `gprop` (`images` / `news` /
  `froogle` / `youtube`; web search when unset), and
  `date` (a named range such as `today 12-m` or `all`,
  or a custom `yyyy-mm-dd yyyy-mm-dd` range). Returns
  interest-over-time series, geo-level breakdowns, and
  rising and top related topics and queries with
  relative scores.

## Configuration

- `HASDATA_GOOGLE_TRENDS_MCP_URL` (optional) — override
  the upstream endpoint. Defaults to
  `https://mcp.hasdata.com/mcp?apis=google_trends`.
  (The override hook is this rebuild's own labelled
  reconstruction.)
- `HASDATA_API_KEY` (optional) — when set, every
  upstream request carries an `x-api-key: <key>`
  header, for the caller's own HasData API key. When
  it is not set, no key header is sent. (The header
  name and the env name are pinned by the original's
  registry record; forwarding the key from this env
  var is a labelled reconstruction — the original
  surface was captured keyless.)

### Forwarding mechanics

On the first tool call the client opens a streamable
HTTP session with the upstream: a JSON-RPC
`initialize` request (protocolVersion `2025-03-26`,
clientInfo name `trenddata`), then a
`notifications/initialized` notification, then the
`tools/call` request carrying the caller's arguments
unchanged. When the upstream answers `initialize`
with an `Mcp-Session-Id` header, that value rides on
every later request of the session, which is reused
for the life of the process. Replies may arrive as
plain JSON or as server-sent events; both are read.

Successful upstream results pass through verbatim,
including any `isError` flag the upstream sets.
Failures — a JSON-RPC error, a non-2xx status, an
unreadable response, or a request that cannot be
completed — come back as an `isError` result whose
text starts with `trenddata error:` (this rendering
is this rebuild's own labelled reconstruction).

## CLI

The tool is also a subcommand taking one JSON
argument string:

```bash
npx @reneturcios/trenddata hasdata_google_trends_search_getTrendsData '{"q":"electric vehicles","geo":"US","dataType":"timeseries","date":"today 12-m"}'
npx @reneturcios/trenddata --version
```

Exit codes: `0` on success, `1` on an `isError`
result, `2` on a usage error.

## MCP server

```bash
npx -y @reneturcios/trenddata mcp
```

MCP client config:

```json
{
  "mcpServers": {
    "trenddata": {
      "command": "npx",
      "args": ["-y", "@reneturcios/trenddata", "mcp"]
    }
  }
}
```

## Docker

```bash
docker run -i ghcr.io/cloudcorprecords/trenddata
docker run --rm ghcr.io/cloudcorprecords/trenddata --version
```

The container's default command is `mcp`, so the first
form is a stdio MCP server; any other arguments reach
the CLI normally.

## Development

```bash
npm install
npm run build
npm test
npm run dev
```

The test suite runs entirely against a stubbed
JSON-RPC upstream — no live network calls.

## License

MIT — see `LICENSE`.
