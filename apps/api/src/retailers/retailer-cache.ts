import { createHash } from "node:crypto";
import postgres from "postgres";
import { z } from "zod";
import { NormalizedRetailOfferSchema, RetailerIdSchema } from "@findly/contracts";
import type { RetailerAdapter, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";

export interface RetailerSearchCache {
  get(key: string): Promise<RetailerSearchResult | null>;
  set(key: string, value: RetailerSearchResult, ttlSeconds: number): Promise<void>;
}

const RetailerSearchResultSchema = z.object({
  retailerId: RetailerIdSchema,
  offers: z.array(NormalizedRetailOfferSchema),
  observedAt: z.iso.datetime(),
  liveVerified: z.boolean(),
  warnings: z.array(z.string())
});

export class PostgresRetailerSearchCache implements RetailerSearchCache {
  private readonly sql;

  constructor(databaseUrl: string, private readonly schema: string) {
    this.sql = postgres(databaseUrl, { max: 2, idle_timeout: 10, connect_timeout: 10 });
  }

  async get(key: string) {
    const table = this.sql(`${this.schema}.retailer_search_cache`);
    const rows = await this.sql<{ result: unknown }[]>`select result from ${table} where cache_key = ${key} and expires_at > now()`;
    const row = rows[0];
    return row ? RetailerSearchResultSchema.parse(row.result) : null;
  }

  async set(key: string, value: RetailerSearchResult, ttlSeconds: number) {
    const table = this.sql(`${this.schema}.retailer_search_cache`);
    await this.sql`
      insert into ${table} (cache_key, retailer_id, result, observed_at, expires_at, updated_at)
      values (${key}, ${value.retailerId}, ${this.sql.json(value)}, ${value.observedAt}, now() + (${ttlSeconds} * interval '1 second'), now())
      on conflict (cache_key) do update set
        retailer_id = excluded.retailer_id,
        result = excluded.result,
        observed_at = excluded.observed_at,
        expires_at = excluded.expires_at,
        updated_at = now()
    `;
    await this.sql`delete from ${table} where expires_at < now()`;
  }

  async close() { await this.sql.end(); }
}

const normalizedKey = (retailerId: string, input: RetailerSearchInput) => {
  const identity = JSON.stringify({
    retailerId,
    query: input.query.trim().toLowerCase().replace(/\s+/g, " "),
    category: input.request.category?.trim().toLowerCase(),
    postalCode: input.postalCode?.toUpperCase().replace(/\s+/g, ""),
    selectedStoreId: input.selectedStoreId,
    latitude: input.latitude?.toFixed(3),
    longitude: input.longitude?.toFixed(3)
  });
  return createHash("sha256").update(identity).digest("hex");
};

const asCached = (result: RetailerSearchResult): RetailerSearchResult => {
  const warning = `Using a recent cached result verified at ${result.observedAt}`;
  return {
    ...result,
    liveVerified: false,
    warnings: [...result.warnings, warning],
    offers: result.offers.map(offer => ({
      ...offer,
      source: { ...offer.source, kind: "cached_verified", liveVerified: false },
      warnings: [...offer.warnings, warning]
    }))
  };
};

export class CachedRetailerAdapter implements RetailerAdapter {
  readonly retailer;

  constructor(
    private readonly adapter: RetailerAdapter,
    private readonly cache: RetailerSearchCache,
    private readonly ttlSeconds: number
  ) {
    this.retailer = adapter.retailer;
  }

  supports(capability: Parameters<RetailerAdapter["supports"]>[0]) { return this.adapter.supports(capability); }

  async searchProducts(input: RetailerSearchInput, context: RetailerExecutionContext) {
    const key = normalizedKey(this.retailer.id, input);
    const cached = await this.cache.get(key);
    if (cached) return asCached(cached);
    const result = await this.adapter.searchProducts(input, context);
    if (result.liveVerified && result.offers.length > 0) await this.cache.set(key, result, this.ttlSeconds);
    return result;
  }

  getProductDetails(input: Parameters<RetailerAdapter["getProductDetails"]>[0], context: RetailerExecutionContext) { return this.adapter.getProductDetails(input, context); }
  getStoreInventory(input: Parameters<RetailerAdapter["getStoreInventory"]>[0], context: RetailerExecutionContext) { return this.adapter.getStoreInventory(input, context); }
  getAisleLocation(input: { offerId: string; storeId: string }, context: RetailerExecutionContext) { return this.adapter.getAisleLocation ? this.adapter.getAisleLocation(input, context) : Promise.resolve({}); }
  preparePurchaseLink(input: Parameters<RetailerAdapter["preparePurchaseLink"]>[0]) { return this.adapter.preparePurchaseLink(input); }
}
