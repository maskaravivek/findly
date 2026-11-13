import { amazonSearchCordlessDrill } from "./searchapi/amazon.js";
import { walmartSearchCordlessDrill } from "./searchapi/walmart.js";
import { homeDepotSearchCordlessDrill } from "./searchapi/home-depot.js";
import { bestBuySearchCordlessDrill } from "./searchapi/bestbuy.js";
import { googleShoppingCordlessDrill } from "./searchapi/google-shopping.js";
/** Recorded live SearchAPI responses for a "cordless drill" query (plus one malformed item each), keyed by engine name. */
export const searchApiFixtures = {
  amazon_search: amazonSearchCordlessDrill, walmart_search: walmartSearchCordlessDrill, home_depot_search: homeDepotSearchCordlessDrill,
  bestbuy_search: bestBuySearchCordlessDrill, google_shopping: googleShoppingCordlessDrill
} as const;
