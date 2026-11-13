import { Annotation } from "@langchain/langgraph";
import type { NormalizedRetailOffer, ProgressEvent, SearchRequest, ShoppingRequest } from "@findly/contracts";
import type { AgentToolCall, RecommendationSummary } from "@findly/model-sdk";
export const ShoppingGraphAnnotation = Annotation.Root({
  requestId: Annotation<string>(), threadId: Annotation<string>(), status: Annotation<string>(), input: Annotation<SearchRequest>(),
  understoodRequest: Annotation<ShoppingRequest | undefined>(), clarificationAnswer: Annotation<string | undefined>(),
  agentShortlist: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), agentReasoning: Annotation<string | undefined>(),
  toolTrace: Annotation<AgentToolCall[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }), agentExhaustedBudget: Annotation<boolean | undefined>(),
  matchedOffers: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), rankedOffers: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), recommendation: Annotation<RecommendationSummary | undefined>(),
  progressEvents: Annotation<ProgressEvent[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }), warnings: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  startedAt: Annotation<string>(), updatedAt: Annotation<string>(), completedAt: Annotation<string | undefined>()
});
export type ShoppingGraphState = typeof ShoppingGraphAnnotation.State;
export const event = (stage: string, message: string, extra: Partial<ProgressEvent> = {}): ProgressEvent => ({ type: "progress", stage, message, timestamp: new Date().toISOString(), ...extra });
