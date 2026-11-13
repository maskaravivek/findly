import { describe, expect, it, vi } from "vitest";
import { searchApiEngines } from "../src/config/env.js";
import { buildApp } from "../src/server/app.js";
import { MockModelProvider } from "../src/models/providers.js";
import { AGENT_BUDGET_EXHAUSTED_WARNING, createShoppingGraph, initialState } from "../src/graph/shopping-graph.js";
import { fakeAdapter, fixtureClient, offer, request, testConfig as config } from "./agent-fixtures.js";

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

describe("agent search in the graph", () => {
  it("runs agent_search and records each tool call as a progress event", async () => {
    const state = await run(new LiteralModelProvider());
    expect(state.progressEvents.some(e => e.stage === "searching")).toBe(true);
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

  it("enforces the price cap but keeps differently-worded products", async () => {
    const headphones = { ...request, originalQuery: "wireless noise cancelling headphones under $200", possibleProductNames: ["wireless noise cancelling headphones"], category: "headphones" };
    class HeadphonesProvider extends MockModelProvider { override async understandShoppingRequest() { return headphones; } }
    const model = new HeadphonesProvider();
    const pricey = { ...offer("pricey", "amazon", "Sony WH-1000XM5 Wireless Headphones"), price: { item: { amountMinor: 39_999, currency: "USD" }, total: { amountMinor: 39_999, currency: "USD" } } };
    const earbuds = offer("earbuds", "walmart", "Beats Powerbeats Pro Sport Earbuds");
    Object.assign(model, { runShoppingAgent: async () => ({ shortlist: [pricey, earbuds], reasoning: "earbuds suit running", toolTrace: [], exhaustedBudget: false }) });
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const state = await createShoppingGraph(model, [fakeAdapter("amazon", () => [])]).invoke(
      initialState("req_cap", "req_cap", { text: "wireless noise cancelling headphones", imageIds: [], maxPrice: 200 }), { configurable: { thread_id: "req_cap" } });
    info.mockRestore();
    expect(state.rankedOffers.map(o => o.offerId)).toEqual(["earbuds"]);
    expect(state.warnings).toContain("Excluded 1 offer above the $200 price limit");
    expect(state.warnings.some(w => w.includes("did not match the requested product"))).toBe(false);
  });
});
