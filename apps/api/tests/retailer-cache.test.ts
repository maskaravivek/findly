import { describe, expect, it } from "vitest";
import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
import type { RetailerAdapter, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";
import { CachedRetailerAdapter, type RetailerSearchCache } from "../src/retailers/retailer-cache.js";

const observedAt = "2026-07-15T12:00:00.000Z";
const request: ShoppingRequest = {
  intent: "find_product_for_task", possibleProductNames: ["cordless drill"], requiredFeatures: [], optionalFeatures: [], excludedFeatures: [],
  existingEquipment: [], compatibilityConstraints: [], preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [],
  currency: "CAD", urgency: "today", fulfillmentPreferences: ["pickup"], clarificationNeeded: false, confidence: 0.9
};
const input: RetailerSearchInput = { request, query: "cordless drill", postalCode: "L1H 6L9", latitude: 43.897, longitude: -78.865 };
const offer: NormalizedRetailOffer = {
  offerId: "home-depot:123", retailer: { id: "home_depot_ca", name: "Home Depot Canada", domain: "homedepot.ca" }, seller: { type: "first_party" },
  product: { title: "Cordless drill", modelNumber: "DCD793D1" }, price: { item: { amountMinor: 12_800, currency: "CAD" }, total: { amountMinor: 12_800, currency: "CAD" } },
  fulfillment: { shipping: true, delivery: false, pickup: true, inStore: true, status: "in_stock", inventoryQuantity: 4, storeId: "7123", storeName: "Oshawa Home Depot" },
  url: "https://www.homedepot.ca/product/example", source: { kind: "browser_verified", observedAt, liveVerified: true }, confidence: 0.9, warnings: []
};

class TestCache implements RetailerSearchCache {
  value: RetailerSearchResult | null = null;
  async get() { return this.value; }
  async set(_key: string, value: RetailerSearchResult) { this.value = value; }
}

describe("retailer search cache", () => {
  it("reuses a recent result without claiming it was verified during the current search", async () => {
    let calls = 0;
    const result: RetailerSearchResult = { retailerId: "home_depot_ca", offers: [offer], observedAt, liveVerified: true, warnings: [] };
    const adapter = {
      retailer: { id: "home_depot_ca", name: "Home Depot Canada", domain: "homedepot.ca", live: true, capabilities: { productSearch: true, productDetails: true, currentPrice: true, storeInventory: true, inventoryQuantity: true, pickupEstimate: true, deliveryEstimate: false, aisleLocation: true, bayLocation: true, cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: true } },
      supports: () => true,
      searchProducts: async () => { calls += 1; return result; },
      getProductDetails: async () => offer,
      getStoreInventory: async () => ({ status: "in_stock", quantity: 4 }),
      preparePurchaseLink: async () => ({ url: offer.url, retailerCheckout: true })
    } satisfies RetailerAdapter;
    const cached = new CachedRetailerAdapter(adapter, new TestCache(), 300);

    const first = await cached.searchProducts(input, { requestId: "one", correlationId: "one" });
    const second = await cached.searchProducts(input, { requestId: "two", correlationId: "two" });

    expect(calls).toBe(1);
    expect(first.liveVerified).toBe(true);
    expect(second.liveVerified).toBe(false);
    expect(second.observedAt).toBe(observedAt);
    expect(second.offers[0]?.source).toMatchObject({ kind: "cached_verified", observedAt, liveVerified: false });
    expect(second.warnings.join(" ")).toContain("cached");
  });
});
