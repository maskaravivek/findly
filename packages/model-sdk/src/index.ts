import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
export type SearchPlan = { queries: string[]; retailerIds: string[]; exactMatch: boolean };
export type RecommendationSummary = { headline: string; explanation: string; bestOfferId?: string };
export interface ModelProvider {
  understandShoppingRequest(input: { text?: string; barcode?: string; imageIds: string[]; selectedStoreId?: string; postalCode?: string }): Promise<ShoppingRequest>;
  analyzeProductImages(input: { imageIds: string[] }): Promise<{ labels: string[]; confidence: number }>;
  generateSearchPlan(input: { request: ShoppingRequest }): Promise<SearchPlan>;
  compareAmbiguousProducts(input: { request: ShoppingRequest; offers: NormalizedRetailOffer[] }): Promise<{ equivalentOfferIds: string[]; reason: string }>;
  assessCompatibility(input: { request: ShoppingRequest; offer: NormalizedRetailOffer }): Promise<{ compatible: boolean | null; confidence: number; reason: string }>;
  summarizeRecommendation(input: { request: ShoppingRequest; rankedOffers: NormalizedRetailOffer[] }): Promise<RecommendationSummary>;
}
