import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
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
  /** agentReasoning is the agent's own shortlist rationale. */
  summarizeRecommendation(input: { request: ShoppingRequest; rankedOffers: NormalizedRetailOffer[]; agentReasoning?: string }): Promise<RecommendationSummary>;
  /** The tool-calling search agent: picks retailers and queries, returns a shortlist of offers it actually saw. */
  runShoppingAgent(input: { request: ShoppingRequest; tools: ShoppingAgentTools; budget: ShoppingAgentBudget }): Promise<ShoppingAgentResult>;
}
