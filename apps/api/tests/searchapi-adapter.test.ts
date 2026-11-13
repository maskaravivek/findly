import { afterEach, describe, expect, it, vi } from "vitest";
import { searchApiFixtures } from "@findly/test-fixtures";
import type { ShoppingRequest } from "@findly/contracts";
import type { RetailerSearchInput } from "@findly/retailer-sdk";
import { EnvSchema } from "../src/config/env.js";
import { SearchApiClient } from "../src/retailers/searchapi/client.js";
import { SEARCHAPI_ENGINES } from "../src/retailers/searchapi/engines.js";
import { SearchApiRetailerAdapter, createSearchApiAdapters } from "../src/retailers/searchapi/adapter.js";

const request: ShoppingRequest = {
  intent: "find_product_for_task", originalQuery: "cordless drill", possibleProductNames: [], requiredFeatures: [], optionalFeatures: [], excludedFeatures: [], existingEquipment: [],
  compatibilityConstraints: [], preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [], currency: "USD", urgency: "no_preference",
  fulfillmentPreferences: [], clarificationNeeded: false, confidence: 0.9
};
const ctx = { requestId: "r1", correlationId: "c1" };
const defaults = { country: "US", currency: "USD" };

function setup(engine: keyof typeof searchApiFixtures) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify(searchApiFixtures[engine]), { status: 200 }));
  const client = new SearchApiClient({ apiKey: "test-key", timeoutMs: 1_000, cacheTtlMs: 0, fetch });
  const adapter = new SearchApiRetailerAdapter(client, SEARCHAPI_ENGINES[engine]!, defaults);
  const search = (input: Partial<RetailerSearchInput> = {}) => adapter.searchProducts({ request, query: "cordless drill", ...input }, ctx);
  const sentParams = (call = 0) => Object.fromEntries(new URL(String(fetch.mock.calls[call]![0])).searchParams);
  return { adapter, fetch, search, sentParams };
}
const skipped = "1 result skipped (missing price or malformed)";

