import { afterEach, describe, expect, it, vi } from "vitest";
import { searchApiFixtures } from "@findly/test-fixtures";
import { NormalizedRetailOfferSchema, type ShoppingRequest } from "@findly/contracts";
import type { RetailerSearchInput } from "@findly/retailer-sdk";
import { EnvSchema } from "../src/config/env.js";
import { SearchApiClient } from "../src/retailers/searchapi/client.js";
import { SEARCHAPI_ENGINES, amazonDeliveryEstimate, capTitle, cleanAmazonDelivery, normalizeLink } from "../src/retailers/searchapi/engines.js";
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
    expect(result).toMatchObject({ retailerId: "amazon", liveVerified: true, observedAt: "2026-11-13T01:31:12.000Z", warnings: [skipped] });
    expect(result.offers.map(o => o.offerId)).toEqual(["amazon:B00IJ0ALYS", "amazon:B00ET5VMTU", "amazon:B0CC1RHJY1", "amazon:B0GNB4XT2G", "amazon:B0C3TGRLLM", "amazon:B08YJTYDD4"]);
    const [first, , third] = result.offers;
    expect(first).toMatchObject({
      retailer: { id: "amazon", name: "Amazon", domain: "amazon.com" }, seller: { type: "first_party" }, url: "https://www.amazon.com/dp/B00IJ0ALYS",
      price: { item: { amountMinor: 14900, currency: "USD" }, total: { amountMinor: 14900, currency: "USD" } },
      product: { rating: 4.7, reviewCount: 61409, imageUrl: (searchApiFixtures.amazon_search.organic_results[0] as { thumbnail: string }).thumbnail },
      // standard_delivery is the "Join Prime to get FREE delivery Tomorrow" upsell, so the non-member date is used.
      fulfillment: { shipping: true, delivery: true, pickup: false, status: "unknown", estimate: "Delivery Tue, Nov 17" },
      source: { kind: "search_api", liveVerified: true }, confidence: 0.85
    });
    expect(first!.product.brand).toBeUndefined();
    expect(third).toMatchObject({ price: { item: { amountMinor: 2999 } }, product: { rating: 4.4, reviewCount: 7958 }, fulfillment: { estimate: "Delivery Tue, Nov 17 on $35 of items shipped by Amazon" } });
  });

  it("cleans Amazon delivery text", () => {
    expect(cleanAmazonDelivery("Or Non-members get FREE delivery Tue, Nov 17")).toBe("Delivery Tue, Nov 17");
    expect(cleanAmazonDelivery("Or fastest delivery Tomorrow, Nov 13")).toBe("Fastest delivery Tomorrow, Nov 13");
    expect(cleanAmazonDelivery("FREE delivery Thu, Nov 20 on $35 of items")).toBe("Delivery Thu, Nov 20 on $35 of items");
    expect(cleanAmazonDelivery("  ")).toBeUndefined();
    const long = cleanAmazonDelivery("FREE delivery Thu, Nov 20 on $35 of items shipped by Amazon or faster with a membership upgrade");
    expect(long!.length).toBeLessThanOrEqual(60);
    expect(long).toMatch(/^Delivery Thu, Nov 20 .*…$/);
    expect(amazonDeliveryEstimate({ standard_delivery: { text: "FREE delivery Mon, Nov 17" }, fastest_delivery: { text: "Or fastest delivery Tomorrow, Nov 13" } })).toBe("Delivery Mon, Nov 17");
    expect(amazonDeliveryEstimate({ standard_delivery: { text: "Join Prime to get FREE delivery Tomorrow, Nov 13", type: "Join Prime" } })).toBe("Delivery Tomorrow, Nov 13");
  });

  it("normalises relative and Google redirect links", () => {
    expect(normalizeLink("/ip/Drill/123?classType=REGULAR", "https://www.walmart.com")).toBe("https://www.walmart.com/ip/Drill/123?classType=REGULAR");
    expect(normalizeLink("https://www.google.com/url?q=https://www.acmetools.com/p/1&sa=U", "https://www.google.com")).toBe("https://www.acmetools.com/p/1");
    expect(normalizeLink("/url?url=https%3A%2F%2Fwww.ebay.com%2Fitm%2F1", "https://www.google.com")).toBe("https://www.ebay.com/itm/1");
    expect(normalizeLink("javascript:alert(1)", "https://www.google.com")).toBeUndefined();
  });

  it("derives Amazon storefront and currency from the country", async () => {
    const { search, sentParams } = setup("amazon_search");
    const result = await search({ country: "CA", postalCode: "L1H 7K4" });
    expect(sentParams()).toMatchObject({ amazon_domain: "amazon.ca", delivery_country: "CA", postal_code: "L1H 7K4" });
    expect(result.offers[0]).toMatchObject({ retailer: { domain: "amazon.ca" }, price: { item: { amountMinor: 14900, currency: "CAD" } } });
    const uk = setup("amazon_search");
    expect((await uk.search({ country: "GB" })).offers[0]!.price.item.currency).toBe("GBP");
    expect(uk.sentParams().amazon_domain).toBe("amazon.co.uk");
  });

  it("maps Walmart results and warns outside the US", async () => {
    const { search, sentParams } = setup("walmart_search");
    const result = await search({ country: "CA", sortBy: "price_low_to_high" });
    expect(sentParams()).toMatchObject({ engine: "walmart_search", sort_by: "price_low_to_high" });
    expect(result.warnings).toEqual([expect.stringContaining("US stores only"), skipped]);
    expect(result.offers.map(o => o.offerId)).toEqual(["walmart:18851314230", "walmart:18930313407", "walmart:18818517092", "walmart:2989084669", "walmart:5353073693", "walmart:5319484306"]);
    const [first, , , fourth] = result.offers;
    expect(first).toMatchObject({
      seller: { name: "Walmart.com", type: "first_party" }, price: { item: { amountMinor: 4997, currency: "USD" } }, product: { rating: 4.5, reviewCount: 274 },
      url: expect.stringMatching(/^https:\/\/www\.walmart\.com\/ip\/Greenworks-PowerAll-24V-.*\/18851314230\?/),
      fulfillment: { shipping: true, pickup: true, delivery: true, status: "unknown", estimate: "Delivery by Fri, Nov 13" }
    });
    expect(fourth).toMatchObject({ seller: { name: "Tools R US", type: "marketplace" }, price: { item: { amountMinor: 6500 } }, fulfillment: { pickup: false, delivery: true, estimate: "Delivery by Sat, Nov 14" } });
    expect((await setup("walmart_search").search()).warnings).toEqual([skipped]);
  });

  it("maps Home Depot results with delivery stock", async () => {
    const { search, sentParams } = setup("home_depot_search");
    const result = await search({ selectedStoreId: "6907", postalCode: "10001", maxPrice: 99.5 });
    expect(sentParams()).toMatchObject({ store_id: "6907", postal_code: "10001", price_max: "100" });
    expect(result.warnings).toEqual([skipped]);
    expect(result.offers.map(o => o.offerId)).toEqual(["home_depot:342705642", "home_depot:345151401", "home_depot:345151535", "home_depot:317987598", "home_depot:315994093", "home_depot:315444524"]);
    expect(result.offers[3]).toMatchObject({
      retailer: { id: "home_depot", name: "The Home Depot" }, price: { item: { amountMinor: 5900, currency: "USD" } },
      product: { brand: "RYOBI", modelNumber: "PCL206K1", rating: 4.7, reviewCount: 4332 }, url: "https://www.homedepot.com/p/RYOBI-ONE-18V-Cordless-1-2-in-Drill-Driver-Kit-with-1-Compact-Battery-and-Charger-PCL206K1/317987598",
      fulfillment: { shipping: true, delivery: true, pickup: false, inStore: false, status: "in_stock", estimate: "Delivery Fri, Nov 13" }
    });
  });

  it("maps Home Depot store pickup and inventory", async () => {
    // The recording has no store_id, so no pickup block; this item adds the documented pickup shape to a recorded one.
    const recorded = searchApiFixtures.home_depot_search.organic_results[3] as { fulfillment: Record<string, unknown> };
    const item = { ...recorded, fulfillment: { ...recorded.fulfillment, pickup: { store_id: "6907", store_name: "Manhattan 23rd St", stock: 37 } } };
    const parsed = SEARCHAPI_ENGINES.home_depot_search!.itemSchema.parse(item);
    expect(SEARCHAPI_ENGINES.home_depot_search!.toOffer(parsed, { observedAt: "2026-11-13T01:31:18.000Z", currency: "USD", domain: "homedepot.com" })).toMatchObject({
      offerId: "home_depot:317987598", fulfillment: { pickup: true, inStore: true, status: "in_stock", storeId: "6907", storeName: "Manhattan 23rd St", inventoryQuantity: 37, estimate: "Pickup at Manhattan 23rd St" }
    });
  });

  it("maps Best Buy results", async () => {
    const result = await setup("bestbuy_search").search();
    expect(result.offers.map(o => [o.offerId, o.price.item.amountMinor, o.seller.type])).toEqual([
      ["best_buy:11443229", 7499, "marketplace"], ["best_buy:12476337", 11999, "marketplace"], ["best_buy:13178533", 16999, "marketplace"],
      ["best_buy:11212130", 19999, "marketplace"], ["best_buy:13013208", 10900, "marketplace"], ["best_buy:6674762", 15999, "first_party"]
    ]);
    expect(result.offers[0]).toMatchObject({ seller: { name: "Marketplace" }, product: { brand: "Pursonic", modelNumber: "PSPTS24-PSPTS47", rating: 5, reviewCount: 1 }, fulfillment: { shipping: true, delivery: false, pickup: false, status: "unknown" } });
    // Unrated listings arrive as rating 0 / reviews 0: keep the count, drop the misleading 0-star rating.
    expect(result.offers[5]).toMatchObject({ seller: { name: "Best Buy", type: "first_party" }, product: { reviewCount: 0 } });
    expect(result.offers[5]!.product.rating).toBeUndefined();
    expect(result.warnings).toEqual([skipped]);
  });

  it("maps Google Shopping results to the Google product page", async () => {
    const { search, sentParams } = setup("google_shopping");
    const result = await search({ sortBy: "price_high_to_low" });
    expect(sentParams()).toMatchObject({ gl: "us", sort_by: "price_high_to_low" });
    const [first, second, , , , sixth] = result.offers;
    expect(first).toMatchObject({
      offerId: "google_shopping:12306540703916217177", confidence: 0.75, url: expect.stringMatching(/^https:\/\/www\.google\.com\/search\?ibp=oshop&.*prds=headlineOfferDocid:12306540703916217177/),
      seller: { name: "Tool Factory Outlet", type: "marketplace" }, price: { item: { amountMinor: 9455, currency: "USD" } }, product: { rating: 5, reviewCount: 684 },
      fulfillment: { delivery: false }, warnings: ["Link opens a Google Shopping page"]
    });
    expect(second).toMatchObject({ offerId: "google_shopping:2247793873030585785", seller: { name: "Mercari" }, product: { rating: 3.9, reviewCount: 142 }, fulfillment: { delivery: true, estimate: "Free delivery" },
      warnings: ["Link opens a Google Shopping page", "Reseller via Google Shopping"] });
    for (const offer of result.offers) expect(offer.product.title.length).toBeLessThanOrEqual(160);
    expect(sixth).toMatchObject({ seller: { name: "Acme Tools" }, price: { item: { amountMinor: 15294 } }, fulfillment: { estimate: "Free delivery on $199+" } });
    expect(result.warnings).toEqual([skipped]);
  });

  it("caps long Google Shopping titles at 160 chars", () => {
    expect(capTitle("short title")).toBe("short title");
    const capped = capTitle("x".repeat(400));
    expect(capped).toHaveLength(160);
    expect(capped.endsWith("…")).toBe(true);
  });

  it.each(Object.keys(searchApiFixtures) as (keyof typeof searchApiFixtures)[])("yields at least 3 valid offers from the recorded %s response", async engine => {
    const result = await setup(engine).search({ maxResults: 50 });
    expect(result.offers.length).toBeGreaterThanOrEqual(3);
    for (const offer of result.offers) expect(NormalizedRetailOfferSchema.safeParse(offer).success).toBe(true);
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
  it("builds all five default engines, each with a prompt description", () => {
    const adapters = createSearchApiAdapters(EnvSchema.parse({ SEARCHAPI_API_KEY: "k" }));
    expect(adapters.map(a => a.retailer.id)).toEqual(["amazon", "walmart", "home_depot", "best_buy", "google_shopping"]);
    for (const adapter of adapters) expect(adapter.retailer.description).toMatch(/\w{10,}/);
  });
  it("defaults the agent budget to 12 searches of up to 10 offers", () => {
    expect(EnvSchema.parse({})).toMatchObject({ AGENT_MAX_TOOL_CALLS: 12, AGENT_MAX_RESULTS_PER_CALL: 10 });
  });
});
