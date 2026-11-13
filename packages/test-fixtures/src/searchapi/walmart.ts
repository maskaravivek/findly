// Live SearchAPI response for q="cordless drill", recorded and key-stripped by apps/api/scripts/record-searchapi-fixtures.ts
// (see recorded/walmart_search.json). One deliberately malformed item (no extracted_price) is appended to exercise skip-and-warn.
import { walmartSearchRecorded } from "./recorded/walmart_search.js";

export const walmartSearchCordlessDrill = {
  ...walmartSearchRecorded,
  organic_results: [...walmartSearchRecorded.organic_results, { position: 7, id: "999000001", product_id: "MALFORMED01", title: "Malformed fixture item (no extracted_price)", link: "https://www.walmart.com/ip/malformed/999000001", price_range: { text: "Options from $59.00", from: "$59.00", extracted_from_price: 59 } }]
};
