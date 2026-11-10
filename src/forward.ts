/**
 * trenddata core: a forwarding client for the hosted
 * HasData Google Trends MCP server.
 *
 * No trends lookup is run locally. tools/list is answered
 * from the literal tool definition below, taken verbatim
 * from a live capture of the upstream server (name, title,
 * description and inputSchema exactly as captured,
 * including the title key the tool carries). A tools/call
 * is forwarded over a streamable-HTTP JSON-RPC session:
 * an initialize POST, a notifications/initialized POST,
 * then the tools/call POST, honouring the Mcp-Session-Id
 * response header when the upstream issues one. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client.
 *
 * The upstream endpoint is pinned to
 * https://mcp.hasdata.com/mcp?apis=google_trends — the
 * query string is part of the pinned URL — and can be
 * overridden with the HASDATA_GOOGLE_TRENDS_MCP_URL
 * environment variable (that override is a labelled
 * reconstruction). When HASDATA_API_KEY is set in the
 * environment, every upstream request carries an
 * `x-api-key: <key>` header (the header name is pinned
 * by the registry record's remote declaration;
 * forwarding the key from this env var is a labelled
 * reconstruction — the capture itself was taken
 * keyless). When the variable is unset, no key header
 * is sent, and no Authorization header is sent in
 * either case.
 *
 * Upstream results pass through verbatim, including any
 * isError flag and any extra result fields. Failures — a
 * JSON-RPC error from the upstream, a non-2xx status, an
 * unparseable response, or a fetch that throws or times
 * out — surface as an isError result whose text starts
 * with `trenddata error:` (that rendering is a labelled
 * reconstruction). Responses may be plain JSON or SSE
 * (data: lines); the JSON-RPC message with the matching
 * id wins.
 */
import type {
  FetchFn,
  FetchResponseLike,
  ForwardDeps,
  ToolArgs,
  ToolDef,
  ToolResult,
} from "./types.js";

export const VERSION = "0.1.0";

export const DEFAULT_ENDPOINT_URL = "https://mcp.hasdata.com/mcp?apis=google_trends";

export const DEFAULT_TIMEOUT_MS = 30000;

export const PROTOCOL_VERSION = "2025-03-26";

/* ------------------------------------------------------------------ */
/* Tool definitions (tools/list literals, verbatim from the live       */
/* capture in harness/fixtures/hasdata-google-trends-tools-original.json) */
/* ------------------------------------------------------------------ */

