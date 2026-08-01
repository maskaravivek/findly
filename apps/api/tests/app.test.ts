import { describe, expect, it } from "vitest";
import { buildApp } from "../src/server/app.js";
import { EnvSchema } from "../src/config/env.js";
const config = EnvSchema.parse({ NODE_ENV: "test", DEMO_MODE: "true", MODEL_PROVIDER: "mock" });
describe("Findly API demo", () => {
  it("returns provenance-marked offers without live credentials", async () => { const app = await buildApp(config); const response = await app.inject({ method: "POST", url: "/v1/search", payload: { text: "Find this DeWalt drill cheaper nearby", postalCode: "L1G 0A1", imageIds: [] } }); expect(response.statusCode).toBe(200); const body = response.json(); expect(body.status).toBe("completed"); expect(body.offers.length).toBeGreaterThan(1); expect(body.offers.every((offer: any) => offer.source.liveVerified === false)).toBe(true); await app.close(); });
  it("interrupts and resumes the same thread after clarification", async () => { const app = await buildApp(config); const response = await app.inject({ method: "POST", url: "/v1/search", payload: { text: "I need a drill for hanging shelves", imageIds: [] } }); const interrupted = response.json(); expect(interrupted.status).toBe("awaiting_clarification"); expect(interrupted.clarification.question).toContain("material"); const resumed = await app.inject({ method: "POST", url: `/v1/search/${interrupted.requestId}/clarification`, payload: { answer: "Concrete" } }); expect(resumed.json().status).toBe("completed"); expect(resumed.json().threadId).toBe(interrupted.threadId); await app.close(); });
});
