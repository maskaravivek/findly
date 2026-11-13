import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserUseBrowserService } from "../src/browser/browser-service.js";
import { EnvSchema } from "../src/config/env.js";

const config = EnvSchema.parse({
  NODE_ENV: "test",
  DEMO_MODE: "false",
  RETAILER_MODE: "live",
  MODEL_PROVIDER: "mock",
  BROWSER_USE_API_KEY: "bu_test_key",
});

const fetchMock = vi.fn();

beforeEach(() => fetchMock.mockReset());
afterEach(() => vi.unstubAllGlobals());

describe("Browser Use browser service", () => {
  it("creates a geolocated, CAPTCHA-solving session and returns its CDP URL", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: "session-1", cdpUrl: "wss://browser-use.example/cdp/session-1" }), { status: 201, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new BrowserUseBrowserService(config);
    const session = await service.createSession({ retailerDomain: "amazon.ca", country: "CA", timeoutSeconds: 90 });

    expect(session).toEqual({ id: "session-1", connectUrl: "wss://browser-use.example/cdp/session-1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.browser-use.com/api/v4/browsers");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({ "X-Browser-Use-API-Key": "bu_test_key", "Content-Type": "application/json" });
    expect(JSON.parse(init.body as string)).toEqual({ proxyCountryCode: "ca", solveCaptchas: true, timeout: 2, metadata: { retailerDomain: "amazon.ca" } });
  });

  it("stops a managed session with PATCH action=stop", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const service = new BrowserUseBrowserService(config);
    await service.closeSession("session-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.browser-use.com/api/v4/browsers/session-1");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body as string)).toEqual({ action: "stop" });
  });

  it("rejects domains outside the retailer allowlist", async () => {
    const service = new BrowserUseBrowserService(config);
    await expect(service.createSession({ retailerDomain: "example.com", country: "CA" })).rejects.toThrow("not allowlisted");
  });
});
