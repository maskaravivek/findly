import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it } from "vitest";
import { AnthropicModelProvider } from "../src/models/providers.js";
import { buildAgentTools } from "../src/agent/shopping-agent.js";
import { fakeAdapter, offer, request } from "./agent-fixtures.js";

type ToolUse = { name: string; input: Record<string, unknown> };
/** A real SDK client whose fetch replays scripted assistant turns. No network. */
function scriptedClient(turns: ToolUse[][]) {
  const requests: Array<{ messages: Array<{ role: string; content: unknown }> }> = [];
  let turn = 0;
  const fetch = async (_url: unknown, init?: { body?: unknown }) => {
    requests.push(JSON.parse(String(init?.body)));
    const calls = turns[turn++] ?? [];
    const body = {
      id: `msg_${turn}`, type: "message", role: "assistant", model: "claude-sonnet-5-5",
      content: calls.length ? calls.map((c, i) => ({ type: "tool_use", id: `tu_${turn}_${i}`, name: c.name, input: c.input })) : [{ type: "text", text: "done" }],
      stop_reason: calls.length ? "tool_use" : "end_turn", stop_sequence: null, stop_details: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { client: new Anthropic({ apiKey: "test-key", fetch, maxRetries: 0 }), requests, turnsUsed: () => turn };
}

function setup(turns: ToolUse[][], maxToolCalls = 4) {
  const adapters = [fakeAdapter("amazon", () => [offer("a1"), offer("a2")]), fakeAdapter("walmart", () => [offer("w1", "walmart")])];
  const tools = buildAgentTools(adapters, { request, requestId: "r", correlationId: "c", input: {}, maxResultsPerCall: 8 });
  const scripted = scriptedClient(turns);
  const provider = new AnthropicModelProvider("test-key", "claude-sonnet-5-5", { client: scripted.client });
  return { run: () => provider.runShoppingAgent({ request, tools, budget: { maxToolCalls, maxResultsPerCall: 8 } }), ...scripted };
}

describe("AnthropicModelProvider.runShoppingAgent", () => {
  it("grounds the shortlist: hallucinated ids never reach the result", async () => {
    const { run, requests, turnsUsed } = setup([
      [{ name: "search_products", input: { retailerId: "amazon", query: "cordless drill" } }, { name: "search_products", input: { retailerId: "walmart", query: "cordless drill" } }],
      [{ name: "finalize_shortlist", input: { offerIds: ["w1", "hallucinated-123"], reasoning: "Cheapest in stock." } }],
    ]);
    const result = await run();
    expect(result.shortlist.map(o => o.offerId)).toEqual(["w1"]);
    expect(result.toolTrace).toHaveLength(3);
    expect(result.toolTrace.map(t => t.resultSummary)).toEqual(["amazon: 2 offers", "walmart: 1 offer", "1 offers shortlisted, 1 unseen ids dropped"]);
    expect(result.exhaustedBudget).toBe(false);
    expect(result.reasoning).toBe("Cheapest in stock.");
    expect(turnsUsed()).toBe(2); // stops right after finalize, no extra turn

    // The model only ever sees compact views, never the raw offer objects.
    const toolResults = JSON.stringify(requests[1]!.messages.at(-1));
    expect(toolResults).toContain("offerId");
    expect(toolResults).not.toContain("observedAt");
  });

  it("keeps the budget exact when one turn issues parallel searches", async () => {
    const { run } = setup([
      [{ name: "search_products", input: { retailerId: "amazon", query: "drill" } }, { name: "search_products", input: { retailerId: "walmart", query: "drill" } }],
      [{ name: "finalize_shortlist", input: { offerIds: ["a1"], reasoning: "ok" } }],
    ], 1);
    const result = await run();
    const searches = result.toolTrace.filter(t => t.tool === "search_products").map(t => t.resultSummary);
    expect(searches.filter(s => s === "rejected: budget spent")).toHaveLength(1);
    expect(searches.filter(s => s !== "rejected: budget spent")).toHaveLength(1);
  });

  it("enforces the budget and falls back to code-ranked offers when the model never finalizes", async () => {
    const search = { name: "search_products", input: { retailerId: "amazon", query: "drill" } };
    const { run, requests, turnsUsed } = setup([[search], [search], [search], [search], [search], [search]], 1);
    const result = await run();
    expect(result.exhaustedBudget).toBe(true);
    expect(result.shortlist.map(o => o.offerId).sort()).toEqual(["a1", "a2"]);
    expect(turnsUsed()).toBe(3); // the budget-spending turn + 2 grace turns
    expect(result.toolTrace.map(t => t.resultSummary)).toEqual(["amazon: 2 offers", "rejected: budget spent", "rejected: budget spent"]);
    expect(JSON.stringify(requests[1]!.messages.at(-1))).toContain("Search budget is spent");
  });
});
