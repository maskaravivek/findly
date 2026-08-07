import { describe, expect, it } from "vitest";
import { ShoppingRequestSchema, type NormalizedRetailOffer } from "@findly/contracts";
import { rankOffers } from "../src/ranking/rank-offers.js";

const observedAt = new Date().toISOString();
const offer = (overrides: Partial<NormalizedRetailOffer>): NormalizedRetailOffer => ({
  offerId: "offer", retailer: { id: "amazon_ca", name: "Amazon Canada", domain: "amazon.ca" }, seller: { type: "unknown" },
  product: { title: "Cordless drill" }, price: { item: { amountMinor: 5_000, currency: "CAD" }, total: { amountMinor: 5_000, currency: "CAD" } },
  fulfillment: { shipping: true, delivery: true, pickup: false, inStore: false, status: "in_stock" },
  url: "https://www.amazon.ca/dp/example", source: { kind: "browser_verified", observedAt, liveVerified: true }, confidence: 0.8, warnings: [], ...overrides
});
const request = ShoppingRequestSchema.parse({
  intent: "find_product_for_task", possibleProductNames: ["cordless drill"], requiredFeatures: [], optionalFeatures: [], excludedFeatures: [],
  existingEquipment: [], compatibilityConstraints: [], preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [],
  currency: "CAD", urgency: "today", fulfillmentPreferences: ["pickup"], clarificationNeeded: false, confidence: 0.9
});

describe("local fulfillment ranking", () => {
  it("prioritizes verified same-day store pickup over a cheaper online offer", () => {
    const amazon = offer({ offerId: "amazon" });
    const homeDepot = offer({
      offerId: "home-depot", retailer: { id: "home_depot_ca", name: "Home Depot Canada", domain: "homedepot.ca" }, seller: { type: "first_party" },
      price: { item: { amountMinor: 9_000, currency: "CAD" }, total: { amountMinor: 9_000, currency: "CAD" } },
      fulfillment: { shipping: true, delivery: false, pickup: true, inStore: true, status: "in_stock", inventoryQuantity: 4, storeId: "7123", storeName: "OSHAWA Home Depot", storeDistanceKm: 3.2 }
    });
    expect(rankOffers(request, [amazon, homeDepot])[0]?.offer.offerId).toBe("home-depot");
  });

  it("uses review volume to avoid over-weighting a single high rating", () => {
    const established = offer({
      offerId: "established",
      product: { title: "Cordless drill", rating: 4.7, reviewCount: 1_200 },
    });
    const singleReview = offer({
      offerId: "single-review",
      product: { title: "Cordless drill", rating: 5, reviewCount: 1 },
    });
    expect(rankOffers({ ...request, urgency: "no_preference", fulfillmentPreferences: [] }, [singleReview, established])[0]?.offer.offerId).toBe("established");
  });
});
