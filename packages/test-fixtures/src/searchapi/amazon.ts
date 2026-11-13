// Hand-written from the field reference in docs/plans/searchapi-engines.md (no API key was available to record a live
// response). Replace with a recorded, key-stripped response when one is captured. Item 3 deliberately lacks a price.
export const amazonSearchCordlessDrill = {
  search_metadata: { id: "search_amz_01JCDRILL7Q2", status: "Success", created_at: "2026-11-12T15:04:21Z", request_time_taken: 1.92, parsing_time_taken: 0.04, total_time_taken: 1.96, request_url: "https://www.amazon.com/s?k=cordless+drill", html_url: "https://www.searchapi.io/api/v1/searches/search_amz_01JCDRILL7Q2.html", json_url: "https://www.searchapi.io/api/v1/searches/search_amz_01JCDRILL7Q2" },
  search_parameters: { engine: "amazon_search", q: "cordless drill", amazon_domain: "amazon.com", delivery_country: "US" },
  search_information: { total_results: 10000, page: 1 },
  organic_results: [
    {
      position: 1, asin: "B00ET5VMTU", title: "DEWALT 20V Max Cordless Drill/Driver Kit, Compact, 1/2-Inch (DCD771C2)", link: "https://www.amazon.com/dp/B00ET5VMTU",
      brand: "DEWALT", rating: 4.7, reviews: 52813, price: ".00", extracted_price: 99, original_price: ".00", extracted_original_price: 169, is_prime: true,
      thumbnail: "https://m.media-amazon.com/images/I/71Yc+1M5JcL._AC_UL320_.jpg",
      fulfillment: { standard_delivery: { text: "FREE delivery Mon, Nov 17", type: "free_delivery", date: "2026-11-17" }, fastest_delivery: { text: "Or fastest delivery Tomorrow, Nov 13", type: "fastest_delivery", date: "2026-11-13" } },
      more_offers: { lowest_price: ".50", extracted_lowest_price: 84.5, offers_count: 12 }
    },
    {
      position: 2, asin: "B0CKT1L6X5", title: "BLACK+DECKER 20V MAX Cordless Drill and Driver, 3/8 Inch, with LED Work Light (LDX120C)", link: "https://www.amazon.com/dp/B0CKT1L6X5",
      brand: "BLACK+DECKER", rating: "4.5 out of 5 stars", reviews: "(18.2K)", price: ".98", extracted_price: 39.98, is_prime: false,
      thumbnail: "https://m.media-amazon.com/images/I/61J3qPZqXUL._AC_UL320_.jpg",
      fulfillment: { standard_delivery: { text: "FREE delivery Thu, Nov 20 on $35 of items", type: "free_delivery", date: "2026-11-20" } }
    },
    {
      position: 3, asin: "B07Q2Z3X1M", title: "Milwaukee M18 FUEL 1/2 in. Drill Driver (Tool Only) 2803-20", link: "https://www.amazon.com/dp/B07Q2Z3X1M",
      brand: "Milwaukee", rating: 4.8, reviews: 3104, thumbnail: "https://m.media-amazon.com/images/I/61tJ2r6l2dL._AC_UL320_.jpg",
      more_offers: { offers_count: 4 }
    }
  ],
  pagination: { current: 1, next: "https://www.amazon.com/s?k=cordless+drill&page=2" }
};
