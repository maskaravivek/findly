import { describe, expect, it } from "vitest";
import { rateLimitKey } from "../src/rate-limit.js";

describe("Cloudflare deployment contract", () => {
  it("uses stable, non-secret rate-limit keys for authenticated devices", async () => {
    const first = await rateLimitKey(new Request("https://findly.example/v1/search", { headers: { authorization: "Bearer device-token" } }));
    const second = await rateLimitKey(new Request("https://findly.example/v1/search/other", { headers: { authorization: "Bearer device-token" } }));
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("device-token");
  });

  it("falls back to a hashed connection address before authentication", async () => {
    const first = await rateLimitKey(new Request("https://findly.example/health", { headers: { "cf-connecting-ip": "192.0.2.1" } }));
    const second = await rateLimitKey(new Request("https://findly.example/health", { headers: { "cf-connecting-ip": "192.0.2.2" } }));
    expect(first).not.toBe(second);
  });
});
