import { z } from "zod";

export const CurrencyCodeSchema = z.string().regex(/^[A-Z]{3}$/);
export const CountryCodeSchema = z.string().regex(/^[A-Z]{2}$/);
export const MoneySchema = z.object({ amountMinor: z.int(), currency: CurrencyCodeSchema });
export type Money = z.infer<typeof MoneySchema>;

export const ShoppingLocationSchema = z.object({
  postalCode: z.string().optional(), latitude: z.number().optional(), longitude: z.number().optional(),
  city: z.string().optional(), region: z.string().optional(), country: CountryCodeSchema
});

// currency has no default: the API fills it from SearchRequest.currency or env DEFAULT_CURRENCY.
export const ShoppingRequestSchema = z.object({
  intent: z.enum(["identify_product", "find_exact_product", "find_product_for_task", "compare_product", "check_compatibility", "find_in_store", "check_inventory"]),
  originalQuery: z.string().optional(), category: z.string().optional(), possibleProductNames: z.array(z.string()).default([]),
  manufacturer: z.string().optional(), modelNumber: z.string().optional(), barcode: z.string().optional(), useCase: z.string().optional(),
  requiredFeatures: z.array(z.string()).default([]), optionalFeatures: z.array(z.string()).default([]), excludedFeatures: z.array(z.string()).default([]),
  existingEquipment: z.array(z.object({ kind: z.string(), brand: z.string().optional(), model: z.string().optional() })).default([]),
  compatibilityConstraints: z.array(z.object({ attribute: z.string(), requiredValue: z.string() })).default([]),
  preferredBrands: z.array(z.string()).default([]), excludedBrands: z.array(z.string()).default([]), preferredRetailers: z.array(z.string()).default([]), excludedRetailers: z.array(z.string()).default([]),
  maximumPrice: MoneySchema.optional(), currency: CurrencyCodeSchema,
  urgency: z.enum(["immediate", "today", "tomorrow", "this_week", "no_preference"]).default("no_preference"),
  fulfillmentPreferences: z.array(z.enum(["pickup", "delivery", "shipping", "in_store"])).default([]),
  location: ShoppingLocationSchema.optional(), selectedStoreId: z.string().optional(), clarificationNeeded: z.boolean().default(false),
  clarificationQuestion: z.string().optional(), clarificationOptions: z.array(z.string()).optional(), confidence: z.number().min(0).max(1)
});
export type ShoppingRequest = z.infer<typeof ShoppingRequestSchema>;

export const RetailerIdSchema = z.string().min(1);
export type RetailerId = z.infer<typeof RetailerIdSchema>;
export const KNOWN_RETAILERS: Record<string, { name: string; domain: string }> = {
  amazon: { name: "Amazon", domain: "amazon.com" }, walmart: { name: "Walmart", domain: "walmart.com" }, home_depot: { name: "The Home Depot", domain: "homedepot.com" },
  best_buy: { name: "Best Buy", domain: "bestbuy.com" }, google_shopping: { name: "Google Shopping", domain: "shopping.google.com" },
  home_depot_ca: { name: "Home Depot Canada", domain: "homedepot.ca" }, amazon_ca: { name: "Amazon Canada", domain: "amazon.ca" }, walmart_ca: { name: "Walmart Canada", domain: "walmart.ca" },
  canadian_tire: { name: "Canadian Tire", domain: "canadiantire.ca" }, rona_ca: { name: "RONA", domain: "rona.ca" }, best_buy_ca: { name: "Best Buy Canada", domain: "bestbuy.ca" }
};
export const RetailerCapabilitiesSchema = z.object({ productSearch: z.boolean(), productDetails: z.boolean(), currentPrice: z.boolean(), storeInventory: z.boolean(), inventoryQuantity: z.boolean(), pickupEstimate: z.boolean(), deliveryEstimate: z.boolean(), aisleLocation: z.boolean(), bayLocation: z.boolean(), cartDeepLink: z.boolean(), pickupDeepLink: z.boolean(), officialApi: z.boolean(), browserAutomation: z.boolean() });
export type RetailerCapabilities = z.infer<typeof RetailerCapabilitiesSchema>;

