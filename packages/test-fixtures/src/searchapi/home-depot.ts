// Live SearchAPI response for q="cordless drill", recorded and key-stripped by apps/api/scripts/record-searchapi-fixtures.ts
// (see recorded/home_depot_search.json). One deliberately malformed item (no extracted_price) is appended to exercise skip-and-warn.
import { homeDepotSearchRecorded } from "./recorded/home_depot_search.js";

export const homeDepotSearchCordlessDrill = {
  ...homeDepotSearchRecorded,
  organic_results: [...homeDepotSearchRecorded.organic_results, { position: 7, product_id: "999000002", title: "Malformed fixture item (no extracted_price)", link: "https://www.homedepot.com/p/malformed/999000002", price: "See price in cart" }]
};
