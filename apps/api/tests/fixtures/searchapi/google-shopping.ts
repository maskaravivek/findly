// Live SearchAPI response for q="cordless drill", recorded and key-stripped by apps/api/scripts/record-searchapi-fixtures.ts
// (see recorded/google_shopping.json). One deliberately malformed item (no extracted_price) is appended to exercise skip-and-warn.
import { googleShoppingRecorded } from "./recorded/google_shopping.js";

export const googleShoppingCordlessDrill = {
  ...googleShoppingRecorded,
  shopping_results: [...googleShoppingRecorded.shopping_results, { position: 7, prds: "999000004", title: "Malformed fixture item (no extracted_price)", product_link: "https://www.google.com/search?ibp=oshop&prds=999000004", price: "See price in store" }]
};
