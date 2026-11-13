import { execFile } from "node:child_process";
import { z } from "zod";
import type { NormalizedRetailOffer, RetailerCapabilities } from "@findly/contracts";
import type { RetailerAdapter, RetailerExecutionContext, RetailerSearchInput, RetailerSearchResult } from "@findly/retailer-sdk";
import { extractProductRatingMetadata } from "./rating-parser.js";

const capabilities: RetailerCapabilities = {
  productSearch: true, productDetails: true, currentPrice: true, storeInventory: true, inventoryQuantity: true,
  pickupEstimate: true, deliveryEstimate: false, aisleLocation: true, bayLocation: true,
  cartDeepLink: false, pickupDeepLink: false, officialApi: false, browserAutomation: false
};

const StoreSchema = z.object({
  name: z.string(), displayName: z.string(), formattedDistance: z.string().optional(), bopisEligible: z.boolean().default(false),
  address: z.object({ formattedAddress: z.string(), postalCode: z.string(), town: z.string() }),
  geoPoint: z.object({ latitude: z.number(), longitude: z.number() })
});
const StoreSearchSchema = z.object({ stores: z.array(StoreSchema).min(1) });
const HomeDepotProductSchema = z.object({
  code: z.string(), name: z.string().min(2).max(500), modelNumber: z.string().max(100).optional(),
  brand: z.string().max(100).optional(), url: z.string(), imageUrl: z.string().url().optional(),
  pricing: z.object({ storeId: z.string(), displayPrice: z.object({ currencyIso: z.string(), value: z.number().nonnegative() }) }),
  stock: z.object({ stockLevel: z.number().optional(), stockLevelStatus: z.string().optional() }).default({}),
  storeStock: z.object({ stockLevel: z.number().optional(), stockLevelStatus: z.string().optional() }).default({}),
  fulfillmentOptions: z.object({ addToCart: z.boolean().optional(), bopisAddToCart: z.boolean().optional(), shippingMessage: z.string().optional(), storeMessage: z.string().optional() }).default({}),
  aisleBay: z.object({ aisle: z.union([z.string(), z.number()]).optional(), bay: z.union([z.string(), z.number()]).optional(), aisleNumber: z.union([z.string(), z.number()]).optional(), bayNumber: z.union([z.string(), z.number()]).optional() }).default({})
});
const HomeDepotSearchSchema = z.object({ products: z.array(z.unknown()) });

const BASE_URL = "https://www.homedepot.ca";
const HEADERS = [
  "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0",
  "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language: en-GB,en;q=0.5",
  "Referer: https://www.homedepot.ca/en/home.html",
  "Sec-Fetch-Dest: document",
  "Sec-Fetch-Mode: navigate",
  "Sec-Fetch-Site: same-origin",
  "Sec-Fetch-User: ?1",
  "Upgrade-Insecure-Requests: 1",
];

const clean = (value: string) => value.replace(/[\u0000-\u001f<>]/g, " ").replace(/\s+/g, " ").trim();
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

async function homeDepotGet<T>(path: string, timeoutMs = 30_000): Promise<T> {
  const args = ["--http2", "--compressed", "--silent", "--show-error", "--max-time", String(Math.ceil(timeoutMs / 1_000)), "--write-out", "\n%{http_code}"];
  for (const header of HEADERS) args.push("-H", header);
  args.push(`${BASE_URL}${path}`);

  const stdout = await new Promise<string>((resolve, reject) => {
    execFile("curl", args, { encoding: "utf8", timeout: timeoutMs + 5_000, maxBuffer: 32 * 1024 * 1024 }, (error, output) => {
      if (error) return reject(new Error(`Home Depot request failed: ${error.message}`));
      resolve(output);
    });
  });
  const newline = stdout.lastIndexOf("\n");
  const body = newline >= 0 ? stdout.slice(0, newline) : stdout;
  const status = Number(newline >= 0 ? stdout.slice(newline + 1).trim() : 0);
  if (status < 200 || status >= 300) throw new Error(`Home Depot API returned ${status}`);
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error("Home Depot API returned invalid JSON");
  }
}

