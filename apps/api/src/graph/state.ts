import { Annotation } from "@langchain/langgraph";
import type { NormalizedRetailOffer, ProgressEvent, SearchRequest, ShoppingRequest } from "@findly/contracts";
import type { SearchPlan, RecommendationSummary } from "@findly/model-sdk";
import type { RetailerSearchResult } from "@findly/retailer-sdk";
export const ShoppingGraphAnnotation = Annotation.Root({
  requestId: Annotation<string>(), threadId: Annotation<string>(), userId: Annotation<string | undefined>(), status: Annotation<string>(), input: Annotation<SearchRequest>(),
  understoodRequest: Annotation<ShoppingRequest | undefined>(), clarificationAnswer: Annotation<string | undefined>(), searchPlan: Annotation<SearchPlan | undefined>(),
  retailerResults: Annotation<RetailerSearchResult[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }), retailerErrors: Annotation<Array<{ retailerId: string; message: string }>>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  normalizedOffers: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), matchedOffers: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), rankedOffers: Annotation<NormalizedRetailOffer[]>({ reducer: (_a, b) => b, default: () => [] }), recommendation: Annotation<RecommendationSummary | undefined>(),
  progressEvents: Annotation<ProgressEvent[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }), warnings: Annotation<string[]>({ reducer: (a, b) => [...a, ...b], default: () => [] }),
  startedAt: Annotation<string>(), updatedAt: Annotation<string>(), completedAt: Annotation<string | undefined>()
});
export type ShoppingGraphState = typeof ShoppingGraphAnnotation.State;
export const event = (stage: string, message: string, extra: Partial<ProgressEvent> = {}): ProgressEvent => ({ type: "progress", stage, message, timestamp: new Date().toISOString(), ...extra });