describe("SearchAPI engine mapping", () => {
  it("maps Amazon results", async () => {
    const { search, sentParams } = setup("amazon_search");
    const result = await search({ sortBy: "rating", maxPrice: 150 });
    expect(sentParams()).toMatchObject({ engine: "amazon_search", q: "cordless drill", amazon_domain: "amazon.com", delivery_country: "US", sort_by: "average_review", price_max: "150" });
    expect(result).toMatchObject({ retailerId: "amazon", liveVerified: true, observedAt: "2026-11-12T15:04:21.000Z", warnings: [skipped] });
    expect(result.offers.map(o => o.offerId)).toEqual(["amazon:B00ET5VMTU", "amazon:B0CKT1L6X5"]);
    const [first, second] = result.offers;
    expect(first).toMatchObject({
      retailer: { id: "amazon", name: "Amazon", domain: "amazon.com" }, seller: { type: "first_party" }, url: "https://www.amazon.com/dp/B00ET5VMTU",
      price: { item: { amountMinor: 9900, currency: "USD" }, total: { amountMinor: 9900, currency: "USD" } },
      product: { brand: "DEWALT", rating: 4.7, reviewCount: 52813, imageUrl: "https://m.media-amazon.com/images/I/71Yc+1M5JcL._AC_UL320_.jpg" },
      fulfillment: { shipping: true, delivery: true, pickup: false, status: "unknown", estimate: "Or fastest delivery Tomorrow, Nov 13" },
      source: { kind: "search_api", liveVerified: true }, confidence: 0.85
    });
    expect(second).toMatchObject({ price: { item: { amountMinor: 3998 } }, product: { rating: 4.5, reviewCount: 18200 }, fulfillment: { estimate: expect.stringMatching(/^FREE delivery Thu/) } });
  });

  it("derives Amazon storefront and currency from the country", async () => {
    const { search, sentParams } = setup("amazon_search");
    const result = await search({ country: "CA", postalCode: "L1H 7K4" });
    expect(sentParams()).toMatchObject({ amazon_domain: "amazon.ca", delivery_country: "CA", postal_code: "L1H 7K4" });
    expect(result.offers[0]).toMatchObject({ retailer: { domain: "amazon.ca" }, price: { item: { amountMinor: 9900, currency: "CAD" } } });
    const uk = setup("amazon_search");
    expect((await uk.search({ country: "GB" })).offers[0]!.price.item.currency).toBe("GBP");
    expect(uk.sentParams().amazon_domain).toBe("amazon.co.uk");
  });

  it("maps Walmart results and warns outside the US", async () => {
    const { search, sentParams } = setup("walmart_search");
    const result = await search({ country: "CA", sortBy: "price_low_to_high" });
    expect(sentParams()).toMatchObject({ engine: "walmart_search", sort_by: "price_low_to_high" });
    expect(result.warnings).toEqual([expect.stringContaining("US stores only"), skipped]);
    const [first, second] = result.offers;
    expect(first).toMatchObject({
      offerId: "walmart:837417451", seller: { name: "Walmart.com", type: "first_party" }, price: { item: { amountMinor: 2988, currency: "USD" } },
      product: { rating: 4.4, reviewCount: 9871 }, url: "https://www.walmart.com/ip/Hyper-Tough-20V-Max-Cordless-Drill/837417451",
      fulfillment: { pickup: true, delivery: true, status: "in_stock", estimate: "Pickup today" }
    });
    expect(second).toMatchObject({ offerId: "walmart:1484912630", seller: { name: "ToolsDirect Outlet", type: "marketplace" }, product: { rating: 4.7, reviewCount: 2140 }, fulfillment: { pickup: false, delivery: true, status: "unknown" } });
    expect((await setup("walmart_search").search()).warnings).toEqual([skipped]);
  });

  it("maps Home Depot results with store pickup and inventory", async () => {
    const { search, sentParams } = setup("home_depot_search");
    const result = await search({ selectedStoreId: "6907", postalCode: "10001", maxPrice: 99.5 });
    expect(sentParams()).toMatchObject({ store_id: "6907", postal_code: "10001", price_max: "100" });
    expect(result.warnings).toEqual([skipped]);
    const [first, second] = result.offers;
    expect(first).toMatchObject({
      offerId: "home_depot:204279858", retailer: { id: "home_depot", name: "The Home Depot" }, price: { item: { amountMinor: 9900, currency: "USD" } },
      product: { brand: "DEWALT", modelNumber: "DCD771C2", rating: 4.7, reviewCount: 11458 },
      fulfillment: { pickup: true, inStore: true, delivery: true, status: "in_stock", storeId: "6907", storeName: "Manhattan 23rd St", inventoryQuantity: 37 }
    });
    expect(second).toMatchObject({ offerId: "home_depot:318083167", product: { reviewCount: 3902 }, fulfillment: { pickup: false, status: "unknown", inventoryQuantity: 0 } });
  });

  it("maps Best Buy results", async () => {
    const result = await setup("bestbuy_search").search();
    expect(result.offers.map(o => [o.offerId, o.price.item.amountMinor, o.seller.type])).toEqual([["best_buy:6418036", 9999, "first_party"], ["best_buy:6531122", 7499, "marketplace"]]);
    expect(result.offers[0]).toMatchObject({ product: { modelNumber: "DCD771C2", rating: 4.8, reviewCount: 1873 }, fulfillment: { shipping: true, delivery: false, pickup: false, status: "unknown" } });
    expect(result.warnings).toEqual([skipped]);
  });

  it("maps Google Shopping results to the Google product page", async () => {
    const { search, sentParams } = setup("google_shopping");
    const result = await search({ sortBy: "price_high_to_low" });
    expect(sentParams()).toMatchObject({ gl: "us", sort_by: "price_high_to_low" });
    const [first, second] = result.offers;
    expect(first).toMatchObject({
      offerId: "google_shopping:14019378181107046593", url: "https://www.google.com/shopping/product/14019378181107046593?gl=us", confidence: 0.75,
      seller: { name: "The Home Depot", type: "marketplace" }, price: { item: { amountMinor: 9900, currency: "USD" } },
      fulfillment: { delivery: true, estimate: "Free delivery by Sat, Nov 15" }, warnings: ["Link opens a Google Shopping page"]
    });
    expect(second).toMatchObject({ product: { rating: 4.6, reviewCount: 4200 }, fulfillment: { delivery: false } });
    expect(result.warnings).toEqual([skipped]);
  });

  it("slices to maxResults and tolerates a missing results array", async () => {
    expect((await setup("walmart_search").search({ maxResults: 1 })).offers).toHaveLength(1);
    const fetch = vi.fn<typeof globalThis.fetch>(async () => new Response(JSON.stringify({ search_metadata: { id: "x" } })));
    const adapter = new SearchApiRetailerAdapter(new SearchApiClient({ apiKey: "k", timeoutMs: 1_000, cacheTtlMs: 0, fetch }), SEARCHAPI_ENGINES.amazon_search!, defaults);
    expect(await adapter.searchProducts({ request, query: "drill" }, ctx)).toMatchObject({ offers: [], warnings: [] });
  });

  it("declares capabilities and unsupported operations", async () => {
    const { adapter, search } = setup("home_depot_search");
    expect(adapter.supports("storeInventory")).toBe(true);
    expect(adapter.supports("aisleLocation")).toBe(false);
    const offer = (await search()).offers[0]!;
    await expect(adapter.preparePurchaseLink({ offer })).resolves.toEqual({ url: offer.url, retailerCheckout: true });
    await expect(adapter.getProductDetails({ url: offer.url }, ctx)).rejects.toThrow(/not supported/);
    await expect(adapter.getStoreInventory({ offerId: offer.offerId, storeId: "6907" }, ctx)).rejects.toThrow(/not supported/);
  });
});

describe("createSearchApiAdapters", () => {
  afterEach(() => vi.restoreAllMocks());
  it("builds one adapter per known engine and ignores unknown ones", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const env = EnvSchema.parse({ SEARCHAPI_API_KEY: "k", SEARCHAPI_ENGINES: "amazon_search, ebay_search ,google_shopping" });
    expect(createSearchApiAdapters(env).map(a => a.retailer.id)).toEqual(["amazon", "google_shopping"]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("ebay_search"));
  });
  it("builds all five default engines", () => {
    expect(createSearchApiAdapters(EnvSchema.parse({ SEARCHAPI_API_KEY: "k" })).map(a => a.retailer.id)).toEqual(["amazon", "walmart", "home_depot", "best_buy", "google_shopping"]);
  });
});
