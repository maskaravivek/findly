import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
export type SearchPlan = { queries: string[]; retailerIds: string[]; exactMatch: boolean };
export type RecommendationSummary = { headline: string; explanation: string; bestOfferId?: string };
// Mirrors RetailerSortOrder in @findly/retailer-sdk; model-sdk does not depend on that package.
export type AgentSortOrder = "relevance" | "price_low_to_high" | "price_high_to_low" | "rating";
/** One tool call made by the shopping agent. resultSummary is a short human string, never a raw provider payload. */
export type AgentToolCall = { tool: string; input: Record<string, unknown>; resultSummary: string; durationMs: number };
export type ShoppingAgentResult = { shortlist: NormalizedRetailOffer[]; reasoning: string; toolTrace: AgentToolCall[]; exhaustedBudget: boolean };
export type ShoppingAgentTools = {
  searchProducts(input: { retailerId: string; query: string; maxPrice?: number; sortBy?: AgentSortOrder }): Promise<{ offers: NormalizedRetailOffer[]; warnings: string[] }>;
  retailers: Array<{ id: string; name: string; notes: string }>;
};
export type ShoppingAgentBudget = { maxToolCalls: number; maxResultsPerCall: number };
export interface ModelProvider {
  understandShoppingRequest(input: { text?: string; barcode?: string; imageIds: string[]; selectedStoreId?: string; postalCode?: string; currency?: string; country?: string }): Promise<ShoppingRequest>;
  analyzeProductImages(input: { imageIds: string[] }): Promise<{ labels: string[]; confidence: number }>;
  generateSearchPlan(input: { request: ShoppingRequest }): Promise<SearchPlan>;
  compareAmbiguousProducts(input: { request: ShoppingRequest; offers: NormalizedRetailOffer[] }): Promise<{ equivalentOfferIds: string[]; reason: string }>;
  assessCompatibility(input: { request: ShoppingRequest; offer: NormalizedRetailOffer }): Promise<{ compatible: boolean | null; confidence: number; reason: string }>;
  /** agentReasoning is the agent's own shortlist rationale, when the agent path ran. */
  summarizeRecommendation(input: { request: ShoppingRequest; rankedOffers: NormalizedRetailOffer[]; agentReasoning?: string }): Promise<RecommendationSummary>;
  /** Optional agentic search. Providers without it fall back to generateSearchPlan + adapter dispatch. */
  runShoppingAgent?(input: { request: ShoppingRequest; tools: ShoppingAgentTools; budget: ShoppingAgentBudget }): Promise<ShoppingAgentResult>;
}
