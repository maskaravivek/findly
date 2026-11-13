import { z } from "zod";
import { KNOWN_RETAILERS, type NormalizedRetailOffer, type RetailerCapabilities, type RetailerId } from "@findly/contracts";
import type { RetailerSearchInput, RetailerSortOrder } from "@findly/retailer-sdk";
import { parseRating, parseReviewCount } from "../rating-parser.js";
import type { SearchApiParams } from "./client.js";

export type EngineDefaults = { country: string; currency: string };
/** Resolved per request by buildParams; passed back into toOffer. */
export type EngineContext = { observedAt: string; currency: string; domain: string };
export type BuiltParams = { params: SearchApiParams; warnings: string[]; currency: string; domain: string };
export type SearchApiEngineDefinition<T = any> = {
  engine: string; retailerId: RetailerId; resultsKey: string; capabilities: Partial<RetailerCapabilities>;
  itemSchema: z.ZodType<T>;
  buildParams(input: RetailerSearchInput, defaults: EngineDefaults): BuiltParams;
  toOffer(item: T, context: EngineContext): NormalizedRetailOffer | null;
};

// Optional fields never fail the item: a bad type degrades to undefined.
const opt = <S extends z.ZodType>(schema: S) => schema.optional().catch(undefined);
const idish = z.union([z.string().min(1), z.number()]).transform(String);
const numberish = z.union([z.number(), z.string()]);
const text = z.string();
const required = { title: z.string().trim().min(1), extracted_price: z.number().positive() };

const money = (major: number, currency: string) => ({ amountMinor: Math.round(major * 100), currency });
const httpUrl = (value: string | undefined) => {
  if (!value) return undefined;
  try { const url = new URL(value); return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : undefined; } catch { return undefined; }
};
const retailerInfo = (id: RetailerId, domain?: string) => ({ id, name: KNOWN_RETAILERS[id]?.name ?? id, domain: domain ?? KNOWN_RETAILERS[id]?.domain ?? "" });
const sellerOf = (name: string | undefined, retailerId: RetailerId): NormalizedRetailOffer["seller"] => {
  const trimmed = name?.trim();
  if (!trimmed) return { type: "first_party" };
  const retailerName = (KNOWN_RETAILERS[retailerId]?.name ?? retailerId).replace(/^the\s+/i, "").replace(/\W/g, "").toLowerCase();
  return { name: trimmed, type: trimmed.replace(/\W/g, "").toLowerCase().includes(retailerName) ? "first_party" : "marketplace" };
};
const optional = <K extends string, V>(key: K, value: V | undefined) => (value === undefined ? {} : { [key]: value }) as Partial<Record<K, V>>;
const stockPositive = (value: string | number | undefined) =>
  typeof value === "number" ? value > 0 : typeof value === "string" ? /in stock|available|^\d*[1-9]\d*$/i.test(value.trim()) && !/out of stock|unavailable/i.test(value) : false;
const nonNegInt = (value: unknown) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;

type Common = { id?: string | undefined; title: string; extracted_price: number; link?: string | undefined; brand?: string | undefined; model_number?: string | undefined; rating?: string | number | undefined; reviews?: string | number | undefined; thumbnail?: string | undefined };
function baseOffer(retailerId: RetailerId, item: Common, context: EngineContext, confidence: number,
  extra: { seller: NormalizedRetailOffer["seller"]; fulfillment: NormalizedRetailOffer["fulfillment"]; url?: string | undefined; warnings?: string[] }): NormalizedRetailOffer | null {
  const url = httpUrl(extra.url ?? item.link);
  if (!item.id || !url) return null;
  const price = money(item.extracted_price, context.currency);
  return {
    offerId: `${retailerId}:${item.id}`, retailer: retailerInfo(retailerId, context.domain), seller: extra.seller,
    product: {
      title: item.title.trim(), ...optional("brand", item.brand?.trim() || undefined), ...optional("modelNumber", item.model_number?.trim() || undefined),
      ...optional("imageUrl", httpUrl(item.thumbnail)), ...optional("rating", parseRating(item.rating)), ...optional("reviewCount", parseReviewCount(item.reviews))
    },
    price: { item: price, total: price }, fulfillment: extra.fulfillment, url,
    source: { kind: "search_api", observedAt: context.observedAt, liveVerified: true }, confidence, warnings: extra.warnings ?? []
  };
}

