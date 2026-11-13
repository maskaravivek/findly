// Hand-written from the field reference in docs/plans/searchapi-engines.md (no API key was available to record a live
// response). Replace with a recorded, key-stripped response when one is captured. Item 3 deliberately lacks a price.
export const walmartSearchCordlessDrill = {
  search_metadata: { id: "search_wmt_01JCDRILL8K4", status: "Success", created_at: "2026-11-12T15:04:23Z", request_time_taken: 2.41, parsing_time_taken: 0.06, total_time_taken: 2.47, request_url: "https://www.walmart.com/search?q=cordless+drill", html_url: "https://www.searchapi.io/api/v1/searches/search_wmt_01JCDRILL8K4.html", json_url: "https://www.searchapi.io/api/v1/searches/search_wmt_01JCDRILL8K4" },
  search_parameters: { engine: "walmart_search", q: "cordless drill" },
  search_information: { total_results: 2316 },
  organic_results: [
    {
      position: 1, id: "5RD5NLW3XTZ1", product_id: "837417451", title: "Hyper Tough 20V Max Cordless Drill, 3/8 inch Chuck, with 1.5Ah Battery and Charger",
      description: "Variable speed trigger, 15+1 clutch settings", link: "https://www.walmart.com/ip/Hyper-Tough-20V-Max-Cordless-Drill/837417451",
      seller_id: "F55CDC31AB754BB68FE0B39041159D63", seller_name: "Walmart.com", rating: 4.4, reviews: 9871, price: "$29.88", extracted_price: 29.88,
      fulfillment: { pickup: { text: "Pickup today", expected_date: "2026-11-12" }, delivery: { text: "Delivery as soon as 3pm today", expected_date: "2026-11-12" } },
      is_free_shipping: true, is_sponsored: false, stock: "In stock", thumbnail: "https://i5.walmartimages.com/seo/Hyper-Tough-20V-Drill_837417451.jpeg",
      badges: [{ key: "BESTSELLER", text: "Best seller", group_name: "product_badges" }]
    },
    {
      position: 2, id: "2KQ8W6BVA1N0", product_id: "1484912630", title: "DEWALT 20V MAX Cordless Drill/Driver Kit, DCD771C2",
      link: "https://www.walmart.com/ip/DEWALT-20V-MAX-Cordless-Drill-Driver-Kit-DCD771C2/1484912630", seller_id: "A9B1E2C34D5F", seller_name: "ToolsDirect Outlet",
      rating: "4.7", reviews: "2,140", price: "$109.00", extracted_price: 109,
      fulfillment: { delivery: { text: "Free shipping, arrives in 3+ days", expected_date: "2026-11-15" } },
      is_free_shipping: true, is_sponsored: true, thumbnail: "https://i5.walmartimages.com/seo/DEWALT-DCD771C2_1484912630.jpeg"
    },
    {
      position: 3, id: "7YH3PQ2LMC90", product_id: "302281847", title: "Bauer 20V Brushless 1/2 in. Drill Driver Kit",
      link: "https://www.walmart.com/ip/Bauer-20V-Brushless-Drill/302281847", seller_name: "Walmart.com", rating: 4.2, reviews: 311,
      price_range: { text: "Options from $59.00 – $89.00", from: "$59.00", extracted_from_price: 59 }, stock: "Out of stock"
    }
  ],
  pagination: { current: 1, next: "https://www.walmart.com/search?q=cordless+drill&page=2" }
};
