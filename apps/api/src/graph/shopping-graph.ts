import { Command, END, MemorySaver, START, StateGraph, interrupt } from "@langchain/langgraph";
import type { ModelProvider } from "@findly/model-sdk";
import type { RetailerAdapter } from "@findly/retailer-sdk";
import type { SearchRequest } from "@findly/contracts";
import { rankOffers } from "../ranking/rank-offers.js";
import { partitionRelevantOffers } from "../products/product-relevance.js";
import { ShoppingGraphAnnotation, event, type ShoppingGraphState } from "./state.js";
import { publicRetailerError } from "../retailers/retailer-errors.js";
import { buildAgentTools } from "../agent/shopping-agent.js";

const rejectedOfferWarning = (count: number) => `Excluded ${count} retailer ${count === 1 ? "result" : "results"} that did not match the requested product`;

async function searchRetailerWithFallback(adapter: RetailerAdapter, state: ShoppingGraphState) {
  const request = state.understoodRequest!;
  const queries = state.searchPlan?.queries.length ? state.searchPlan.queries.slice(0, 2) : [request.originalQuery ?? "product"];
  let rejectedCount = 0;
  let lastResult: Awaited<ReturnType<RetailerAdapter["searchProducts"]>> | undefined;
  for (const query of queries) {
    const result = await adapter.searchProducts({
      request, query,
      ...(state.input.postalCode ? { postalCode: state.input.postalCode } : {}),
      ...(state.input.country ? { country: state.input.country } : {}),
      ...(state.input.selectedStoreId ? { selectedStoreId: state.input.selectedStoreId } : {}),
      ...(state.input.latitude !== undefined ? { latitude: state.input.latitude } : {}),
      ...(state.input.longitude !== undefined ? { longitude: state.input.longitude } : {}),
      ...(state.input.locationAccuracyMeters !== undefined ? { locationAccuracyMeters: state.input.locationAccuracyMeters } : {}),
      ...(state.input.locationApproximate !== undefined ? { locationApproximate: state.input.locationApproximate } : {}),
    }, { requestId: state.requestId, correlationId: state.threadId });
    lastResult = result;
    const { relevant, rejected } = partitionRelevantOffers(request, result.offers);
    rejectedCount += rejected.length;
    if (relevant.length) {
      return {
        ...result,
        offers: relevant,
        warnings: [...new Set([...result.warnings, ...(rejectedCount ? [rejectedOfferWarning(rejectedCount)] : [])])],
      };
    }
  }
  return {
    ...lastResult!,
    offers: [],
    warnings: [...new Set([...(lastResult?.warnings ?? []), ...(rejectedCount ? [rejectedOfferWarning(rejectedCount)] : [])])],
  };
}

export const AGENT_BUDGET_EXHAUSTED_WARNING = "Search budget was exhausted before the agent finalized; results were ranked by code";

const minorUnits = (currency: string) => { try { return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2; } catch { return 2; } };
const maximumPriceFrom = (maxPrice: number | undefined, currency: string) => maxPrice === undefined ? {} : { maximumPrice: { amountMinor: Math.round(maxPrice * 10 ** minorUnits(currency)), currency } };

async function runAgentSearch(model: ModelProvider, adapters: RetailerAdapter[], state: ShoppingGraphState, budget: { maxToolCalls: number; maxResultsPerCall: number }): Promise<Partial<ShoppingGraphState>> {
  const request = state.understoodRequest!;
  const tools = buildAgentTools(adapters, { request, requestId: state.requestId, correlationId: state.threadId, input: state.input, maxResultsPerCall: budget.maxResultsPerCall });
  const base = { status: "searching", updatedAt: new Date().toISOString() };
  try {
    const result = await model.runShoppingAgent!({ request, tools, budget });
    return {
      ...base, agentShortlist: result.shortlist, agentReasoning: result.reasoning, toolTrace: result.toolTrace, agentExhaustedBudget: result.exhaustedBudget,
      // Never raw offers or prompts: only the tool name, its validated input and a short summary.
      progressEvents: result.toolTrace.map(call => event("tool_call", call.resultSummary, { data: { tool: call.tool, input: call.input, durationMs: call.durationMs } })),
      warnings: result.exhaustedBudget ? [AGENT_BUDGET_EXHAUSTED_WARNING] : [],
    };
  } catch (error) {
    console.warn(JSON.stringify({ event: "agent_search_failed", requestId: state.requestId, error: error instanceof Error ? error.name : "unknown" }));
    return { ...base, agentShortlist: [], agentExhaustedBudget: false, warnings: ["The search agent failed; no retailer results were collected"] };
  }
}