export const TOOL_DEFS: ToolDef[] = [
  {
    "name": "hasdata_google_trends_search_getTrendsData",
    "title": "google_trends_search: GET /",
    "description": "Get Google Trends Data\n\nPulls Google Trends data for one or more queries with geo targeting, region granularity (country/subregion/metro/city), date range, category, time zone, Google property (web, images, news, shopping, YouTube), and dataType (timeseries, geoMap, relatedTopics, relatedQueries). Returns interest-over-time series, geo-level breakdowns, and rising/top related topics/queries with relative scores. Use for keyword/content strategy, demand forecasting, seasonality analysis, topic discovery, campaign timing, and adding live-trend signals to marketing or research agents.",
    "inputSchema": {
      "type": "object",
      "properties": {
        "q": {
          "type": "string",
          "description": "Specify the search term for which you want to retrieve trends data."
        },
        "geo": {
          "type": "string",
          "description": "Specifies the location for the search. Defaults to Worldwide if not set or empty. Provide one exact documented value (3517 allowed), e.g. `AF`, `AF-BDS`."
        },
        "region": {
          "type": "string",
          "enum": [
            "country",
            "region",
            "dma",
            "city"
          ],
          "description": "Used to get more specific results when using \"Interest by region\" data type. Other data types do not accept this parameter. The default value depends on the geo location that is set.\n\nAvailable options:\n - `country`: Country\n - `region`: Subregion\n - `dma`: Metro\n - `city`: City\n\nNote: Not all region options will return results for every geo location.\n"
        },
        "dataType": {
          "type": "string",
          "enum": [
            "timeseries",
            "geoMap",
            "relatedTopics",
            "relatedQueries"
          ],
          "description": "Defines the type of search to perform.\n\nAvailable options:\n  - `timeseries`: Interest over time (default). Accepts both single and multiple queries per search.\n  - `geoMap`: Interest by region. Accepts both single and multiple queries per search.\n  - `relatedTopics`: Related topics. Accepts only single query per search.\n  - `relatedQueries`: Related queries. Accepts only single query per search.\n"
        },
        "tz": {
          "type": "number",
          "description": "Defines a time zone offset in minutes. The default value is 420 (Pacific Daylight Time (PDT): UTC-7). The valid range for this parameter is from -1439 to 1439.\n\nTo calculate the `tz` value for a specific time zone, you can use the time difference between UTC +0 and the desired time zone.\n\nExamples:\n- `420`: Pacific Daylight Time (PDT)\n- `60`: Central European Time (CET)\n- `-540`: Japan Standard Time\n"
        },
        "cat": {
          "type": "string",
          "description": "Category of the search term. The default value is 0 (\"All categories\"). Provide one exact documented value (1133 allowed), e.g. `0`, `3`."
        },
        "gprop": {
          "type": "string",
          "enum": [
            "images",
            "news",
            "froogle",
            "youtube"
          ],
          "description": "Sorts results by a specific property. The default property is Web Search (applied when the gprop parameter is not set or empty).\n\nAvailable options:\n  - `images`: Image Search\n  - `news`: News Search\n  - `froogle`: Google Shopping\n  - `youtube`: YouTube Search\n"
        },
        "date": {
          "type": "string",
          "description": "Defines a date range for the search. Available options:\n\n- `now 1-H`: Past hour\n- `now 4-H`: Past 4 hours\n- `now 1-d`: Past day\n- `now 7-d`: Past 7 days\n- `today 1-m`: Past 30 days\n- `today 3-m`: Past 90 days\n- `today 12-m`: Past 12 months\n- `today 5-y`: Past 5 years\n- `all`: 2004 - present\n\nYou can also specify a custom date range using one of the following formats:\n\n- `yyyy-mm-dd yyyy-mm-dd` - (e.g. 2021-10-15 2022-05-25) for dates from 2004 to present.\n- `yyyy-mm-ddThh yyyy-mm-ddThh` - (e.g. 2022-05-19T10 2022-05-24T22) for dates with hours within a week range. The hours will be calculated based on the tz (time zone) parameter.\n"
        }
      },
      "required": [
        "q"
      ],
      "additionalProperties": false,
      "$schema": "http://json-schema.org/draft-07/schema#"
    }
  }
];

export const TOOL_NAMES = TOOL_DEFS.map((t) => t.name);

/** Whether `name` is one of the captured tools. */
export function isKnownTool(name: string): boolean {
  return TOOL_NAMES.includes(name);
}

/* ------------------------------------------------------------------ */
/* Forwarding client                                                   */
/* ------------------------------------------------------------------ */

function errorResult(detail: string): ToolResult {
  return {
    content: [{ type: "text", text: `trenddata error: ${detail}` }],
    isError: true,
  };
}

function rpcErrorMessage(error: unknown): string {
  if (error !== null && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message !== "") return message;
    return JSON.stringify(error);
  }
  return String(error);
}

/**
 * Parse a JSON-RPC response body, tolerating SSE framing.
 * Returns the message whose id matches `expectedId` when
 * one is present, else the last parseable message, else
 * null when nothing parses.
 */
export function parseRpcBody(
  text: string,
  expectedId?: number,
): Record<string, unknown> | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const candidates: Record<string, unknown>[] = [];
  const tryPush = (payload: string): void => {
    try {
      const parsed: unknown = JSON.parse(payload);
      if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
        candidates.push(parsed as Record<string, unknown>);
      }
    } catch {
      // Not JSON; ignore this candidate.
    }
  };
  if (trimmed.includes("data:")) {
    for (const line of trimmed.split("\n")) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice("data:".length).trim();
      if (payload !== "" && payload !== "[DONE]") tryPush(payload);
    }
  } else {
    tryPush(trimmed);
  }
  if (candidates.length === 0) return null;
  if (expectedId !== undefined) {
    const match = candidates.find((c) => c.id === expectedId);
    if (match !== undefined) return match;
  }
  return candidates[candidates.length - 1];
}

