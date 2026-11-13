import { amazonSearchCordlessDrill } from "./amazon.js";
import { walmartSearchCordlessDrill } from "./walmart.js";
import { homeDepotSearchCordlessDrill } from "./home-depot.js";
import { bestBuySearchCordlessDrill } from "./bestbuy.js";
import { googleShoppingCordlessDrill } from "./google-shopping.js";
/** Recorded live SearchAPI responses for a "cordless drill" query (plus one malformed item each), keyed by engine name. */
export const searchApiFixtures = {
  amazon_search: amazonSearchCordlessDrill, walmart_search: walmartSearchCordlessDrill, home_depot_search: homeDepotSearchCordlessDrill,
  bestbuy_search: bestBuySearchCordlessDrill, google_shopping: googleShoppingCordlessDrill
} as const;
