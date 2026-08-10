import { MemorySaver } from "@langchain/langgraph";
import { describe, expect, it } from "vitest";
import { ShoppingRequestSchema, type NormalizedRetailOffer, type RetailerCapabilities } from "@findly/contracts";
import type { RetailerAdapter } from "@findly/retailer-sdk";
import { MockModelProvider } from "../src/models/providers.js";
import { createShoppingGraph, initialState } from "../src/graph/shopping-graph.js";

const capabilities: RetailerCapabilities = {
  productSearch: true, productDetails: true, currentPrice: true, storeInventory: true, inventoryQuantity: true,
  pickupEstimate: true, deliveryEstimate: false, aisleLocation: false, bayLocation: false,
  cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: true,
};

const offer = (offerId: string, title: string, amountMinor: number): NormalizedRetailOffer => ({
  offerId,
  retailer: { id: "home_depot_ca", name: "Home Depot Canada", domain: "homedepot.ca" },
  seller: { type: "first_party" },
  product: { title },
  price: { item: { amountMinor, currency: "CAD" }, total: { amountMinor, currency: "CAD" } },
  fulfillment: { shipping: true, delivery: false, pickup: false, inStore: false, status: "in_stock" },
  url: `https://www.homedepot.ca/product/${offerId}`,
  source: { kind: "browser_verified", observedAt: "2026-08-10T12:00:00.000Z", liveVerified: true },
  confidence: 0.9,
  warnings: [],
});

describe("shopping graph product matching", () => {
  it("warns about retailer results rejected by the relevance gate", async () => {
    const request = ShoppingRequestSchema.parse({
      intent: "find_product_for_task", originalQuery: "drilling machine", possibleProductNames: ["drilling machine"],
      requiredFeatures: [], optionalFeatures: [], excludedFeatures: [], existingEquipment: [], compatibilityConstraints: [],
      preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [], currency: "CAD",
      urgency: "no_preference", fulfillmentPreferences: [], clarificationNeeded: false, confidence: 0.8,
    });
    class LiteralModelProvider extends MockModelProvider {
      override async understandShoppingRequest() { return request; }
    }
    const attemptedQueries: string[] = [];
    const adapter: RetailerAdapter = {
      retailer: { id: "home_depot_ca", name: "Home Depot Canada", domain: "homedepot.ca", capabilities, live: true },
      supports: capability => capabilities[capability],
      async searchProducts(input) {
        attemptedQueries.push(input.query);
        return {
          retailerId: "home_depot_ca" as const,
          offers: input.query === "drilling machine"
            ? [offer("toque", "Toque 100% Acrylic", 598)]
            : [offer("drill", "20V Cordless Drill Driver", 4_999)],
          observedAt: "2026-08-10T12:00:00.000Z", liveVerified: true, warnings: [],
        };
      },
      async getProductDetails() { return offer("drill", "20V Cordless Drill Driver", 4_999); },
      async getStoreInventory() { return { status: "unknown" }; },
      async preparePurchaseLink(input) { return { url: input.offer.url, retailerCheckout: true }; },
    };
    const graph = createShoppingGraph(new LiteralModelProvider(), [adapter], new MemorySaver());

    const result = await graph.invoke(initialState("req_match", "req_match", { text: "drilling machine", imageIds: [] }), {
      configurable: { thread_id: "req_match" },
    });

    expect(result.rankedOffers.map(resultOffer => resultOffer.offerId)).toEqual(["drill"]);
    expect(result.warnings).toContain("Excluded 1 retailer result that did not match the requested product");
    expect(attemptedQueries).toEqual(["drilling machine", "drill"]);
  });
});
