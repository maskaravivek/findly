import { chromium } from "playwright";
import { z } from "zod";
import type { NormalizedRetailOffer, RetailerCapabilities } from "@findly/contracts";
import type { RetailerAdapter, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";
import type { BrowserService } from "../browser/browser-service.js";

const capabilities: RetailerCapabilities = {
  productSearch: true, productDetails: false, currentPrice: true, storeInventory: false, inventoryQuantity: false,
  pickupEstimate: false, deliveryEstimate: true, aisleLocation: false, bayLocation: false,
  cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: true
};
const CardSchema = z.object({
  asin: z.string().min(5), title: z.string().min(3).max(500), href: z.string().url(), priceText: z.string().max(50),
  imageUrl: z.string().url().optional(), text: z.string().max(2_000)
});
const MOBILE_USER_AGENT = "Mozilla/5.0 (Linux; Android 15; Pixel 9 Pro XL) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36";
const clean = (value: string) => value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
const priceMinor = (value: string) => {
  const match = value.replace(/,/g, "").match(/\$\s*(\d+)(?:\.(\d{2}))?/);
  return match ? Number(match[1]) * 100 + Number(match[2] ?? 0) : null;
};
const deliveryEstimate = (value: string) => clean(value).match(/(?:FREE |fastest )?delivery\s+(.{3,45}?)(?=Or |$|\$)/i)?.[0];
const isRelevantPowerDrill = (query: string, category: string | undefined, title: string) => {
  if (/cordless drills?|power drills?/i.test(`${query} ${category ?? ""}`) && /nail drill/i.test(title)) return false;
  const tokens = clean(query).toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length >= 4 && !["find", "need", "machine", "nearby", "cheaper"].includes(token));
  if (!tokens.length) return true;
  const normalizedTitle = title.toLowerCase();
  return tokens.some(token => normalizedTitle.includes(token.replace(/ing$/, "")));
};

export class AmazonBrowserbaseAdapter implements RetailerAdapter {
  readonly retailer = { id: "amazon_ca" as const, name: "Amazon Canada", domain: "amazon.ca", capabilities, live: true };
  constructor(private readonly browserService: BrowserService) {}
  supports(capability: keyof RetailerCapabilities) { return capabilities[capability]; }