export class HomeDepotAdapter implements RetailerAdapter {
  readonly retailer = { id: "home_depot_ca" as const, name: "Home Depot Canada", domain: "homedepot.ca", capabilities, live: true };
  supports(capability: keyof RetailerCapabilities) { return capabilities[capability]; }

  async searchProducts(input: RetailerSearchInput, _context: RetailerExecutionContext): Promise<RetailerSearchResult> {
    const store = await this.resolveStore(input);
    const params = new URLSearchParams({ q: input.query, store: store.name, lang: "en", page: "0", pageSize: "16" });
    const parsedSearch = HomeDepotSearchSchema.parse(await homeDepotGet(`/api/search/v1/search?${params}`));
    const observedAt = new Date().toISOString();
    const storeDistanceKm = input.latitude !== undefined && input.longitude !== undefined
      ? haversineKm({ latitude: input.latitude, longitude: input.longitude }, store.geoPoint)
      : distanceKm(store.formattedDistance);

    const offers = parsedSearch.products.flatMap((rawProduct): NormalizedRetailOffer[] => {
      const parsedProduct = HomeDepotProductSchema.safeParse(rawProduct);
      if (!parsedProduct.success) return [];
      const product = parsedProduct.data;
      if (product.pricing.storeId !== store.name || product.pricing.displayPrice.currencyIso !== "CAD") return [];
      const ratingMetadata = extractProductRatingMetadata(rawProduct);
      const minor = Math.round(product.pricing.displayPrice.value * 100);
      const quantity = Math.max(0, Math.trunc(product.storeStock.stockLevel ?? 0));
      const status = stockStatus(quantity, product.storeStock.stockLevelStatus ?? product.fulfillmentOptions.storeMessage);
      const pickup = store.bopisEligible && product.fulfillmentOptions.bopisAddToCart === true && quantity > 0;
      const aisle = product.aisleBay.aisle ?? product.aisleBay.aisleNumber;
      const bay = product.aisleBay.bay ?? product.aisleBay.bayNumber;
      const url = new URL(product.url, BASE_URL).href;
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
        url, source: { kind: "official_api", observedAt, liveVerified: true }, confidence: 0.92, warnings
      }];
    });

    return {
      retailerId: "home_depot_ca", offers, observedAt, liveVerified: true,
      warnings: offers.length ? [] : [`Home Depot ${store.displayName} returned no products that passed validation`]
    };
  }

  private async resolveStore(input: RetailerSearchInput): Promise<z.infer<typeof StoreSchema>> {
    if (input.selectedStoreId) {
      const params = new URLSearchParams({ openingHours: "true", lang: "en" });
      return StoreSchema.parse(await homeDepotGet(`/api/storesvc/v1/stores/${encodeURIComponent(input.selectedStoreId)}?${params}`));
    }
    const params = new URLSearchParams({ pageSize: "10", lang: "en" });
    if (input.postalCode) params.set("query", input.postalCode.toUpperCase().replace(/\s+/g, ""));
    else if (input.latitude !== undefined && input.longitude !== undefined) {
      params.set("latitude", String(input.latitude));
      params.set("longitude", String(input.longitude));
    } else throw new Error("A location is required to verify Home Depot store inventory");

    const stores = StoreSearchSchema.parse(await homeDepotGet(`/api/storesvc/v1/stores?${params}`)).stores;
    if (input.latitude !== undefined && input.longitude !== undefined) {
      const origin = { latitude: input.latitude, longitude: input.longitude };
      return [...stores].sort((left, right) => haversineKm(origin, left.geoPoint) - haversineKm(origin, right.geoPoint))[0]!;
    }
    return stores[0]!;
  }

  async getProductDetails(_input: { url: string }, _context: RetailerExecutionContext): Promise<NormalizedRetailOffer> { throw new Error("Use searchProducts to obtain store-verified product details"); }
  async getStoreInventory() { return { status: "unknown" }; }
  async preparePurchaseLink(input: { offer: NormalizedRetailOffer }) { return { url: input.offer.url, retailerCheckout: true }; }
}
