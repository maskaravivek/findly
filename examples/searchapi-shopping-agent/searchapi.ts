// One function over SearchAPI's shopping engines: same endpoint, `engine=` picks the store,
// and every engine's items are read with one shared schema into one Offer type.
import { z } from "zod";

export type Offer = {
  id: string; retailer: string; title: string; price: number; currency: string; url: string;
  rating?: number | undefined; reviews?: number | undefined; seller?: string | undefined; thumbnail?: string | undefined;
  delivery?: string | undefined; pickup?: boolean | undefined;
};
export type SearchOptions = { maxPrice?: number | undefined; sortBy?: "price_low_to_high" | "rating" | undefined; country?: string | undefined };

type EngineInfo = { retailer: string; resultsKey: string; idKeys: Array<"asin" | "id" | "product_id" | "prds">; sort: { price_low_to_high: string; rating?: string } };
export type Engine = "amazon_search" | "walmart_search" | "home_depot_search" | "bestbuy_search" | "google_shopping";
export const ENGINES: Record<Engine, EngineInfo> = {
  amazon_search:     { retailer: "amazon",          resultsKey: "organic_results",  idKeys: ["asin"], sort: { price_low_to_high: "price_low_to_high", rating: "average_review" } },
  walmart_search:    { retailer: "walmart",         resultsKey: "organic_results",  idKeys: ["id", "product_id"], sort: { price_low_to_high: "price_low_to_high" } }, // `id` is the numeric /ip/<id> item id
  home_depot_search: { retailer: "home_depot",      resultsKey: "organic_results",  idKeys: ["product_id"], sort: { price_low_to_high: "price_low_to_high", rating: "customer_rating" } },
  bestbuy_search:    { retailer: "best_buy",        resultsKey: "organic_results",  idKeys: ["product_id"], sort: { price_low_to_high: "price_low_to_high", rating: "customer_rating" } },
  google_shopping:   { retailer: "google_shopping", resultsKey: "shopping_results", idKeys: ["product_id", "prds"], sort: { price_low_to_high: "price_low_to_high", rating: "rating_high_to_low" } }, // live results carry only `prds`
};
// Amazon and Google Shopping localise by country; the other three are US stores priced in USD.
const COUNTRIES: Record<string, { amazon: string; currency: string }> = {
  US: { amazon: "amazon.com", currency: "USD" }, GB: { amazon: "amazon.co.uk", currency: "GBP" },
  CA: { amazon: "amazon.ca", currency: "CAD" }, DE: { amazon: "amazon.de", currency: "EUR" },
};

// Every field is optional and a wrong type degrades to undefined, so one odd item never fails a whole search.
const opt = <S extends z.ZodType>(s: S) => s.optional().catch(undefined);
const numberish = opt(z.union([z.number(), z.string()]));
const window = opt(z.object({ text: opt(z.string()), type: opt(z.string()), expected_date: opt(z.string()), start_date: opt(z.string()), stock: opt(z.number()) }));
const Item = z.object({
  asin: opt(z.string()), id: opt(z.union([z.string(), z.number()]).transform(String)),
  product_id: opt(z.union([z.string(), z.number()]).transform(String)), prds: opt(z.union([z.string(), z.number()]).transform(String)),
  title: opt(z.string()), link: opt(z.string()), product_link: opt(z.string()),
  // `price` is display text ("$129.00", "From $99"); `extracted_price` is the parsed number, so we never parse currency strings.
  extracted_price: opt(z.number().positive()),
  rating: numberish, reviews: numberish, thumbnail: opt(z.string()),
  seller: opt(z.union([z.string(), z.object({ name: opt(z.string()) })])), seller_name: opt(z.string()), brand: opt(z.string()),
  fulfillment: opt(z.object({ standard_delivery: window, fastest_delivery: window, delivery: window, pickup: window })),
  delivery: opt(z.string()),
});
// Amazon delivery lines read "Or Non-members get FREE delivery Tue, Nov 17"; keep just "Delivery Tue, Nov 17".
const cleanDelivery = (text?: string) => {
  const t = text?.replace(/^(Or\s+)?(Non-members get\s+|Join Prime to get\s+)?(FREE\s+)?/i, "").trim();
  return t ? (t[0]!.toUpperCase() + t.slice(1)).slice(0, 60) : undefined;
};
const toNumber = (v: string | number | undefined) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return v !== undefined && Number.isFinite(n) && n > 0 ? n : undefined; };

const cache = new Map<string, { expiresAt: number; offers: Offer[] }>();
const CACHE_TTL_MS = 10 * 60_000; // prices move slowly; repeat queries within 10 minutes cost no credits

export async function searchProducts(engine: Engine, query: string, opts: SearchOptions = {}): Promise<Offer[]> {
  const info = ENGINES[engine], country = (opts.country ?? "US").toUpperCase(), local = COUNTRIES[country] ?? COUNTRIES.US!;
  const params = new URLSearchParams({ engine, q: query });
  if (engine === "amazon_search") { params.set("amazon_domain", local.amazon); params.set("delivery_country", country); }
  if (engine === "google_shopping") params.set("gl", country.toLowerCase());
  if (opts.maxPrice && engine !== "bestbuy_search") params.set("price_max", String(Math.ceil(opts.maxPrice))); // Home Depot wants whole dollars
  const sort = opts.sortBy && info.sort[opts.sortBy];
  if (sort) params.set("sort_by", sort);

  const key = params.toString(), hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.offers;
  const res = await fetch(`https://www.searchapi.io/api/v1/search?${key}`, { headers: { Authorization: `Bearer ${process.env.SEARCHAPI_API_KEY}` } });
  if (!res.ok) throw new Error(`SearchAPI ${engine} failed with HTTP ${res.status}`); // never echo the body: it can include the request
  const body = (await res.json()) as Record<string, unknown>;
  const raw = Array.isArray(body[info.resultsKey]) ? (body[info.resultsKey] as unknown[]) : [];
  const currency = engine === "amazon_search" || engine === "google_shopping" ? local.currency : "USD";

  const offers = raw.flatMap((r): Offer[] => {
    const item = Item.safeParse(r).data, id = item && info.idKeys.map(k => item[k]).find(Boolean), url = item?.link ?? item?.product_link;
    if (!item?.title || !item.extracted_price || !id || !url) return []; // unpriced or unlinkable items are useless to a shopper
    const f = item.fulfillment, seller = typeof item.seller === "string" ? item.seller : item.seller?.name;
    // Amazon's standard_delivery is often the "Join Prime to get..." offer; then the non-member line applies.
    const std = f?.standard_delivery?.text, amazon = std && !/join prime/i.test(std) ? std : f?.fastest_delivery?.text ?? std;
    return [{
      id: `${info.retailer}:${id}`, retailer: info.retailer, title: item.title, price: item.extracted_price, currency, url,
      rating: toNumber(item.rating), reviews: toNumber(item.reviews), thumbnail: item.thumbnail, seller: seller ?? item.seller_name ?? item.brand,
      // Walmart's fulfillment text is only a label ("DELIVERY"); its date is expected_date. Home Depot uses start_date.
      delivery: item.delivery ?? cleanDelivery(amazon) ?? f?.delivery?.expected_date ?? f?.delivery?.start_date,
      pickup: f?.pickup ? (f.pickup.stock ?? 1) > 0 : undefined,
    }];
  });
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, offers });
  return offers;
}
