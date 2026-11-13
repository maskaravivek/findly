import { Command, END, MemorySaver, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { ModelProvider } from "../models/types.js";
import type { RetailerAdapter } from "../retailers/types.js";
import type { SearchRequest } from "../contracts.js";
import { rankOffers } from "../ranking/rank-offers.js";
import { verifyAgentShortlist } from "../products/verify-shortlist.js";
import { ShoppingGraphAnnotation, event, type ShoppingGraphState } from "./state.js";
import { buildAgentTools } from "../agent/shopping-agent.js";

export const AGENT_BUDGET_EXHAUSTED_WARNING = "Search budget was exhausted before the agent finalized; results were ranked by code";

const minorUnits = (currency: string) => { try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; } };
const maximumPriceFrom = (maxPrice: number | undefined, currency: string) => maxPrice === undefined ? {} : { maximumPrice: { amountMinor: Math.round(maxPrice * 10 ** minorUnits(currency)), currency } };

async function runAgentSearch(model: ModelProvider, adapters: RetailerAdapter[], state: ShoppingGraphState, budget: { maxToolCalls: number; maxResultsPerCall: number }): Promise<Partial<ShoppingGraphState>> {
  const request = state.understoodRequest!;
  const tools = buildAgentTools(adapters, { request, requestId: state.requestId, correlationId: state.threadId, input: state.input, maxResultsPerCall: budget.maxResultsPerCall });
  const base = { status: "searching", updatedAt: new Date().toISOString() };
  const searching = event("searching", "Searching retailers");
  try {
    const result = await model.runShoppingAgent({ request, tools, budget });
    return {
      ...base, agentShortlist: result.shortlist, agentReasoning: result.reasoning, toolTrace: result.toolTrace, agentExhaustedBudget: result.exhaustedBudget,
      // Never raw offers or prompts: only the tool name, its validated input and a short summary.
      progressEvents: [searching, ...result.toolTrace.map(call => event("tool_call", call.resultSummary, { data: { tool: call.tool, input: call.input, durationMs: call.durationMs } }))],
      warnings: result.exhaustedBudget ? [AGENT_BUDGET_EXHAUSTED_WARNING] : [],
    };
  } catch (error) {
    console.warn(JSON.stringify({ event: "agent_search_failed", requestId: state.requestId, error: error instanceof Error ? error.name : "unknown" }));
    return { ...base, agentShortlist: [], agentExhaustedBudget: false, progressEvents: [searching], warnings: ["The search agent failed; no retailer results were collected"] };
  }
}

export type ShoppingGraphDefaults = { currency: string; country: string; maxToolCalls?: number; maxResultsPerCall?: number };
/** load_request -> understand_request -> [clarification interrupt] -> agent_search -> match_products -> rank_offers -> generate_result_summary */
export function createShoppingGraph(model: ModelProvider, adapters: RetailerAdapter[], defaults: ShoppingGraphDefaults = { currency: "USD", country: "US" }) {
  const budget = { maxToolCalls: defaults.maxToolCalls ?? 12, maxResultsPerCall: defaults.maxResultsPerCall ?? 10 };
  const graph = new StateGraph(ShoppingGraphAnnotation)
    .addNode("load_request", async () => ({ status: "understanding", updatedAt: new Date().toISOString(), progressEvents: [event("understanding", "Understanding what you need")] }))
    .addNode("understand_request", async (state) => { const understood = await model.understandShoppingRequest({ imageIds: state.input.imageIds, ...(state.input.text ? { text: state.input.text } : {}), ...(state.input.barcode ? { barcode: state.input.barcode } : {}), ...(state.input.selectedStoreId ? { selectedStoreId: state.input.selectedStoreId } : {}), ...(state.input.postalCode ? { postalCode: state.input.postalCode } : {}), currency: state.input.currency?.toUpperCase() ?? defaults.currency, country: state.input.country?.toUpperCase() ?? defaults.country }); return { understoodRequest: understood.maximumPrice ? understood : { ...understood, ...maximumPriceFrom(state.input.maxPrice, understood.currency) }, updatedAt: new Date().toISOString() }; })
    .addNode("prepare_clarification", async (state) => { const request = state.understoodRequest!; const clarification = { type: "clarification" as const, requestId: state.requestId, question: request.clarificationQuestion, options: request.clarificationOptions, reason: "The answer changes product compatibility and ranking." }; return { status: "awaiting_clarification", progressEvents: [{ type: "clarification" as const, stage: "awaiting_clarification", message: clarification.question, timestamp: new Date().toISOString(), data: clarification }], updatedAt: new Date().toISOString() }; })
    .addNode("request_clarification", async (state) => { const request = state.understoodRequest!; const answer = String(interrupt({ type: "clarification", requestId: state.requestId, question: request.clarificationQuestion, options: request.clarificationOptions, reason: "The answer changes product compatibility and ranking." })); return { clarificationAnswer: answer, understoodRequest: { ...request, clarificationNeeded: false, requiredFeatures: [...request.requiredFeatures, `Suitable for ${answer.toLowerCase()}`], confidence: Math.min(1, request.confidence + 0.08) }, status: "searching", progressEvents: [event("clarification_applied", "Using your clarification")] }; })
    .addNode("agent_search", async (state) => runAgentSearch(model, adapters, state, budget))
    .addNode("match_products", async (state) => {
      // The model picked from real results, so only check hard constraints (price cap, exclusions), not product type.
      const verified = verifyAgentShortlist(state.understoodRequest!, state.agentShortlist);
      console.info(JSON.stringify({ event: "agent_shortlist_verified", requestId: state.requestId, kept: verified.kept.length, dropped: verified.dropped.map(d => ({ offerId: d.offer.offerId, rule: d.rule })), coverage: verified.coverage }));
      return { status: "matching", matchedOffers: verified.kept, warnings: verified.warnings, progressEvents: [event("matching", `Verified ${verified.kept.length} shortlisted offers`)], updatedAt: new Date().toISOString() };
    })
    .addNode("rank_offers", async (state) => { const ranked = rankOffers(state.understoodRequest!, state.matchedOffers, { enforceRelevance: false }).map(r => r.offer); return { status: "ranking", rankedOffers: ranked, progressEvents: [event("ranking", `Ranked ${ranked.length} offers`)], updatedAt: new Date().toISOString() }; })
    .addNode("generate_result_summary", async (state) => ({ recommendation: await model.summarizeRecommendation({ request: state.understoodRequest!, rankedOffers: state.rankedOffers, ...(state.agentReasoning ? { agentReasoning: state.agentReasoning } : {}) }), status: "completed", progressEvents: [event("completed", "Recommendations ready", { type: "complete", offersFound: state.rankedOffers.length })], completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    .addEdge(START, "load_request").addEdge("load_request", "understand_request")
    .addConditionalEdges("understand_request", (state) => state.understoodRequest?.clarificationNeeded && !state.clarificationAnswer ? "clarify" : "search", { clarify: "prepare_clarification", search: "agent_search" })
    .addEdge("prepare_clarification", "request_clarification")
    .addEdge("request_clarification", "agent_search")
    .addEdge("agent_search", "match_products").addEdge("match_products", "rank_offers").addEdge("rank_offers", "generate_result_summary").addEdge("generate_result_summary", END);
  return graph.compile({ checkpointer: new MemorySaver() });
}
export type ShoppingGraph = ReturnType<typeof createShoppingGraph>;
export const initialState = (requestId: string, threadId: string, input: SearchRequest): Partial<ShoppingGraphState> => ({ requestId, threadId, input, status: "draft", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
export const resumeCommand = (answer: string) => new Command({ resume: answer });
