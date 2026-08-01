import Browserbase from "@browserbasehq/sdk";
import type { Env } from "../config/env.js";
export type BrowserSession = { id: string; connectUrl: string; debugUrl: string | null };
export type BrowserSessionOptions = { retailerDomain: string; timeoutSeconds?: number; correlationId: string };
export interface BrowserService { createSession(options: BrowserSessionOptions): Promise<BrowserSession>; closeSession(sessionId: string): Promise<void>; captureScreenshot(input: { sessionId: string; label: string }): Promise<{ artifactId: string; kind: "screenshot" }>; getDebugUrl(sessionId: string): Promise<string | null>; }
const ALLOWED = new Set(["homedepot.ca", "amazon.ca", "walmart.ca", "canadiantire.ca", "rona.ca", "bestbuy.ca"]);
export class BrowserbaseService implements BrowserService {
  private readonly client: Browserbase; private readonly sessions = new Map<string, BrowserSession>();
  constructor(private readonly config: Env) { if (!config.BROWSERBASE_API_KEY || !config.BROWSERBASE_PROJECT_ID) throw new Error("Browserbase credentials are not configured"); this.client = new Browserbase({ apiKey: config.BROWSERBASE_API_KEY }); }
  async createSession(options: BrowserSessionOptions) { if (!ALLOWED.has(options.retailerDomain)) throw new Error("Retailer domain is not allowlisted"); const geolocation = this.config.BROWSER_PROXY_COUNTRY ? { country: this.config.BROWSER_PROXY_COUNTRY, ...(this.config.BROWSER_PROXY_CITY ? { city: this.config.BROWSER_PROXY_CITY } : {}) } : null; const raw = await this.client.sessions.create({ projectId: this.config.BROWSERBASE_PROJECT_ID!, region: "us-east-1", ...(geolocation ? { proxies: [{ type: "browserbase" as const, geolocation }] } : {}), browserSettings: { blockAds: true, allowedDomains: [options.retailerDomain], solveCaptchas: false, recordSession: true }, timeout: options.timeoutSeconds ?? 120, userMetadata: { correlationId: options.correlationId, retailerDomain: options.retailerDomain } }); const debug = this.config.BROWSER_DEBUG_URLS ? await this.client.sessions.debug(raw.id) : null; const session = { id: raw.id, connectUrl: raw.connectUrl, debugUrl: debug?.debuggerUrl ?? null }; this.sessions.set(session.id, session); return session; }
  async closeSession(sessionId: string) { await this.client.sessions.update(sessionId, { status: "REQUEST_RELEASE", projectId: this.config.BROWSERBASE_PROJECT_ID! }); this.sessions.delete(sessionId); }
  async captureScreenshot(input: { sessionId: string; label: string }) { return { artifactId: `${input.sessionId}:${input.label}`, kind: "screenshot" as const }; }
  async getDebugUrl(sessionId: string) { return this.sessions.get(sessionId)?.debugUrl ?? null; }
}
