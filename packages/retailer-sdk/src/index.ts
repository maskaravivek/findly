import type { NormalizedRetailOffer, RetailerCapabilities, RetailerId, ShoppingRequest } from "@findly/contracts";
export type RetailerDefinition = { id: RetailerId; name: string; domain: string; capabilities: RetailerCapabilities; live: boolean };
export type RetailerExecutionContext = { requestId: string; correlationId: string; signal?: AbortSignal };
export type RetailerSearchInput = {
  request: ShoppingRequest; query: string; postalCode?: string; country?: string; selectedStoreId?: string;
  latitude?: number; longitude?: number; locationAccuracyMeters?: number; locationApproximate?: boolean;
  maxPrice?: number; sortBy?: RetailerSortOrder; maxResults?: number;
};
export type RetailerSortOrder = "relevance" | "price_low_to_high" | "price_high_to_low" | "rating";
export type RetailerSearchResult = { retailerId: RetailerId; offers: NormalizedRetailOffer[]; observedAt: string; liveVerified: boolean; warnings: string[] };
export interface RetailerAdapter {
  readonly retailer: RetailerDefinition;
  supports(capability: keyof RetailerCapabilities): boolean;
  searchProducts(input: RetailerSearchInput, context: RetailerExecutionContext): Promise<RetailerSearchResult>;
  getProductDetails(input: { url: string }, context: RetailerExecutionContext): Promise<NormalizedRetailOffer>;
  getStoreInventory(input: { offerId: string; storeId: string }, context: RetailerExecutionContext): Promise<{ status: string; quantity?: number }>;
  getAisleLocation?(input: { offerId: string; storeId: string }, context: RetailerExecutionContext): Promise<{ aisle?: string; bay?: string }>;
  preparePurchaseLink(input: { offer: NormalizedRetailOffer }): Promise<{ url: string; retailerCheckout: boolean }>;
}
