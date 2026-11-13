// Live SearchAPI response for q="cordless drill", recorded and key-stripped by apps/api/scripts/record-searchapi-fixtures.ts
// (see recorded/amazon_search.json). One deliberately malformed item (no extracted_price) is appended to exercise skip-and-warn.
import { amazonSearchRecorded } from "./recorded/amazon_search.js";

export const amazonSearchCordlessDrill = {
  ...amazonSearchRecorded,
  organic_results: [...amazonSearchRecorded.organic_results, { position: 7, asin: "B0MALFORMED", title: "Malformed fixture item (no extracted_price)", link: "https://www.amazon.com/dp/B0MALFORMED", price: "See options" }]
};
