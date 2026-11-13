import type { Env } from "../config/env.js";

export type BrowserSession = {
  id: string;
  connectUrl: string;
};
export type BrowserSessionOptions = { retailerDomain: string; country: string; timeoutSeconds?: number };
export interface BrowserService {
  createSession(options: BrowserSessionOptions): Promise<BrowserSession>;
  closeSession(sessionId: string): Promise<void>;
}

const ALLOWED = new Set(["amazon.ca"]);
const BASE_URL = "https://api.browser-use.com/api/v4";
const SESSION_TIMEOUT_MINUTES_MAX = 240;

type CreateSessionResponse = { id: string; cdpUrl: string | null };

const errorBody = async (response: Response) => (await response.text()).replace(/\s+/g, " ").slice(0, 300);

export class BrowserUseBrowserService implements BrowserService {
  constructor(private readonly config: Env) {
    if (!config.BROWSER_USE_API_KEY) throw new Error("Browser Use credentials are not configured");
  }

  async createSession(options: BrowserSessionOptions): Promise<BrowserSession> {
    if (!ALLOWED.has(options.retailerDomain)) throw new Error("Retailer domain is not allowlisted");
    const timeoutMinutes = Math.min(SESSION_TIMEOUT_MINUTES_MAX, Math.max(1, Math.ceil((options.timeoutSeconds ?? 120) / 60)));
    const response = await fetch(`${BASE_URL}/browsers`, {
      method: "POST",
      headers: {
        "X-Browser-Use-API-Key": this.config.BROWSER_USE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        proxyCountryCode: options.country.toLowerCase(),
        solveCaptchas: true,
        timeout: timeoutMinutes,
        metadata: { retailerDomain: options.retailerDomain },
      }),
    });
    if (!response.ok) throw new Error(`Browser Use session creation failed (${response.status}): ${await errorBody(response)}`);
    const session = (await response.json()) as CreateSessionResponse;
    if (!session.id || !session.cdpUrl) throw new Error("Browser Use session did not return a CDP URL");
    return { id: session.id, connectUrl: session.cdpUrl };
  }

  async closeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${BASE_URL}/browsers/${encodeURIComponent(sessionId)}`, {
      method: "PATCH",
      headers: {
        "X-Browser-Use-API-Key": this.config.BROWSER_USE_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ action: "stop" }),
    });
    if (!response.ok) throw new Error(`Browser Use session stop failed (${response.status}): ${await errorBody(response)}`);
  }
}
