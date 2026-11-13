import { describe, expect, it } from "vitest";
import { rateLimitKey } from "../src/rate-limit.js";

describe("Cloudflare deployment contract", () => {
  it("uses stable, hashed connection-address rate-limit keys", async () => {
    const first = await rateLimitKey(new Request("https://findly.example/v1/search", { headers: { "cf-connecting-ip": "192.0.2.1" } }));
    const second = await rateLimitKey(new Request("https://findly.example/v1/search/other", { headers: { "cf-connecting-ip": "192.0.2.1" } }));
    expect(first).toBe(second);
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain("192.0.2.1");
  });

  it("does not let arbitrary authorization headers bypass IP limits", async () => {
    const first = await rateLimitKey(new Request("https://findly.example/v1/search", { headers: { authorization: "Bearer one", "cf-connecting-ip": "192.0.2.1" } }));
    const second = await rateLimitKey(new Request("https://findly.example/v1/search", { headers: { authorization: "Bearer two", "cf-connecting-ip": "192.0.2.1" } }));
    expect(first).toBe(second);
  });
});
