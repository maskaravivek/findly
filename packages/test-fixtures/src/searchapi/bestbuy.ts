// Hand-written from the field reference in docs/plans/searchapi-engines.md (no API key was available to record a live
// response). Replace with a recorded, key-stripped response when one is captured. Item 3 deliberately lacks a price.
export const bestBuySearchCordlessDrill = {
  search_metadata: { id: "search_bby_01JCDRILLA2C", status: "Success", created_at: "2026-11-12T15:04:27Z", request_time_taken: 1.71, parsing_time_taken: 0.03, total_time_taken: 1.74, request_url: "https://www.bestbuy.com/site/searchpage.jsp?st=cordless+drill", html_url: "https://www.searchapi.io/api/v1/searches/search_bby_01JCDRILLA2C.html", json_url: "https://www.searchapi.io/api/v1/searches/search_bby_01JCDRILLA2C" },
  search_parameters: { engine: "bestbuy_search", q: "cordless drill" },
  search_information: { total_results: 214 },
  organic_results: [
    {
      position: 1, product_id: "6418036", title: "DEWALT - 20V MAX Compact 1/2\" Cordless Drill/Driver Kit with 2 Batteries - Yellow/Black", short_title: "DEWALT 20V MAX Compact Drill/Driver Kit",
      link: "https://www.bestbuy.com/site/dewalt-20v-max-compact-drill-driver-kit/6418036.p?skuId=6418036", brand: "DEWALT", model_number: "DCD771C2", condition: "New",
      rating: 4.8, reviews: 1873, seller: { id: "bestbuy", name: "Best Buy" }, is_sponsored: false, price: "$99.99", extracted_price: 99.99,
      original_price: "$159.00", extracted_original_price: 159, discount: "Save $59.01", thumbnail: "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6418/6418036_sd.jpg", badges: ["Deal"]
    },
    {
      position: 2, product_id: "6531122", title: "SKIL - PWR CORE 12 Brushless 12V 1/4\" Hex Cordless Drill Kit", link: "https://www.bestbuy.com/site/skil-pwr-core-12-drill-kit/6531122.p?skuId=6531122",
      brand: "SKIL", model_number: "DL529002", condition: "New", rating: "4.4", reviews: "268", seller: { id: "mkp-23019", name: "ToolNation" }, is_sponsored: true,
      price: "$74.99", extracted_price: 74.99, thumbnail: "https://pisces.bbystatic.com/image2/BestBuy_US/images/products/6531/6531122_sd.jpg"
    },
    {
      position: 3, product_id: "6502981", title: "Bosch - 12V Max 3/8\" Drill/Driver Kit", link: "https://www.bestbuy.com/site/bosch-12v-drill-driver-kit/6502981.p?skuId=6502981",
      brand: "Bosch", model_number: "PS31-2A", rating: 4.6, reviews: 412, price: "Sold Out", seller: { name: "Best Buy" }
    }
  ],
  pagination: { current: 1, next: "https://www.bestbuy.com/site/searchpage.jsp?st=cordless+drill&cp=2" }
};
