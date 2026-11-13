import { KNOWN_RETAILERS, NormalizedRetailOfferSchema, type NormalizedRetailOffer, type RetailerCapabilities } from "../../contracts.js";
import type { RetailerAdapter, RetailerDefinition, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "../types.js";
import { searchApiEngines, type Env } from "../../config/env.js";
import { SearchApiClient, metadataFrom } from "./client.js";
import { SEARCHAPI_ENGINES, type EngineDefaults, type SearchApiEngineDefinition } from "./engines.js";

const noCapabilities: RetailerCapabilities = { productSearch: false, productDetails: false, currentPrice: false, storeInventory: false, inventoryQuantity: false, pickupEstimate: false, deliveryEstimate: false, aisleLocation: false, bayLocation: false, cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: false };
const skippedWarning = (count: number) => `${count} ${count === 1 ? "result" : "results"} skipped (missing price or malformed)`;

export class SearchApiRetailerAdapter implements RetailerAdapter {
  readonly retailer: RetailerDefinition;
  constructor(private readonly client: SearchApiClient, readonly definition: SearchApiEngineDefinition, private readonly defaults: EngineDefaults) {
    const known = KNOWN_RETAILERS[definition.retailerId];
    this.retailer = { id: definition.retailerId, name: known?.name ?? definition.retailerId, domain: known?.domain ?? "", capabilities: { ...noCapabilities, ...definition.capabilities }, live: true, description: definition.description };
  }

  supports(capability: keyof RetailerCapabilities) { return this.retailer.capabilities[capability]; }

  async searchProducts(input: RetailerSearchInput, context: RetailerExecutionContext): Promise<RetailerSearchResult> {
    const { params, warnings, currency, domain } = this.definition.buildParams(input, this.defaults);
    const raw = await this.client.search(this.definition.engine, params, context.signal ? { signal: context.signal } : {});
    const observedAt = metadataFrom(raw).createdAt ?? new Date().toISOString();
    const items = raw && typeof raw === "object" ? (raw as Record<string, unknown>)[this.definition.resultsKey] : undefined;
    const list = Array.isArray(items) ? items : [];
    const offers: NormalizedRetailOffer[] = [];
    let skipped = 0;
    for (const item of list) {
      const parsed = this.definition.itemSchema.safeParse(item);
      const offer = parsed.success ? this.definition.toOffer(parsed.data, { observedAt, currency, domain }) : null;
      const valid = offer ? NormalizedRetailOfferSchema.safeParse(offer) : undefined;
      if (valid?.success) offers.push(valid.data); else skipped++;
    }
    return {
      retailerId: this.retailer.id, offers: offers.slice(0, input.maxResults ?? 10), observedAt, liveVerified: true,
      warnings: [...warnings, ...(skipped ? [skippedWarning(skipped)] : [])]
    };
  }

  async getProductDetails(_input: { url: string }, _context: RetailerExecutionContext): Promise<NormalizedRetailOffer> {
    throw new Error(`Product details are not supported by the SearchAPI ${this.definition.engine} adapter`);
  }

  async getStoreInventory(_input: { offerId: string; storeId: string }, _context: RetailerExecutionContext): Promise<{ status: string; quantity?: number }> {
    throw new Error(`Store inventory lookup is not supported by the SearchAPI ${this.definition.engine} adapter`);
  }

  async preparePurchaseLink(input: { offer: NormalizedRetailOffer }) { return { url: input.offer.url, retailerCheckout: this.definition.retailerId !== "google_shopping" }; }
}

export function createSearchApiAdapters(env: Env, client?: SearchApiClient): RetailerAdapter[] {
  if (!env.SEARCHAPI_API_KEY && !client) throw new Error("SEARCHAPI_API_KEY is required");
  const shared = client ?? new SearchApiClient({ apiKey: env.SEARCHAPI_API_KEY ?? "", timeoutMs: env.SEARCHAPI_TIMEOUT_MS, cacheTtlMs: env.SEARCHAPI_CACHE_TTL_MS });
  const defaults = { country: env.DEFAULT_COUNTRY, currency: env.DEFAULT_CURRENCY };
  const adapters: RetailerAdapter[] = [];
  for (const engine of new Set(searchApiEngines(env))) {
    const definition = SEARCHAPI_ENGINES[engine];
    if (!definition) { console.warn(`Ignoring unknown SearchAPI engine "${engine}"`); continue; }
    adapters.push(new SearchApiRetailerAdapter(shared, definition, defaults));
  }
  return adapters;
}