export type ShoppingGraphDefaults = { currency: string; country: string; maxToolCalls?: number; maxResultsPerCall?: number };
export function createShoppingGraph(model: ModelProvider, adapters: RetailerAdapter[], defaults: ShoppingGraphDefaults = { currency: "USD", country: "US" }) {
  const budget = { maxToolCalls: defaults.maxToolCalls ?? 6, maxResultsPerCall: defaults.maxResultsPerCall ?? 8 };
  const graph = new StateGraph(ShoppingGraphAnnotation)
    .addNode("load_request", async () => ({ status: "understanding", updatedAt: new Date().toISOString(), progressEvents: [event("understanding", "Understanding what you need")] }))
    .addNode("understand_request", async (state) => { const understood = await model.understandShoppingRequest({ imageIds: state.input.imageIds, ...(state.input.text ? { text: state.input.text } : {}), ...(state.input.barcode ? { barcode: state.input.barcode } : {}), ...(state.input.selectedStoreId ? { selectedStoreId: state.input.selectedStoreId } : {}), ...(state.input.postalCode ? { postalCode: state.input.postalCode } : {}), currency: state.input.currency?.toUpperCase() ?? defaults.currency, country: state.input.country?.toUpperCase() ?? defaults.country }); return { understoodRequest: understood.maximumPrice ? understood : { ...understood, ...maximumPriceFrom(state.input.maxPrice, understood.currency) }, updatedAt: new Date().toISOString() }; })
    .addNode("prepare_clarification", async (state) => { const request = state.understoodRequest!; const clarification = { type: "clarification" as const, requestId: state.requestId, question: request.clarificationQuestion, options: request.clarificationOptions, reason: "The answer changes product compatibility and ranking." }; return { status: "awaiting_clarification", progressEvents: [{ type: "clarification" as const, stage: "awaiting_clarification", message: clarification.question, timestamp: new Date().toISOString(), data: clarification }], updatedAt: new Date().toISOString() }; })
    .addNode("request_clarification", async (state) => { const request = state.understoodRequest!; const answer = String(interrupt({ type: "clarification", requestId: state.requestId, question: request.clarificationQuestion, options: request.clarificationOptions, reason: "The answer changes product compatibility and ranking." })); return { clarificationAnswer: answer, understoodRequest: { ...request, clarificationNeeded: false, requiredFeatures: [...request.requiredFeatures, `Suitable for ${answer.toLowerCase()}`], confidence: Math.min(1, request.confidence + 0.08) }, status: "planning", progressEvents: [event("clarification_applied", "Using your clarification")] }; })
    .addNode("build_search_plan", async (state) => ({ status: "planning", searchPlan: await model.generateSearchPlan({ request: state.understoodRequest! }), progressEvents: [event("planning", "Building a retailer search plan")], updatedAt: new Date().toISOString() }))
    .addNode("dispatch_retailer_searches", async (state) => { const selectedAdapters = adapters.filter(a => state.searchPlan!.retailerIds.includes(a.retailer.id)); const settled = await Promise.allSettled(selectedAdapters.map(adapter => searchRetailerWithFallback(adapter, state))); const results = settled.flatMap(x => x.status === "fulfilled" ? [x.value] : []); const errors = settled.flatMap((x, i) => x.status === "rejected" ? [publicRetailerError(selectedAdapters[i]?.retailer.id ?? "unknown", x.reason)] : []); return { status: "searching", retailerResults: results, retailerErrors: errors, progressEvents: results.map(r => event("searching_retailer", `Checked ${r.retailerId}`, { retailer: r.retailerId, offersFound: r.offers.length })), warnings: [...results.flatMap(r => r.warnings), ...errors.map(e => `${e.retailerId}: ${e.message}`)], updatedAt: new Date().toISOString() }; })
    .addNode("agent_search", async (state) => runAgentSearch(model, adapters, state, budget))
    .addNode("normalize_offers", async (state) => ({ status: "matching", normalizedOffers: state.agentShortlist.length ? state.agentShortlist : state.retailerResults.flatMap(r => r.offers), progressEvents: [event("matching", "Matching exact products, bundles and variants")], updatedAt: new Date().toISOString() }))
    .addNode("match_products", async (state) => { const { relevant, rejected } = partitionRelevantOffers(state.understoodRequest!, state.normalizedOffers); return { matchedOffers: relevant, warnings: rejected.length ? [rejectedOfferWarning(rejected.length)] : [], progressEvents: [event("matching", `Matched ${relevant.length} relevant offers`)], updatedAt: new Date().toISOString() }; })
    .addNode("rank_offers", async (state) => { const ranked = rankOffers(state.understoodRequest!, state.matchedOffers).map(r => r.offer); return { status: "ranking", rankedOffers: ranked, progressEvents: [event("ranking", `Ranked ${ranked.length} offers`)], updatedAt: new Date().toISOString() }; })
    .addNode("generate_result_summary", async (state) => ({ recommendation: await model.summarizeRecommendation({ request: state.understoodRequest!, rankedOffers: state.rankedOffers, ...(state.agentReasoning ? { agentReasoning: state.agentReasoning } : {}) }), status: state.retailerErrors.length ? "partially_completed" : "completed", progressEvents: [event("completed", "Recommendations ready", { type: "complete", offersFound: state.rankedOffers.length })], completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }))
    .addEdge(START, "load_request").addEdge("load_request", "understand_request")
    .addConditionalEdges("understand_request", (state) => state.understoodRequest?.clarificationNeeded && !state.clarificationAnswer ? "clarify" : "plan", { clarify: "prepare_clarification", plan: "build_search_plan" })
    .addEdge("prepare_clarification", "request_clarification")
    .addEdge("request_clarification", "build_search_plan")
    .addConditionalEdges("build_search_plan", () => typeof model.runShoppingAgent === "function" ? "agent" : "dispatch", { agent: "agent_search", dispatch: "dispatch_retailer_searches" })
    .addEdge("agent_search", "normalize_offers").addEdge("dispatch_retailer_searches", "normalize_offers").addEdge("normalize_offers", "match_products").addEdge("match_products", "rank_offers").addEdge("rank_offers", "generate_result_summary").addEdge("generate_result_summary", END);
  return graph.compile({ checkpointer: new MemorySaver() });
}
export type ShoppingGraph = ReturnType<typeof createShoppingGraph>;
export const initialState = (requestId: string, threadId: string, input: SearchRequest): Partial<ShoppingGraphState> => ({ requestId, threadId, input, status: "draft", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
export const resumeCommand = (answer: string) => new Command({ resume: answer });
