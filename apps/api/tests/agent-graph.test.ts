import { describe, expect, it, vi } from "vitest";
import { searchApiFixtures } from "@findly/test-fixtures";
import type { ModelProvider } from "@findly/model-sdk";
import { EnvSchema, searchApiEngines } from "../src/config/env.js";
import { buildApp } from "../src/server/app.js";
import { SearchApiClient } from "../src/retailers/searchapi/client.js";
import { MockModelProvider } from "../src/models/providers.js";
import { AGENT_BUDGET_EXHAUSTED_WARNING, createShoppingGraph, initialState } from "../src/graph/shopping-graph.js";
import { fakeAdapter, offer, request } from "./agent-fixtures.js";

const config = EnvSchema.parse({ NODE_ENV: "test", DEMO_MODE: "false", RETAILER_MODE: "searchapi", MODEL_PROVIDER: "mock", SEARCHAPI_API_KEY: "test" });

function fixtureClient() {
  const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
    const engine = new URL(String(url)).searchParams.get("engine") as keyof typeof searchApiFixtures;
    return new Response(JSON.stringify(searchApiFixtures[engine]), { status: 200 });
  });
  return { fetch, client: new SearchApiClient({ apiKey: "test", timeoutMs: 1_000, cacheTtlMs: 0, fetch }) };
}

class LiteralModelProvider extends MockModelProvider {
  override async understandShoppingRequest() { return request; }
}
const run = (model: MockModelProvider, adapters = [fakeAdapter("home_depot_ca", () => [offer("hd-1", "home_depot_ca")])]) =>
  createShoppingGraph(model, adapters).invoke(initialState("req_1", "req_1", { text: "cordless drill", imageIds: [] }), { configurable: { thread_id: "req_1" } });

describe("agent search over HTTP", () => {
  it("runs the mock agent against SearchAPI fixtures and exposes the tool trace", async () => {
    const { client, fetch } = fixtureClient();
    const app = await buildApp(config, { searchApiClient: client });
    // "for wood" keeps the mock understanding step from asking which material to drill.
    const response = await app.inject({ method: "POST", url: "/v1/search", payload: { text: "cordless drill for wood", imageIds: [] } });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.status).toBe("completed");
    expect(body.offers.length).toBeGreaterThan(0);
    expect(body.offers.every((o: any) => o.source.kind === "search_api")).toBe(true);
    expect(body.agentReasoning).toBe("Mock agent");
    expect(body.toolTrace).toHaveLength(searchApiEngines(config).length);
    expect(body.toolTrace.every((call: any) => call.tool === "search_products" && call.input.query === "cordless drill")).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(searchApiEngines(config).length);
    const events = await app.inject({ method: "GET", url: `/v1/search/${body.requestId}/events` });
    const toolEvents = events.body.split("\n\n").filter(chunk => chunk.startsWith("event: progress") && chunk.includes('"stage":"tool_call"'));
    expect(toolEvents).toHaveLength(searchApiEngines(config).length);
    expect(toolEvents[0]).toContain('"tool":"search_products"');
    expect(toolEvents[0]).not.toContain("offerId");
    await app.close();
  });
});

describe("agent routing in the graph", () => {
  it("dispatches retailer searches when the provider has no runShoppingAgent", async () => {
    const model = new LiteralModelProvider();
    expect((model as ModelProvider).runShoppingAgent).toBeUndefined();
    const state = await run(model);
    expect(state.progressEvents.some(e => e.stage === "searching_retailer")).toBe(true);
    expect(state.progressEvents.some(e => e.stage === "tool_call")).toBe(false);
    expect(state.toolTrace).toEqual([]);
    expect(state.rankedOffers.map(o => o.offerId)).toEqual(["hd-1"]);
  });

  it("runs agent_search instead of dispatch when the provider has runShoppingAgent", async () => {
    const state = await run(new LiteralModelProvider({ agent: true }));
    expect(state.progressEvents.some(e => e.stage === "searching_retailer")).toBe(false);
    expect(state.progressEvents.filter(e => e.stage === "tool_call")).toHaveLength(1);
    expect(state.agentReasoning).toBe("Mock agent");
    expect(state.rankedOffers.map(o => o.offerId)).toEqual(["hd-1"]);
  });

  it("warns on an exhausted budget and survives an agent failure", async () => {
    const exhausted = new LiteralModelProvider();
    Object.assign(exhausted, { runShoppingAgent: async () => ({ shortlist: [offer("a-1")], reasoning: "ran out", toolTrace: [], exhaustedBudget: true }) });
    expect((await run(exhausted)).warnings).toContain(AGENT_BUDGET_EXHAUSTED_WARNING);

    const failing = new LiteralModelProvider();
    Object.assign(failing, { runShoppingAgent: async () => { throw new Error("boom"); } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const state = await run(failing);
    warn.mockRestore();
    expect(state.status).toBe("completed");
    expect(state.rankedOffers).toEqual([]);
    expect(state.warnings.some(w => w.includes("search agent failed"))).toBe(true);
  });
});
