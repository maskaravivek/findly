import { describe, expect, it } from "vitest";
import { buildApp } from "../src/server/app.js";
import { EnvSchema } from "../src/config/env.js";
import { fixtureClient, testConfig as config } from "./agent-fixtures.js";

describe("Findly API", () => {
  it("reports health and in-memory readiness without a database", async () => {
    const app = await buildApp(config, { searchApiClient: fixtureClient().client });
    const health = await app.inject({ method: "GET", url: "/health" });
    expect(health.statusCode).toBe(200);
    expect(health.json()).toEqual({ status: "ok", brand: "Findly" });
    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual({ status: "ready", state: "memory" });
    await app.close();
  });

  it("refuses to start without a SearchAPI key or, for anthropic, an Anthropic key", async () => {
    await expect(buildApp(config)).rejects.toThrow("SEARCHAPI_API_KEY is required");
    const anthropic = EnvSchema.parse({ NODE_ENV: "test", MODEL_PROVIDER: "anthropic", SEARCHAPI_API_KEY: "test" });
    await expect(buildApp(anthropic)).rejects.toThrow("ANTHROPIC_API_KEY is required");
  });

  it("interrupts and resumes the same thread after clarification", async () => {
    const app = await buildApp(config, { searchApiClient: fixtureClient().client });
    const response = await app.inject({ method: "POST", url: "/v1/search", payload: { text: "I need a drill for hanging shelves", imageIds: [] } });
    const interrupted = response.json();
    expect(interrupted.status).toBe("awaiting_clarification");
    expect(interrupted.clarification.question).toContain("material");
    const events = await app.inject({ method: "GET", url: `/v1/search/${interrupted.requestId}/events` });
    expect(events.body).toContain("event: clarification");
    const resumed = await app.inject({ method: "POST", url: `/v1/search/${interrupted.requestId}/clarification`, payload: { answer: "Concrete" } });
    const body = resumed.json();
    expect(body.status).toBe("completed");
    expect(body.threadId).toBe(interrupted.threadId);
    expect(body.offers.length).toBeGreaterThan(0);
    expect(body.offers.every((o: any) => o.source.kind === "search_api")).toBe(true);
    expect(body.toolTrace.length).toBeGreaterThan(0);
    await app.close();
  });
});
