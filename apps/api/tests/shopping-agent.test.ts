import { describe, expect, it } from "vitest";
import { SeenOffers, agentToolDefinitions, buildAgentTools, buildSystemPrompt, compactView, fallbackShortlist, validateShortlist } from "../src/agent/shopping-agent.js";
import { EnvSchema } from "../src/config/env.js";
import { createSearchApiAdapters } from "../src/retailers/searchapi/adapter.js";
import { fakeAdapter, offer, request } from "./agent-fixtures.js";

const ctx = { request, requestId: "r1", correlationId: "c1", input: { postalCode: "10001", country: "US" }, maxResultsPerCall: 2 };

describe("buildAgentTools", () => {
  it("routes to the adapter with budget and location fields, capping results", async () => {
    const amazon = fakeAdapter("amazon", () => [offer("a1"), offer("a2"), offer("a3")]);
    const tools = buildAgentTools([amazon], ctx);
    const result = await tools.searchProducts({ retailerId: "amazon", query: "drill", maxPrice: 150, sortBy: "price_low_to_high" });
    expect(result.offers.map(o => o.offerId)).toEqual(["a1", "a2"]);
    expect(amazon.calls[0]).toMatchObject({ query: "drill", maxResults: 2, maxPrice: 150, sortBy: "price_low_to_high", postalCode: "10001", country: "US" });
    expect(tools.retailers).toEqual([{ id: "amazon", name: "Amazon", notes: "amazon.com; pickup" }]);
  });

  it("uses the adapter description for retailer notes when it has one", () => {
    const amazon = fakeAdapter("amazon", () => []);
    const described = { ...amazon, retailer: { ...amazon.retailer, description: "Amazon marketplace; broad catalog" } };
    expect(buildAgentTools([described], ctx).retailers[0]!.notes).toBe("Amazon marketplace; broad catalog");
  });

  it("returns a warning for an unknown retailer instead of throwing", async () => {
    const tools = buildAgentTools([fakeAdapter("amazon", () => [])], ctx);
    await expect(tools.searchProducts({ retailerId: "nope", query: "drill" })).resolves.toEqual({ offers: [], warnings: ["Unknown retailer"] });
  });

  it("turns adapter errors into public warnings without leaking diagnostics", async () => {
    const tools = buildAgentTools([fakeAdapter("amazon", () => { throw new Error("SearchAPI 500: secret key=abc"); })], ctx);
    const result = await tools.searchProducts({ retailerId: "amazon", query: "drill" });
    expect(result).toEqual({ offers: [], warnings: ["Amazon live results are temporarily unavailable"] });
  });
});

describe("grounding", () => {
  it("validateShortlist keeps seen ids in model order and counts the rest", () => {
    const seen = new SeenOffers();
    seen.add([offer("a1"), offer("w1", "walmart")]);
    const { offers, dropped } = validateShortlist(["w1", "made-up", "a1", "also-fake"], seen);
    expect(offers.map(o => o.offerId)).toEqual(["w1", "a1"]);
    expect(dropped).toBe(2);
  });

  it("compactView truncates titles to 120 chars and formats prices", () => {
    const [view] = compactView([offer("a1", "amazon", "x".repeat(300))]);
    expect(view!.title).toHaveLength(120);
    expect(view).toMatchObject({ offerId: "a1", retailer: "amazon", price: "$99.00", rating: 4.7, reviews: 1200, fulfillment: "in stock; shipping, pickup at Chelsea" });
    expect(view).not.toHaveProperty("source");
  });
});

describe("prompt and tool schemas", () => {
  const retailers = [{ id: "amazon", name: "Amazon", notes: "amazon.com" }, { id: "walmart", name: "Walmart", notes: "walmart.com" }];
  const fullSet = createSearchApiAdapters(EnvSchema.parse({ SEARCHAPI_API_KEY: "k" })).map(a => ({ id: a.retailer.id, name: a.retailer.name, notes: a.retailer.description! }));
  it("system prompt lists every retailer, the budget, and the untrusted-data rule", () => {
    const prompt = buildSystemPrompt(request, retailers, { maxToolCalls: 12, maxResultsPerCall: 10 });
    expect(prompt).toContain("- amazon (Amazon): amazon.com");
    expect(prompt).toContain("- walmart (Walmart): walmart.com");
    expect(prompt).toContain("at most 12 search_products calls");
    expect(prompt).toContain("up to 10 offers");
    expect(prompt).toMatch(/untrusted data/);
    expect(prompt).toMatch(/Never invent an offerId/);
    expect(prompt).not.toContain("google_shopping first"); // no baseline step when Google Shopping is not configured
    expect(prompt).not.toContain("cordless drill"); // the request goes in the user turn, not the system prompt
  });
  it("system prompt describes each configured retailer and starts with a google_shopping baseline", () => {
    const prompt = buildSystemPrompt(request, fullSet, { maxToolCalls: 12, maxResultsPerCall: 10 });
    for (const r of fullSet) expect(prompt).toContain(`- ${r.id} (${r.name}): ${r.notes}`);
    expect(prompt).toContain("1. Search google_shopping first, once");
    expect(prompt).toContain("(at least 3)");
    expect(prompt).toMatch(/prefer a first-party retailer listing/);
    expect(prompt).toContain("4 to 8 offerIds");
    expect(prompt.indexOf("Budget:")).toBeGreaterThan(prompt.indexOf("- google_shopping"));
    expect(prompt.split("\n").length).toBeLessThanOrEqual(40);
  });
  it("search_products restricts retailerId to the known retailers", () => {
    const search = agentToolDefinitions(retailers).find(t => t.name === "search_products")!;
    expect((search.input_schema.properties.retailerId as { enum: string[] }).enum).toEqual(["amazon", "walmart"]);
  });
});

describe("fallbackShortlist", () => {
  it("respects the price cap when code picks the shortlist", () => {
    const seen = new SeenOffers();
    const cheap = offer("cheap");
    seen.add([{ ...offer("dear"), price: { item: { amountMinor: 50_000, currency: "USD" }, total: { amountMinor: 50_000, currency: "USD" } } }, cheap]);
    const capped = { ...request, maximumPrice: { amountMinor: 20_000, currency: "USD" } };
    expect(fallbackShortlist(capped, seen).map(o => o.offerId)).toEqual(["cheap"]);
  });
});