export const NormalizedRetailOfferSchema = z.object({
  offerId: z.string(), retailer: z.object({ id: RetailerIdSchema, name: z.string(), domain: z.string() }),
  seller: z.object({ name: z.string().optional(), type: z.enum(["first_party", "marketplace", "unknown"]) }),
  product: z.object({
    title: z.string(), brand: z.string().optional(), modelNumber: z.string().optional(), manufacturerPartNumber: z.string().optional(),
    upc: z.string().optional(), gtin: z.string().optional(), ean: z.string().optional(), category: z.string().optional(),
    variant: z.string().optional(), size: z.string().optional(), colour: z.string().optional(), imageUrl: z.url().optional(),
    rating: z.number().min(0).max(5).optional(), reviewCount: z.int().nonnegative().optional()
  }),
  price: z.object({ item: MoneySchema, shipping: MoneySchema.optional(), estimatedTax: MoneySchema.optional(), total: MoneySchema }),
  fulfillment: z.object({
    shipping: z.boolean(), delivery: z.boolean(), pickup: z.boolean(), inStore: z.boolean(),
    status: z.enum(["in_stock", "limited", "out_of_stock", "unknown"]),
    inventoryQuantity: z.int().nonnegative().optional(), storeId: z.string().optional(), storeName: z.string().optional(),
    storeDistanceKm: z.number().nonnegative().optional(), aisle: z.string().optional(), bay: z.string().optional(), estimate: z.string().optional()
  }),
  url: z.url(), source: z.object({ kind: z.enum(["official_api", "search_api", "browser_verified", "fixture", "unknown"]), observedAt: z.iso.datetime(), liveVerified: z.boolean(), artifactId: z.string().optional() }),
  confidence: z.number().min(0).max(1), warnings: z.array(z.string()).default([])
});
export type NormalizedRetailOffer = z.infer<typeof NormalizedRetailOfferSchema>;

export const SearchRequestSchema = z.object({
  text: z.string().min(1).optional(), barcode: z.string().optional(), productUrl: z.url().optional(), imageIds: z.array(z.string()).default([]),
  selectedStoreId: z.string().optional(), postalCode: z.string().optional(), country: z.string().regex(/^[A-Za-z]{2}$/).optional(), latitude: z.number().min(-90).max(90).optional(), longitude: z.number().min(-180).max(180).optional(),
  locationAccuracyMeters: z.number().nonnegative().optional(), locationApproximate: z.boolean().optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional(), maxPrice: z.number().positive().optional()
}).refine(v => Boolean(v.text || v.barcode || v.productUrl || v.imageIds.length), "At least one input is required")
  .refine(v => (v.latitude === undefined) === (v.longitude === undefined), "Latitude and longitude must be supplied together");
export type SearchRequest = z.infer<typeof SearchRequestSchema>;

export const ProgressEventSchema = z.object({ type: z.enum(["progress", "clarification", "warning", "complete", "failure"]), stage: z.string(), message: z.string(), retailer: RetailerIdSchema.optional(), offersFound: z.number().optional(), timestamp: z.iso.datetime(), data: z.unknown().optional() });
export type ProgressEvent = z.infer<typeof ProgressEventSchema>;

export const SearchResponseSchema = z.object({ requestId: z.string(), threadId: z.string(), status: z.string(), understoodRequest: ShoppingRequestSchema.optional(), clarification: z.object({ type: z.literal("clarification"), requestId: z.string(), question: z.string(), options: z.array(z.string()).optional(), reason: z.string().optional() }).optional(), offers: z.array(NormalizedRetailOfferSchema), recommendation: z.object({ headline: z.string(), explanation: z.string(), bestOfferId: z.string().optional() }).optional(), warnings: z.array(z.string()) });
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
