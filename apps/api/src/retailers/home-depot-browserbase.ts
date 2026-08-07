import { chromium, type Page } from "playwright";
import { z } from "zod";
import type { NormalizedRetailOffer, RetailerCapabilities } from "@findly/contracts";
import type { RetailerAdapter, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";
import type { BrowserService } from "../browser/browser-service.js";
import { extractProductRatingMetadata, parseRating, parseReviewCount } from "./rating-parser.js";

const capabilities: RetailerCapabilities = {
  productSearch: true, productDetails: true, currentPrice: true, storeInventory: true, inventoryQuantity: true,
  pickupEstimate: true, deliveryEstimate: false, aisleLocation: true, bayLocation: true,
  cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: true
};

const StoreSchema = z.object({
  name: z.string(), displayName: z.string(), description: z.string().optional(), formattedDistance: z.string().optional(),
  bopisEligible: z.boolean().default(false),
  address: z.object({ formattedAddress: z.string(), postalCode: z.string(), town: z.string() }),
  geoPoint: z.object({ latitude: z.number(), longitude: z.number() })
});
const StoreSearchSchema = z.object({ stores: z.array(StoreSchema).min(1) });

const HomeDepotProductSchema = z.object({
  code: z.string(), name: z.string().min(2).max(500), modelNumber: z.string().max(100).optional(),
  brand: z.string().max(100).optional(), url: z.string(), imageUrl: z.string().url().optional(),
  pricing: z.object({ displayPrice: z.object({ currencyIso: z.string(), value: z.number().nonnegative() }) }),
  stock: z.object({ stockLevel: z.number().optional(), stockLevelStatus: z.string().optional() }).default({}),
  storeStock: z.object({ stockLevel: z.number().optional(), stockLevelStatus: z.string().optional() }).default({}),
  fulfillmentOptions: z.object({ addToCart: z.boolean().optional(), bopisAddToCart: z.boolean().optional(), shippingMessage: z.string().optional(), storeMessage: z.string().optional() }).default({}),
  aisleBay: z.object({ aisle: z.union([z.string(), z.number()]).optional(), bay: z.union([z.string(), z.number()]).optional(), aisleNumber: z.union([z.string(), z.number()]).optional(), bayNumber: z.union([z.string(), z.number()]).optional() }).default({})
});
const HomeDepotSearchSchema = z.object({ products: z.array(z.unknown()) });

export async function readHomeDepotSearchPayload(
  primary: () => Promise<unknown>,
  replay: () => Promise<unknown>
) {
  let payload: unknown;
  try {
    payload = await primary();
  } catch {
    payload = await replay();
  }
  return HomeDepotSearchSchema.parse(payload);
}

const clean = (value: string) => value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
const compactPostal = (value: string) => value.toUpperCase().replace(/\s+/g, "");
const distanceKm = (value?: string) => {
  const parsed = value?.match(/([\d.]+)\s*km/i)?.[1];
  return parsed ? Number(parsed) : undefined;
};
const haversineKm = (from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }) => {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = radians(to.latitude - from.latitude);
  const longitudeDelta = radians(to.longitude - from.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const stockStatus = (quantity: number, raw?: string): "in_stock" | "limited" | "out_of_stock" | "unknown" => {
  if (quantity > 0) return quantity <= 3 ? "limited" : "in_stock";
  if (/outofstock|out_of_stock|zero/i.test(raw ?? "")) return "out_of_stock";
  return "unknown";
};

async function readHomeDepotDomRatings(page: Page) {
  await page.locator("a[href*='/product/']").first().waitFor({ state: "attached", timeout: 1_500 }).catch(() => undefined);
  const values = await page.locator("a[href*='/product/']").evaluateAll(links => links.slice(0, 80).flatMap(link => {
    const href = (link as HTMLAnchorElement).href;
    const code = href.match(/\/(\d{8,})(?:[/?#]|$)/)?.[1];
    if (!code) return [];
    let container: HTMLElement | null = link as HTMLElement;
    for (let depth = 0; depth < 7 && container && container.tagName !== "BODY"; depth += 1) {
      const text = (container.textContent ?? "").replace(/\s+/g, " ");
      const ariaText = Array.from(container.querySelectorAll<HTMLElement>("[aria-label*='out of 5'], [aria-label*='star']"))
        .map(value => value.getAttribute("aria-label") ?? "").join(" ");
      const ratingText = `${ariaText} ${text}`.match(/\d(?:\.\d+)?\s*(?:out of 5|stars?)/i)?.[0];
      if (ratingText) {
        const reviewCountText = text.match(/(?:\(|\b)(\d[\d,.]*\s*[KM]?)(?:\)|\s+reviews?\b)/i)?.[1];
        return [{ code, ratingText, reviewCountText }];
      }
      container = container.parentElement;
    }
    return [];
  }));
  return new Map(values.map(value => [value.code, {
    ...(parseRating(value.ratingText) !== undefined ? { rating: parseRating(value.ratingText)! } : {}),
    ...(parseReviewCount(value.reviewCountText) !== undefined ? { reviewCount: parseReviewCount(value.reviewCountText)! } : {})
  }]));
}

export class HomeDepotBrowserbaseAdapter implements RetailerAdapter {
  readonly retailer = { id: "home_depot_ca" as const, name: "Home Depot Canada", domain: "homedepot.ca", capabilities, live: true };
  constructor(private readonly browserService: BrowserService) {}
  supports(capability: keyof RetailerCapabilities) { return capabilities[capability]; }

  async searchProducts(input: RetailerSearchInput, context: RetailerExecutionContext): Promise<RetailerSearchResult> {
    const session = await this.browserService.createSession({ retailerDomain: this.retailer.domain, timeoutSeconds: 120, correlationId: context.correlationId });
    const browser = await chromium.connectOverCDP(session.connectUrl);
    const observedAt = new Date().toISOString();
    try {
      const page = browser.contexts()[0]?.pages()[0] ?? await browser.newPage();
      const searchUrl = `https://www.homedepot.ca/search?q=${encodeURIComponent(input.query)}`;
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 35_000 });
      await page.waitForTimeout(2_000);
      const title = await page.title();
      const pageText = await page.locator("body").innerText().catch(() => "");
      if (/captcha|access denied|verify you are human/i.test(`${title} ${pageText.slice(0, 600)}`)) throw new Error("Retailer access challenge; not retried");

      let store: z.infer<typeof StoreSchema>;
      let searchResponse: import("playwright").Response;
      store = await this.openAndResolveStore(page, input);
      searchResponse = await this.selectStoreAndWaitForSearch(page, store, input.query);
      const parsedSearch = await readHomeDepotSearchPayload(
        () => searchResponse.json(),
        async () => {
          const replay = await page.context().request.get(searchResponse.url(), {
            headers: { accept: "application/json" },
            timeout: 15_000
          });
          if (!replay.ok()) throw new Error(`Home Depot product search replay returned ${replay.status()}`);
          return replay.json();
        }
      );
      const storeDistanceKm = input.latitude !== undefined && input.longitude !== undefined
        ? haversineKm({ latitude: input.latitude, longitude: input.longitude }, store.geoPoint)
        : distanceKm(store.formattedDistance);
      const domRatings = await readHomeDepotDomRatings(page);

      const offers = parsedSearch.products.slice(0, 16).flatMap((rawProduct): NormalizedRetailOffer[] => {
        const parsedProduct = HomeDepotProductSchema.safeParse(rawProduct);
        if (!parsedProduct.success) return [];
        const product = parsedProduct.data;
        const ratingMetadata = domRatings.get(product.code) ?? extractProductRatingMetadata(rawProduct);
        if (product.pricing.displayPrice.currencyIso !== "CAD") return [];
        const minor = Math.round(product.pricing.displayPrice.value * 100);
        const quantity = Math.max(0, Math.trunc(product.storeStock.stockLevel ?? 0));
        const status = stockStatus(quantity, product.storeStock.stockLevelStatus ?? product.fulfillmentOptions.storeMessage);
        const pickup = store.bopisEligible && product.fulfillmentOptions.bopisAddToCart === true && quantity > 0;
        const aisle = product.aisleBay.aisle ?? product.aisleBay.aisleNumber;
        const bay = product.aisleBay.bay ?? product.aisleBay.bayNumber;
        const path = product.url.startsWith("/") ? product.url : `/${product.url}`;
        const url = new URL(path, "https://www.homedepot.ca").href;
        const warnings = [
          ...(!pickup && quantity > 0 ? ["Store stock was verified, but pickup was not offered for this item"] : []),
          ...(input.locationApproximate ? ["Closest store is based on an approximate device location"] : [])
        ];
        return [{
          offerId: `home_depot_ca:${product.code}:${store.name}`,
          retailer: { id: "home_depot_ca", name: this.retailer.name, domain: this.retailer.domain }, seller: { type: "first_party" },
          product: {
            title: clean(product.name), ...(product.brand ? { brand: clean(product.brand) } : {}),
            ...(product.modelNumber ? { modelNumber: clean(product.modelNumber) } : {}), ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
            ...ratingMetadata
          },
          price: { item: { amountMinor: minor, currency: "CAD" }, total: { amountMinor: minor, currency: "CAD" } },
          fulfillment: {
            shipping: product.fulfillmentOptions.addToCart === true && (product.stock.stockLevel ?? 0) > 0,
            delivery: false, pickup, inStore: quantity > 0, status, inventoryQuantity: quantity,
            storeId: store.name, storeName: `${clean(store.displayName)} Home Depot`,
            ...(storeDistanceKm !== undefined ? { storeDistanceKm } : {}),
            ...(aisle !== undefined ? { aisle: String(aisle) } : {}), ...(bay !== undefined ? { bay: String(bay) } : {}),
            ...(pickup ? { estimate: "Pickup available" } : {})
          },
          url, source: { kind: "browser_verified", observedAt, liveVerified: true }, confidence: 0.9, warnings
        }];
      });

      return {
        retailerId: "home_depot_ca", offers, observedAt, liveVerified: true,
        warnings: offers.length ? [] : [`Home Depot ${store.displayName} loaded, but no products passed validation`]
      };
    } finally {
      await browser.close().catch(() => undefined);
      await this.browserService.closeSession(session.id).catch(() => undefined);
    }
  }

  private async resolveStore(page: Page, input: RetailerSearchInput): Promise<z.infer<typeof StoreSchema>> {
    const isStoreSearch = (response: import("playwright").Response) => response.url().includes("/api/storesvc/v1/stores?pageSize=");
    let response: import("playwright").Response;
    if (!input.postalCode && input.latitude !== undefined && input.longitude !== undefined) {
      const nearest = page.getByText("Find My Nearest Store", { exact: true });
      await nearest.waitFor({ state: "visible", timeout: 8_000 });
      const responsePromise = page.waitForResponse(candidate => {
        if (!isStoreSearch(candidate)) return false;
        const latitude = Number(new URL(candidate.url()).searchParams.get("latitude"));
        const longitude = Number(new URL(candidate.url()).searchParams.get("longitude"));
        return Math.abs(latitude - input.latitude!) < 0.01 && Math.abs(longitude - input.longitude!) < 0.01;
      }, { timeout: 15_000 });
      await nearest.click();
      response = await responsePromise;
    } else {
      const query = input.selectedStoreId ?? input.postalCode;
      if (!query) throw new Error("A location is required to verify Home Depot store inventory");
      const locatorInput = page.getByPlaceholder("Postal Code, City, or Store Number");
      await locatorInput.fill(query);
      const responsePromise = page.waitForResponse(candidate => isStoreSearch(candidate) && new URL(candidate.url()).searchParams.has("query"), { timeout: 15_000 });
      await page.locator("form").filter({ has: locatorInput }).locator("button[type=submit]").click();
      response = await responsePromise;
    }
    if (response.status() !== 200) throw new Error(`Home Depot store lookup returned ${response.status()}; not retried`);
    const stores = StoreSearchSchema.parse(await response.json()).stores;
    if (input.selectedStoreId) return stores.find(store => store.name === input.selectedStoreId) ?? stores[0]!;
    if (input.latitude !== undefined && input.longitude !== undefined) {
      const origin = { latitude: input.latitude, longitude: input.longitude };
      return [...stores].sort((left, right) => haversineKm(origin, left.geoPoint) - haversineKm(origin, right.geoPoint))[0]!;
    }
    return stores[0]!;
  }

  private async openStoreSelector(page: Page) {
    const confirmationChange = page.getByRole("button", { name: /change store/i }).first();
    if (await confirmationChange.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await confirmationChange.click({ timeout: 10_000 });
    } else {
      const storeMenu = page.locator("acl-store-hours-menu").filter({ hasText: /Select My Store|Change Store/i }).first();
      await storeMenu.waitFor({ state: "visible", timeout: 15_000 });
      await storeMenu.click({ timeout: 10_000 });
    }
    await page.getByPlaceholder("Postal Code, City, or Store Number").waitFor({ state: "visible", timeout: 8_000 });
  }

  private async openAndResolveStore(page: Page, input: RetailerSearchInput) {
    await this.openStoreSelector(page);
    return this.resolveStore(page, input);
  }

  private async selectStoreAndWaitForSearch(page: Page, store: z.infer<typeof StoreSchema>, query: string) {
    const input = page.getByPlaceholder("Postal Code, City, or Store Number");
    await input.waitFor({ state: "visible", timeout: 8_000 });
    await input.fill(store.name);
    const form = page.locator("form").filter({ has: input });
    await form.locator("button[type=submit]").click();
    const selectButtons = page.locator("button").filter({ hasText: /^\s*Select\s*$/ });
    await selectButtons.first().waitFor({ state: "visible", timeout: 10_000 });
    const localizationPromise = page.waitForResponse(response => response.request().method() === "POST" && response.url().includes("/api/localization/v1/location"), { timeout: 12_000 });
    await selectButtons.first().click();
    const localizationResponse = await localizationPromise;
    if (localizationResponse.status() !== 200) throw new Error(`Home Depot store selection returned ${localizationResponse.status()}; not retried`);
    const responsePromise = page.waitForResponse(response => {
      const url = response.url();
      return url.includes("/api/search/v1/search") && url.includes(`store=${store.name}`);
    }, { timeout: 25_000 });
    await page.goto(`https://www.homedepot.ca/search?q=${encodeURIComponent(query)}`, { waitUntil: "domcontentloaded", timeout: 35_000 });
    const response = await responsePromise;
    if (response.status() !== 200) throw new Error(`Home Depot product search returned ${response.status()}; not retried`);
    return response;
  }

  async getProductDetails(_input: { url: string }, _context: RetailerExecutionContext): Promise<NormalizedRetailOffer> { throw new Error("Use searchProducts to obtain store-verified product details"); }
  async getStoreInventory() { return { status: "unknown" }; }
  async preparePurchaseLink(input: { offer: NormalizedRetailOffer }) { return { url: input.offer.url, retailerCheckout: true }; }
}
