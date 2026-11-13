import { describe, expect, it, vi } from "vitest";
import { SearchApiClient, SearchApiError, metadataFrom } from "../src/retailers/searchapi/client.js";

const KEY = "sk_test_super_secret_key";
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const client = (fetch: typeof globalThis.fetch, overrides: Partial<ConstructorParameters<typeof SearchApiClient>[0]> = {}) =>
  new SearchApiClient({ apiKey: KEY, timeoutMs: 1_000, cacheTtlMs: 60_000, retryDelayMs: 1, fetch, ...overrides });

describe("SearchApiClient", () => {
  it("sends engine, bearer auth and drops undefined params", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ ok: true }));
    await client(fetch).search("amazon_search", { q: "cordless drill", postal_code: undefined, price_max: 150, exclude: false });
    const [url, init] = fetch.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://www.searchapi.io/api/v1/search");
    expect(Object.fromEntries(parsed.searchParams)).toEqual({ engine: "amazon_search", q: "cordless drill", price_max: "150", exclude: "false" });
    expect((init?.headers as Record<string, string>).Authorization).toBe(`Bearer ${KEY}`);
    expect(String(url)).not.toContain(KEY);
  });

  it("serves repeat searches from the TTL cache regardless of param order", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ hits: 1 }));
    const c = client(fetch);
    const first = await c.search("walmart_search", { q: "drill", sort_by: "best_match", store_id: undefined });
    const second = await c.search("walmart_search", { sort_by: "best_match", q: "drill" });
    expect(second).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(1);
    await c.search("home_depot_search", { q: "drill", sort_by: "best_match" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("disables caching when ttl is 0", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({}));
    const c = client(fetch, { cacheTtlMs: 0 });
    await c.search("google_shopping", { q: "drill" });
    await c.search("google_shopping", { q: "drill" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries once on 503 then succeeds", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json({ error: "Timeout" }, 503)).mockResolvedValueOnce(json({ organic_results: [] }));
    await expect(client(fetch).search("bestbuy_search", { q: "drill" })).resolves.toEqual({ organic_results: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("retries a network error once and then fails with a typed error", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => { throw new TypeError("fetch failed"); });
    await expect(client(fetch).search("amazon_search", { q: "drill" })).rejects.toMatchObject({ name: "SearchApiError", code: "network" });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("turns 401 into a SearchApiError without leaking the key and does not retry or cache it", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json({ error: `Invalid API key ${KEY}` }, 401));
    const c = client(fetch);
    const error = await c.search("amazon_search", { q: "drill" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SearchApiError);
    expect(error).toMatchObject({ status: 401, code: "http", engine: "amazon_search" });
    expect(String((error as Error).message)).not.toContain(KEY);
    expect(JSON.stringify(error)).not.toContain(KEY);
    expect(fetch).toHaveBeenCalledTimes(1);
    await c.search("amazon_search", { q: "drill" }).catch(() => undefined);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("aborts after the timeout without retrying", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>((_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
    }));
    const error = await client(fetch, { timeoutMs: 20 }).search("walmart_search", { q: "drill" }).catch((e: unknown) => e);
    expect(error).toMatchObject({ name: "SearchApiError", status: 504, code: "timeout" });
    expect((error as Error).message).toMatch(/timed out/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("reads search_metadata", () => {
    expect(metadataFrom({ search_metadata: { id: "search_1", created_at: "2026-11-12T15:04:21Z" } })).toEqual({ id: "search_1", createdAt: "2026-11-12T15:04:21.000Z" });
    expect(metadataFrom({ search_metadata: { created_at: "garbage" } })).toEqual({});
    expect(metadataFrom(null)).toEqual({});
  });
});
