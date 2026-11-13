// Live SearchAPI response for q="cordless drill", recorded and key-stripped by apps/api/scripts/record-searchapi-fixtures.ts
// (see recorded/bestbuy_search.json). One deliberately malformed item (no extracted_price) is appended to exercise skip-and-warn.
import { bestbuySearchRecorded } from "./recorded/bestbuy_search.js";

export const bestBuySearchCordlessDrill = {
  ...bestbuySearchRecorded,
  organic_results: [...bestbuySearchRecorded.organic_results, { position: 7, product_id: "999000003", title: "Malformed fixture item (no extracted_price)", link: "https://www.bestbuy.com/product/malformed/sku/999000003", price: "Sold Out" }]
};
