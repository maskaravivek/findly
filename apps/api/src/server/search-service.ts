import { randomUUID } from "node:crypto";
import type { SearchRequest, SearchResponse } from "@findly/contracts";
import type { ShoppingGraph } from "../graph/shopping-graph.js";
import { initialState, resumeCommand } from "../graph/shopping-graph.js";
export class SearchService {
  constructor(private readonly graph: ShoppingGraph) {}
  async start(input: SearchRequest, userId?: string): Promise<SearchResponse> { const requestId = `req_${randomUUID()}`; const threadId = requestId; const result = await this.graph.invoke(initialState(requestId, threadId, input, userId), { configurable: { thread_id: threadId } }); return this.toResponse(result); }
  async resume(requestId: string, answer: string, userId?: string): Promise<SearchResponse> { await this.assertOwner(requestId, userId); const result = await this.graph.invoke(resumeCommand(answer) as never, { configurable: { thread_id: requestId } }); if (!result.requestId) throw new SearchRequestNotFoundError(); return this.toResponse(result); }
  async events(requestId: string, userId?: string) { const state = await this.assertOwner(requestId, userId); return state.progressEvents ?? []; }
  private async assertOwner(requestId: string, userId?: string) { const snapshot = await this.graph.getState({ configurable: { thread_id: requestId } }); const state = snapshot.values as Partial<Awaited<ReturnType<ShoppingGraph["invoke"]>>>; if (!state.requestId) throw new SearchRequestNotFoundError(); if (state.userId !== userId) throw new SearchRequestForbiddenError(); return state; }
  private toResponse(state: Awaited<ReturnType<ShoppingGraph["invoke"]>>): SearchResponse { const interrupts = (state as unknown as { __interrupt__?: Array<{ value?: unknown }> }).__interrupt__; const clarification = interrupts?.[0]?.value as SearchResponse["clarification"] | undefined; return { requestId: state.requestId, threadId: state.threadId, status: clarification ? "awaiting_clarification" : state.status, ...(state.understoodRequest ? { understoodRequest: state.understoodRequest } : {}), ...(clarification ? { clarification } : {}), offers: state.rankedOffers ?? [], ...(state.recommendation ? { recommendation: state.recommendation } : {}), warnings: [...new Set(state.warnings ?? [])] }; }
}
export class SearchRequestNotFoundError extends Error {}
export class SearchRequestForbiddenError extends Error {}