const usOnly = (name: string, country: string) => country === "US" ? [] : [`${name} search covers US stores only; results are US listings priced in USD`];
const countryOf = (input: RetailerSearchInput, defaults: EngineDefaults) => (input.country ?? defaults.country).toUpperCase();
const sortParam = (name: string, sortBy: RetailerSortOrder | undefined, map: Partial<Record<RetailerSortOrder, string>>, warnings: string[]) => {
  if (!sortBy) return undefined;
  const value = map[sortBy];
  if (value === undefined && sortBy !== "relevance") warnings.push(`${name} does not support ${sortBy.replace(/_/g, " ")} sorting; using default order`);
  return value;
};
const dollars = (value: number | undefined) => value === undefined ? undefined : Number(value.toFixed(2));
const zip5 = (value: string | undefined) => value && /^\d{5}$/.test(value.trim()) ? value.trim() : undefined;
const storeId = (value: string | undefined) => value && /^\d{1,6}$/.test(value.trim()) ? value.trim() : undefined;

// ---------- Amazon ----------
const AMAZON_DOMAINS: Record<string, string> = { US: "amazon.com", CA: "amazon.ca", GB: "amazon.co.uk", UK: "amazon.co.uk", DE: "amazon.de", FR: "amazon.fr", IT: "amazon.it", ES: "amazon.es", AU: "amazon.com.au", MX: "amazon.com.mx", IN: "amazon.in" };
export const amazonCurrency = (domain: string) =>
  domain.endsWith(".ca") ? "CAD" : domain.endsWith(".co.uk") ? "GBP" : /\.(de|fr|it|es|nl)$/.test(domain) ? "EUR" : domain.endsWith(".com.au") ? "AUD" : domain.endsWith(".com.mx") ? "MXN" : domain.endsWith(".in") ? "INR" : "USD";
const delivery = z.object({ text: opt(text), type: opt(text), date: opt(text) });
const AmazonItem = z.object({
  ...required, asin: opt(idish), link: opt(text), brand: opt(text), rating: opt(numberish), reviews: opt(numberish), price: opt(text),
  is_prime: opt(z.boolean()), thumbnail: opt(text), fulfillment: opt(z.object({ standard_delivery: opt(delivery), fastest_delivery: opt(delivery) }))
});
const amazon: SearchApiEngineDefinition<z.infer<typeof AmazonItem>> = {
  engine: "amazon_search", retailerId: "amazon", resultsKey: "organic_results", itemSchema: AmazonItem,
  capabilities: { productSearch: true, currentPrice: true, deliveryEstimate: true, officialApi: true },
  buildParams(input, defaults) {
    const warnings: string[] = [], country = countryOf(input, defaults);
    const domain = AMAZON_DOMAINS[country] ?? "amazon.com";
    if (!AMAZON_DOMAINS[country]) warnings.push(`No Amazon storefront mapped for ${country}; searching amazon.com with delivery to ${country}`);
    return { warnings, domain, currency: amazonCurrency(domain), params: {
      q: input.query, amazon_domain: domain, delivery_country: country, postal_code: input.postalCode?.trim() || undefined, price_max: dollars(input.maxPrice),
      sort_by: sortParam("Amazon", input.sortBy, { relevance: "featured", price_low_to_high: "price_low_to_high", price_high_to_low: "price_high_to_low", rating: "average_review" }, warnings)
    } };
  },
  toOffer(item, context) {
    const estimate = item.fulfillment?.fastest_delivery?.text ?? item.fulfillment?.standard_delivery?.text;
    return baseOffer("amazon", { ...item, id: item.asin }, context, 0.85, { seller: { type: "first_party" },
      fulfillment: { shipping: true, delivery: true, pickup: false, inStore: false, status: "unknown", ...optional("estimate", estimate) } });
  }
};

