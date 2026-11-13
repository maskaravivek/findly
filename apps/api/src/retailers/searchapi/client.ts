export const SEARCHAPI_ENDPOINT = "https://www.searchapi.io/api/v1/search";
export type SearchApiParams = Record<string, string | number | boolean | undefined>;
export type SearchApiErrorCode = "http" | "timeout" | "network" | "invalid_response";
export type SearchApiClientOptions = { apiKey: string; timeoutMs: number; cacheTtlMs: number; fetch?: typeof fetch; retryDelayMs?: number; maxCacheEntries?: number };

/** Message is safe to log and surface; it never contains the API key or upstream body text. */
export class SearchApiError extends Error {
  constructor(readonly status: number, message: string, readonly code: SearchApiErrorCode = "http", readonly engine?: string) { super(message); this.name = "SearchApiError"; }
}

const retryable = (status: number) => status === 429 || status >= 500;
const httpMessage = (status: number, engine: string) =>
  status === 401 || status === 403 ? `SearchAPI rejected the credentials for ${engine} (${status})`
  : status === 400 ? `SearchAPI rejected the request parameters for ${engine} (400)`
  : status === 429 ? `SearchAPI rate limit reached for ${engine} (429)`
  : status === 503 ? `SearchAPI timeout for ${engine} (503)`
  : `SearchAPI request for ${engine} failed (${status})`;
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export function metadataFrom(raw: unknown): { id?: string; createdAt?: string } {
  const meta = raw && typeof raw === "object" ? (raw as { search_metadata?: unknown }).search_metadata : undefined;
  if (!meta || typeof meta !== "object") return {};
  const { id, created_at } = meta as { id?: unknown; created_at?: unknown };
  const parsed = typeof created_at === "string" ? new Date(created_at) : undefined;
  return { ...(typeof id === "string" ? { id } : {}), ...(parsed && !Number.isNaN(parsed.getTime()) ? { createdAt: parsed.toISOString() } : {}) };
}

export class SearchApiClient {
  private readonly cache = new Map<string, { expiresAt: number; value: Promise<unknown> }>();
  private readonly fetchImpl: typeof fetch;
  constructor(private readonly options: SearchApiClientOptions) { this.fetchImpl = options.fetch ?? globalThis.fetch.bind(globalThis); }

  static cacheKey(engine: string, params: SearchApiParams) {
    return `${engine}?${Object.keys(params).filter(k => params[k] !== undefined).sort().map(k => `${k}=${String(params[k])}`).join("&")}`;
  }

  search(engine: string, params: SearchApiParams, options: { signal?: AbortSignal } = {}): Promise<unknown> {
    const ttl = this.options.cacheTtlMs;
    if (ttl <= 0) return this.request(engine, params, options.signal);
    const key = SearchApiClient.cacheKey(engine, params), now = Date.now();
    const hit = this.cache.get(key);
    if (hit && hit.expiresAt > now) return hit.value;
    this.prune(now);
    const value = this.request(engine, params, options.signal);
    this.cache.set(key, { expiresAt: now + ttl, value });
    value.catch(() => { if (this.cache.get(key)?.value === value) this.cache.delete(key); });
    return value;
  }

  private prune(now: number) {
    for (const [key, entry] of this.cache) if (entry.expiresAt <= now) this.cache.delete(key);
    const max = this.options.maxCacheEntries ?? 500;
    while (this.cache.size >= max) { const oldest = this.cache.keys().next().value; if (oldest === undefined) break; this.cache.delete(oldest); }
  }

  private async request(engine: string, params: SearchApiParams, signal?: AbortSignal): Promise<unknown> {
    const url = new URL(SEARCHAPI_ENDPOINT);
    url.searchParams.set("engine", engine);
    for (const [key, value] of Object.entries(params)) if (value !== undefined && key !== "engine" && key !== "api_key") url.searchParams.set(key, String(value));
    for (let attempt = 0; ; attempt++) {
      const last = attempt >= 1;
      let response: Response;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.options.timeoutMs);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort, { once: true });
      try {
        response = await this.fetchImpl(url, { method: "GET", headers: { Authorization: `Bearer ${this.options.apiKey}`, Accept: "application/json" }, signal: controller.signal });
      } catch {
        if (signal?.aborted) throw new SearchApiError(0, `SearchAPI request for ${engine} was cancelled`, "network", engine);
        // Timeouts are not retried: a second full-length wait doubles user-facing latency.
        if (controller.signal.aborted) throw new SearchApiError(504, `SearchAPI request for ${engine} timed out after ${this.options.timeoutMs}ms`, "timeout", engine);
        if (last) throw new SearchApiError(0, `SearchAPI request for ${engine} failed (network error)`, "network", engine);
        await sleep(this.backoff(attempt));
        continue;
      } finally { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); }
      if (!response.ok) {
        if (retryable(response.status) && !last) { await response.body?.cancel().catch(() => undefined); await sleep(this.backoff(attempt, response.headers.get("retry-after"))); continue; }
        throw new SearchApiError(response.status, httpMessage(response.status, engine), "http", engine);
      }
      try { return await response.json(); }
      catch { throw new SearchApiError(response.status, `SearchAPI returned an unreadable response for ${engine}`, "invalid_response", engine); }
    }
  }

  private backoff(attempt: number, retryAfter?: string | null) {
    const seconds = retryAfter ? Number(retryAfter) : NaN;
    const base = this.options.retryDelayMs ?? 500;
    return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, 5_000) : base * 2 ** attempt;
  }
}
