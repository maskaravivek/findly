import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
import type { RetailerAdapter, RetailerSearchInput } from "@findly/retailer-sdk";

export const request: ShoppingRequest = {
  intent: "find_product_for_task", originalQuery: "cordless drill", possibleProductNames: ["cordless drill"], requiredFeatures: [], optionalFeatures: [], excludedFeatures: [],
  existingEquipment: [], compatibilityConstraints: [], preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [],
  currency: "USD", urgency: "no_preference", fulfillmentPreferences: [], clarificationNeeded: false, confidence: 0.8, location: { country: "US", postalCode: "10001" },
};

export function offer(id: string, retailerId = "amazon", title = "DEWALT 20V MAX Cordless Drill"): NormalizedRetailOffer {
  return {
    offerId: id, retailer: { id: retailerId, name: retailerId, domain: `${retailerId}.com` }, seller: { type: "first_party" },
    product: { title, rating: 4.7, reviewCount: 1200 },
    price: { item: { amountMinor: 9900, currency: "USD" }, total: { amountMinor: 9900, currency: "USD" } },
    fulfillment: { shipping: true, delivery: false, pickup: true, inStore: false, status: "in_stock", storeName: "Chelsea" },
    url: `https://${retailerId}.com/p/${id}`, source: { kind: "search_api", observedAt: "2026-11-12T00:00:00.000Z", liveVerified: true }, confidence: 0.9, warnings: [],
  };
}

const capabilities = { productSearch: true, productDetails: false, currentPrice: true, storeInventory: false, inventoryQuantity: false, pickupEstimate: true, deliveryEstimate: false, aisleLocation: false, bayLocation: false, cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: false };

export function fakeAdapter(id: string, search: (input: RetailerSearchInput) => NormalizedRetailOffer[]): RetailerAdapter & { calls: RetailerSearchInput[] } {
  const calls: RetailerSearchInput[] = [];
  return {
    calls,
    retailer: { id, name: id === "amazon" ? "Amazon" : "Walmart", domain: `${id}.com`, capabilities, live: true },
    supports: () => true,
    async searchProducts(input) { calls.push(input); return { retailerId: id, offers: search(input), observedAt: new Date().toISOString(), liveVerified: true, warnings: [] }; },
    async getProductDetails() { throw new Error("unused"); },
    async getStoreInventory() { return { status: "unknown" }; },
    async preparePurchaseLink({ offer }) { return { url: offer.url, retailerCheckout: false }; },
  };
}