// ---------- Walmart ----------
const walmartWindow = z.object({ text: opt(text), expected_date: opt(text) });
const WalmartItem = z.object({
  ...required, id: opt(idish), product_id: opt(idish), link: opt(text), seller_name: opt(text), rating: opt(numberish), reviews: opt(numberish), price: opt(text),
  is_free_shipping: opt(z.boolean()), stock: opt(numberish), thumbnail: opt(text), fulfillment: opt(z.object({ pickup: opt(walmartWindow), delivery: opt(walmartWindow) }))
});
const walmart: SearchApiEngineDefinition<z.infer<typeof WalmartItem>> = {
  engine: "walmart_search", retailerId: "walmart", resultsKey: "organic_results", itemSchema: WalmartItem,
  capabilities: { productSearch: true, currentPrice: true, deliveryEstimate: true, officialApi: true, storeInventory: true, pickupEstimate: true },
  buildParams(input, defaults) {
    const warnings = usOnly("Walmart", countryOf(input, defaults));
    return { warnings, domain: "walmart.com", currency: "USD", params: {
      q: input.query, store_id: storeId(input.selectedStoreId), price_max: dollars(input.maxPrice),
      sort_by: sortParam("Walmart", input.sortBy, { relevance: "best_match", price_low_to_high: "price_low_to_high", price_high_to_low: "price_high_to_low" }, warnings)
    } };
  },
  toOffer(item, context) {
    const pickup = Boolean(item.fulfillment?.pickup), deliver = Boolean(item.fulfillment?.delivery);
    const estimate = item.fulfillment?.pickup?.text ?? item.fulfillment?.delivery?.text;
    return baseOffer("walmart", { ...item, id: item.product_id ?? item.id }, context, 0.85, { seller: sellerOf(item.seller_name, "walmart"),
      fulfillment: { shipping: deliver || item.is_free_shipping === true, delivery: deliver, pickup, inStore: false, status: stockPositive(item.stock) ? "in_stock" : "unknown", ...optional("estimate", estimate) } });
  }
};

// ---------- Home Depot ----------
const HomeDepotItem = z.object({
  ...required, product_id: opt(idish), link: opt(text), brand: opt(text), model_number: opt(idish), rating: opt(numberish), reviews: opt(numberish), price: opt(numberish), thumbnail: opt(text),
  fulfillment: opt(z.object({
    pickup: opt(z.object({ store_id: opt(idish), store_name: opt(text), stock: opt(z.number()) })),
    delivery: opt(z.object({ start_date: opt(text), end_date: opt(text), price: opt(numberish), is_free_shipping: opt(z.boolean()), stock: opt(z.number()) }))
  }))
});
const homeDepot: SearchApiEngineDefinition<z.infer<typeof HomeDepotItem>> = {
  engine: "home_depot_search", retailerId: "home_depot", resultsKey: "organic_results", itemSchema: HomeDepotItem,
  capabilities: { productSearch: true, currentPrice: true, deliveryEstimate: true, officialApi: true, storeInventory: true, inventoryQuantity: true, pickupEstimate: true },
  buildParams(input, defaults) {
    const warnings = usOnly("Home Depot", countryOf(input, defaults));
    return { warnings, domain: "homedepot.com", currency: "USD", params: {
      q: input.query, store_id: storeId(input.selectedStoreId), postal_code: zip5(input.postalCode),
      price_max: input.maxPrice === undefined ? undefined : Math.ceil(input.maxPrice), // engine takes whole dollars
      sort_by: sortParam("Home Depot", input.sortBy, { relevance: "best_match", price_low_to_high: "price_low_to_high", price_high_to_low: "price_high_to_low", rating: "customer_rating" }, warnings)
    } };
  },
  toOffer(item, context) {
    const pick = item.fulfillment?.pickup, del = item.fulfillment?.delivery;
    const pickup = (pick?.stock ?? 0) > 0, deliver = Boolean(del);
    const window = del?.start_date ? (del.end_date && del.end_date !== del.start_date ? `Delivery ${del.start_date} to ${del.end_date}` : `Delivery ${del.start_date}`) : undefined;
    const estimate = pickup ? `Pickup${pick?.store_name ? ` at ${pick.store_name}` : ""}` : window;
    return baseOffer("home_depot", { ...item, id: item.product_id }, context, 0.85, { seller: { type: "first_party" },
      fulfillment: {
        shipping: deliver, delivery: deliver, pickup, inStore: pickup, status: pickup || (del?.stock ?? 0) > 0 ? "in_stock" : "unknown",
        ...optional("inventoryQuantity", nonNegInt(pick?.stock)), ...optional("storeId", pick?.store_id), ...optional("storeName", pick?.store_name), ...optional("estimate", estimate)
      } });
  }
};