  async searchProducts(input: RetailerSearchInput, context: RetailerExecutionContext): Promise<RetailerSearchResult> {
    const session = await this.browserService.createSession({ retailerDomain: this.retailer.domain, timeoutSeconds: 90, correlationId: context.correlationId });
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const observedAt = new Date().toISOString();
    try {
      const browserContext = browser.contexts()[0] ?? await browser.newContext();
      const page = browserContext.pages()[0] ?? await browserContext.newPage();
      const cdp = await browserContext.newCDPSession(page);
      await cdp.send("Network.setUserAgentOverride", { userAgent: MOBILE_USER_AGENT, acceptLanguage: "en-CA,en;q=0.9", platform: "Android" });
      await page.setViewportSize({ width: 412, height: 915 });
      await page.goto(`https://www.amazon.ca/s?k=${encodeURIComponent(input.query)}&language=en_CA`, { waitUntil: "domcontentloaded", timeout: 35_000 });
      await page.waitForTimeout(1_500);
      const pageText = await page.locator("body").innerText().catch(() => "");
      if (/captcha|robot check|enter the characters|something went wrong/i.test(`${await page.title()} ${pageText.slice(0, 1_000)}`)) {
        throw new Error("Amazon access challenge; not retried");
      }

      let deliveryLocationVerified = false;
      if (input.postalCode) deliveryLocationVerified = await this.trySetPostalCode(page, input.postalCode);
      await page.locator("[data-component-type='s-search-result']").first().waitFor({ state: "attached", timeout: 8_000 });
      const raw = await page.locator("[data-component-type='s-search-result']").evaluateAll(nodes => nodes.slice(0, 16).map(node => {
        const titleNode = node.querySelector<HTMLElement>("h2 span, [data-cy='title-recipe'] h2, .a-size-base-plus.a-color-base.a-text-normal");
        const link = node.querySelector<HTMLAnchorElement>("h2 a[href*='/dp/'], a[href*='/dp/']");
        const image = node.querySelector<HTMLImageElement>("img.s-image");
        return {
          asin: node.getAttribute("data-asin") ?? "", title: (titleNode?.textContent ?? "").trim(), href: link?.href ?? "",
          priceText: node.querySelector<HTMLElement>(".a-price .a-offscreen")?.textContent?.trim() ?? "",
          imageUrl: image?.currentSrc || image?.dataset.src || image?.src || undefined,
          text: (node.textContent ?? "").replace(/\s+/g, " ").trim()
        };
      }));

      const offers = raw.flatMap((value, index): NormalizedRetailOffer[] => {
        const parsed = CardSchema.safeParse({ ...value, title: clean(value.title), text: clean(value.text) });
        if (!parsed.success || !isRelevantPowerDrill(input.query, input.request.category, parsed.data.title)) return [];
        const host = new URL(parsed.data.href).hostname;
        const minor = priceMinor(parsed.data.priceText);
        if (minor === null || !(host === "amazon.ca" || host.endsWith(".amazon.ca"))) return [];
        const estimate = deliveryEstimate(parsed.data.text);
        const warnings = [
          "Seller and bundle details require verification on Amazon",
          ...(!deliveryLocationVerified && input.postalCode ? ["Amazon delivery timing was not verified for your postal code"] : [])
        ];
        return [{
          offerId: `amazon_ca:${parsed.data.asin}:${index}`,
          retailer: { id: "amazon_ca", name: this.retailer.name, domain: this.retailer.domain }, seller: { type: "unknown" },
          product: { title: parsed.data.title, ...(parsed.data.imageUrl && !/grey-pixel|\.svg/i.test(parsed.data.imageUrl) ? { imageUrl: parsed.data.imageUrl } : {}) },
          price: { item: { amountMinor: minor, currency: "CAD" }, total: { amountMinor: minor, currency: "CAD" } },
          fulfillment: { shipping: true, delivery: Boolean(estimate), pickup: false, inStore: false, status: "in_stock", ...(estimate && deliveryLocationVerified ? { estimate } : {}) },
          url: parsed.data.href, source: { kind: "browser_verified", observedAt, liveVerified: true }, confidence: 0.72, warnings
        }];
      }).slice(0, 10);
      return { retailerId: "amazon_ca", offers, observedAt, liveVerified: true, warnings: offers.length ? [] : ["Amazon loaded, but no relevant priced products passed validation"] };
    } finally {
      await browser.close().catch(() => undefined);
      await this.browserService.closeSession(session.id).catch(() => undefined);
    }
  }

  private async trySetPostalCode(page: import("playwright").Page, postalCode: string) {
    try {
      const consent = page.locator("#sp-cc-accept");
      if (await consent.isVisible({ timeout: 500 }).catch(() => false)) await consent.click();
      const location = page.locator("#nav-global-location-slot");
      if (!await location.isVisible({ timeout: 1_000 }).catch(() => false)) return false;
      await location.click();
      const input = page.locator("#GLUXZipUpdateInput");
      await input.waitFor({ state: "visible", timeout: 2_000 });
      await input.fill(postalCode.replace(/\s+/g, ""));
      await page.locator("#GLUXZipUpdate").click();
      await page.waitForTimeout(1_000);
      const label = await page.locator("#glow-ingress-single-line").textContent().catch(() => "");
      return clean(label ?? "").replace(/\s+/g, "").includes(postalCode.replace(/\s+/g, "").slice(0, 3).toUpperCase());
    } catch {
      return false;
    }
  }

  async getProductDetails(): Promise<NormalizedRetailOffer> { throw new Error("Amazon product details are not implemented"); }
  async getStoreInventory() { return { status: "unknown" }; }
  async preparePurchaseLink(input: { offer: NormalizedRetailOffer }) { return { url: input.offer.url, retailerCheckout: true }; }
}