async function defaultFetch(
  url: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<FetchResponseLike> {
  return fetch(url, init) as unknown as FetchResponseLike;
}

/**
 * A forwarding client holding one upstream session. The
 * session is established lazily on the first forwarded
 * call and reused for the lifetime of the client (the
 * process lifetime when the client is the MCP server's
 * or a one-shot client for the CLI).
 */
export class TrenddataClient {
  private readonly deps: ForwardDeps;
  private sessionId: string | null = null;
  private ready = false;
  private sessionPromise: Promise<void> | null = null;
  private idCounter = 0;

  constructor(deps: ForwardDeps = {}) {
    this.deps = deps;
  }

  private fetchFn(): FetchFn {
    return this.deps.fetchFn ?? defaultFetch;
  }

  private endpointUrl(): string {
    if (this.deps.url && this.deps.url.trim() !== "") return this.deps.url.trim();
    const raw = (this.deps.env ?? process.env).HASDATA_GOOGLE_TRENDS_MCP_URL;
    if (raw && raw.trim() !== "") return raw.trim();
    return DEFAULT_ENDPOINT_URL;
  }

  private apiKey(): string | null {
    const raw = (this.deps.env ?? process.env).HASDATA_API_KEY;
    if (raw && raw.trim() !== "") return raw.trim();
    return null;
  }

  private timeoutMs(): number {
    if (typeof this.deps.timeoutMs === "number" && this.deps.timeoutMs > 0) {
      return this.deps.timeoutMs;
    }
    return DEFAULT_TIMEOUT_MS;
  }

  private nextId(): number {
    this.idCounter += 1;
    return this.idCounter;
  }

  private async post(
    body: unknown,
    withSession: boolean,
  ): Promise<FetchResponseLike> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };
    const key = this.apiKey();
    if (key !== null) headers["x-api-key"] = key;
    if (withSession && this.sessionId !== null) {
      headers["Mcp-Session-Id"] = this.sessionId;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs());
    try {
      return await this.fetchFn()(this.endpointUrl(), {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  }

  private async ensureSession(): Promise<void> {
    if (this.ready) return;
    if (this.sessionPromise === null) {
      this.sessionPromise = (async () => {
        const initId = this.nextId();
        const initRes = await this.post(
          {
            jsonrpc: "2.0",
            id: initId,
            method: "initialize",
            params: {
              protocolVersion: PROTOCOL_VERSION,
              capabilities: {},
              clientInfo: { name: "trenddata", version: VERSION },
            },
          },
          false,
        );
        const sessionId = initRes.headers.get("mcp-session-id");
        if (sessionId) this.sessionId = sessionId;
        const initText = await initRes.text();
        const initParsed = parseRpcBody(initText, initId);
        if (initParsed !== null && initParsed.error) {
          throw new Error(rpcErrorMessage(initParsed.error));
        }
        if (initRes.status < 200 || initRes.status >= 300) {
          throw new Error(`HTTP ${initRes.status}`);
        }
        if (initParsed === null && initText.trim() !== "") {
          throw new Error("malformed response");
        }
        const initializedRes = await this.post(
          { jsonrpc: "2.0", method: "notifications/initialized" },
          true,
        );
        try {
          await initializedRes.text();
        } catch {
          // The notification response body carries nothing we need.
        }
        this.ready = true;
      })();
    }
    try {
      await this.sessionPromise;
    } catch (err) {
      this.sessionPromise = null;
      this.sessionId = null;
      throw err;
    }
  }

  /** Forward one tool call; upstream failures come back as isError results. */
  async callTool(name: string, args: ToolArgs): Promise<ToolResult> {
    try {
      await this.ensureSession();
    } catch (err) {
      return errorResult(err instanceof Error ? err.message : String(err));
    }

    const callId = this.nextId();
    let callRes: FetchResponseLike;
    try {
      callRes = await this.post(
        {
          jsonrpc: "2.0",
          id: callId,
          method: "tools/call",
          params: { name, arguments: args ?? {} },
        },
        true,
      );
    } catch (err) {
      return errorResult(
        `request failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    const parsed = parseRpcBody(await callRes.text(), callId);
    if (parsed !== null && parsed.error) {
      return errorResult(rpcErrorMessage(parsed.error));
    }
    if (callRes.status < 200 || callRes.status >= 300) {
      return errorResult(`HTTP ${callRes.status}`);
    }
    if (parsed === null) return errorResult("malformed response");
    const result = parsed.result as ToolResult | undefined;
    if (result === undefined || result === null || typeof result !== "object") {
      return errorResult("malformed response");
    }
    // Pass the upstream result through verbatim.
    return result;
  }
}

/** Create a forwarding client; tests inject a fake fetch and env through deps. */
export function createClient(deps: ForwardDeps = {}): TrenddataClient {
  return new TrenddataClient(deps);
}

/** One-shot helper: a fresh client per call (the CLI path). */
export async function callTool(
  name: string,
  args: ToolArgs,
  deps: ForwardDeps = {},
): Promise<ToolResult> {
  return new TrenddataClient(deps).callTool(name, args);
}
