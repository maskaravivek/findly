import Anthropic from "@anthropic-ai/sdk";
import { expect, it } from "vitest";
import { runShoppingAgent } from "./agent.js";
import type { Engine, Offer } from "./searchapi.js";

type ToolUse = { name: string; input: Record<string, unknown> };

// A real SDK client whose fetch replays scripted assistant turns: the whole tool loop runs, with no network.
function scriptedClient(turns: ToolUse[][]) {
  let turn = 0;
  const fetch = async () => {
    const calls = turns[turn++] ?? [];
    const body = {
      id: `msg_${turn}`, type: "message", role: "assistant", model: "claude-sonnet-5-5",
      content: calls.length ? calls.map((c, i) => ({ type: "tool_use", id: `tu_${turn}_${i}`, ...c })) : [{ type: "text", text: "done" }],
      stop_reason: calls.length ? "tool_use" : "end_turn", stop_sequence: null, stop_details: null,
      usage: { input_tokens: 10, output_tokens: 10 },
    };
    return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
  };
  return new Anthropic({ apiKey: "test-key", fetch, maxRetries: 0 });
}

const offer = (retailer: string, id: string, price: number): Offer =>
  ({ id: `${retailer}:${id}`, retailer, title: `Cordless drill ${id}`, price, currency: "USD", url: `https://example.com/${id}` });

it("drops shortlist ids the agent never saw", async () => {
  const search = async (engine: Engine) => engine === "amazon_search" ? [offer("amazon", "a1", 129)] : [offer("walmart", "w1", 99)];
  const client = scriptedClient([
    [
      { name: "search_products", input: { retailer: "amazon_search", query: "cordless drill" } },
      { name: "search_products", input: { retailer: "walmart_search", query: "cordless drill" } },
    ],
    [{ name: "finalize_shortlist", input: { ids: ["walmart:w1", "amazon:hallucinated-123"], reasoning: "Cheapest with good reviews." } }],
  ]);

  const result = await runShoppingAgent("cordless drill", {}, { search, client });

  expect(result.shortlist.map(o => o.id)).toEqual(["walmart:w1"]);
  expect(result.trace).toHaveLength(3);
  expect(result.trace.at(-1)?.summary).toBe("1 kept, 1 unseen ids dropped");
  expect(result.reasoning).toBe("Cheapest with good reviews.");
});