// ---------- Best Buy ----------
const BestBuyItem = z.object({
  ...required, product_id: opt(idish), link: opt(text), brand: opt(text), model_number: opt(idish), rating: opt(numberish), reviews: opt(numberish), price: opt(text), thumbnail: opt(text),
  seller: opt(z.object({ id: opt(idish), name: opt(text) }))
});
const bestBuy: SearchApiEngineDefinition<z.infer<typeof BestBuyItem>> = {
  engine: "bestbuy_search", retailerId: "best_buy", resultsKey: "organic_results", itemSchema: BestBuyItem,
  capabilities: { productSearch: true, currentPrice: true },
  buildParams(input, defaults) {
    const warnings = usOnly("Best Buy", countryOf(input, defaults));
    return { warnings, domain: "bestbuy.com", currency: "USD", params: {
      q: input.query,
      sort_by: sortParam("Best Buy", input.sortBy, { relevance: "best_match", price_low_to_high: "price_low_to_high", price_high_to_low: "price_high_to_low", rating: "customer_rating" }, warnings)
    } };
  },
  toOffer(item, context) {
    return baseOffer("best_buy", { ...item, id: item.product_id }, context, 0.85, { seller: sellerOf(item.seller?.name, "best_buy"),
      fulfillment: { shipping: true, delivery: false, pickup: false, inStore: false, status: "unknown" } });
  }
};

// ---------- Google Shopping ----------
const COUNTRY_CURRENCY: Record<string, string> = { US: "USD", CA: "CAD", GB: "GBP", UK: "GBP", AU: "AUD", DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", IE: "EUR", MX: "MXN", IN: "INR" };
const GoogleItem = z.object({
  ...required, product_id: opt(idish), product_link: opt(text), seller: opt(text), rating: opt(numberish), reviews: opt(numberish), price: opt(text), delivery: opt(text), thumbnail: opt(text)
});
const googleShopping: SearchApiEngineDefinition<z.infer<typeof GoogleItem>> = {
  engine: "google_shopping", retailerId: "google_shopping", resultsKey: "shopping_results", itemSchema: GoogleItem,
  capabilities: { productSearch: true, currentPrice: true },
  buildParams(input, defaults) {
    const warnings: string[] = [], country = countryOf(input, defaults);
    const currency = country === defaults.country.toUpperCase() ? defaults.currency : COUNTRY_CURRENCY[country] ?? defaults.currency;
    return { warnings, domain: KNOWN_RETAILERS.google_shopping?.domain ?? "shopping.google.com", currency, params: {
      q: input.query, gl: country.toLowerCase(), price_max: dollars(input.maxPrice),
      sort_by: sortParam("Google Shopping", input.sortBy, { price_low_to_high: "price_low_to_high", price_high_to_low: "price_high_to_low", rating: "rating_high_to_low" }, warnings)
    } };
  },
  toOffer(item, context) {
    const deliveryText = item.delivery?.trim() || undefined;
    return baseOffer("google_shopping", { ...item, id: item.product_id }, context, 0.75, { url: item.product_link, warnings: ["Link opens a Google Shopping page"],
      seller: sellerOf(item.seller, "google_shopping"),
      fulfillment: { shipping: false, delivery: Boolean(deliveryText), pickup: false, inStore: false, status: "unknown", ...optional("estimate", deliveryText) } });
  }
};

export const SEARCHAPI_ENGINES: Record<string, SearchApiEngineDefinition> = Object.fromEntries([amazon, walmart, homeDepot, bestBuy, googleShopping].map(d => [d.engine, d]));
