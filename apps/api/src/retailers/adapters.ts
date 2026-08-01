import { demoOffers } from "@findly/test-fixtures";
import type { RetailerAdapter, RetailerDefinition, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";
import type { NormalizedRetailOffer, RetailerCapabilities, RetailerId } from "@findly/contracts";
const baseCapabilities: RetailerCapabilities = { productSearch: true, productDetails: true, currentPrice: true, storeInventory: false, inventoryQuantity: false, pickupEstimate: false, deliveryEstimate: false, aisleLocation: false, bayLocation: false, cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: false };
const definitions: Array<[RetailerId, string, string, Partial<RetailerCapabilities>]> = [
  ["home_depot_ca", "Home Depot Canada", "homedepot.ca", { storeInventory: true, pickupEstimate: true, aisleLocation: true, bayLocation: true, browserAutomation: true }],
  ["amazon_ca", "Amazon Canada", "amazon.ca", {}], ["walmart_ca", "Walmart Canada", "walmart.ca", { storeInventory: true, pickupEstimate: true }],
  ["canadian_tire", "Canadian Tire", "canadiantire.ca", { storeInventory: true, aisleLocation: true, pickupEstimate: true }], ["rona_ca", "RONA", "rona.ca", { storeInventory: true, pickupEstimate: true }], ["best_buy_ca", "Best Buy Canada", "bestbuy.ca", { storeInventory: true, pickupEstimate: true }]
];
export class DemoRetailerAdapter implements RetailerAdapter {
  readonly retailer: RetailerDefinition;
  constructor(tuple: typeof definitions[number]) { this.retailer = { id: tuple[0], name: tuple[1], domain: tuple[2], capabilities: { ...baseCapabilities, ...tuple[3] }, live: false }; }
  supports(capability: keyof RetailerCapabilities) { return this.retailer.capabilities[capability]; }
  async searchProducts(_input: RetailerSearchInput, _context: RetailerExecutionContext): Promise<RetailerSearchResult> { const offers = demoOffers.filter(o => o.retailer.id === this.retailer.id); return { retailerId: this.retailer.id, offers, observedAt: new Date().toISOString(), liveVerified: false, warnings: offers.length ? ["Demo fixture; not live retailer data"] : ["Adapter contract implemented; live integration not enabled"] }; }
  async getProductDetails(input: { url: string }, _context: RetailerExecutionContext) { const found = demoOffers.find(o => o.url === input.url && o.retailer.id === this.retailer.id); if (!found) throw new Error("Product not found in demo fixtures"); return found; }
  async getStoreInventory(input: { offerId: string; storeId: string }, _context: RetailerExecutionContext) { const found = demoOffers.find(o => o.offerId === input.offerId); return { status: found?.fulfillment.status ?? "unknown" }; }
  async getAisleLocation(input: { offerId: string; storeId: string }, _context: RetailerExecutionContext) { const found = demoOffers.find(o => o.offerId === input.offerId); return { ...(found?.fulfillment.aisle ? { aisle: found.fulfillment.aisle } : {}), ...(found?.fulfillment.bay ? { bay: found.fulfillment.bay } : {}) }; }
  async preparePurchaseLink(input: { offer: NormalizedRetailOffer }) { return { url: input.offer.url, retailerCheckout: true }; }
}
export const demoAdapters = definitions.map(d => new DemoRetailerAdapter(d));
