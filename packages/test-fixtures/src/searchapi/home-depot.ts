// Hand-written from the field reference in docs/plans/searchapi-engines.md (no API key was available to record a live
// response). Replace with a recorded, key-stripped response when one is captured. Item 3 deliberately lacks a price.
export const homeDepotSearchCordlessDrill = {
  search_metadata: { id: "search_thd_01JCDRILL9P1", status: "Success", created_at: "2026-11-12T15:04:25Z", request_time_taken: 2.88, parsing_time_taken: 0.07, total_time_taken: 2.95, request_url: "https://www.homedepot.com/s/cordless%20drill", html_url: "https://www.searchapi.io/api/v1/searches/search_thd_01JCDRILL9P1.html", json_url: "https://www.searchapi.io/api/v1/searches/search_thd_01JCDRILL9P1" },
  search_parameters: { engine: "home_depot_search", q: "cordless drill", store_id: "6907", postal_code: "10001" },
  search_information: { total_results: 1184 },
  organic_results: [
    {
      position: 1, product_id: "204279858", parent_product_id: "204279858", title: "20V MAX Cordless 1/2 in. Drill/Driver, (2) 20V 1.3Ah Batteries, Charger and Bag",
      link: "https://www.homedepot.com/p/DEWALT-20V-MAX-Cordless-1-2-in-Drill-Driver-DCD771C2/204279858", brand: "DEWALT", model_number: "DCD771C2", sku: "1001426042",
      rating: 4.7, reviews: 11458, price: 99, extracted_price: 99, unit_of_measure: "each", badges: ["Best Seller"],
      thumbnail: "https://images.thdstatic.com/productImages/2bd0e5c5/svn/dewalt-power-drills-dcd771c2-64_300.jpg",
      fulfillment: {
        pickup: { store_id: "6907", store_name: "Manhattan 23rd St", stock: 37 },
        delivery: { start_date: "2026-11-14", end_date: "2026-11-15", price: 0, is_free_shipping: true, stock: 1250 },
        express_delivery: { store_id: "6907", start_date: "2026-11-12", end_date: "2026-11-12", price: 9.99 }
      }
    },
    {
      position: 2, product_id: "318083167", title: "ONE+ 18V Cordless 1/2 in. Drill/Driver Kit with (1) 1.5 Ah Battery and Charger",
      link: "https://www.homedepot.com/p/RYOBI-ONE-18V-Cordless-1-2-in-Drill-Driver-Kit-PCL206K1/318083167", brand: "RYOBI", model_number: "PCL206K1", sku: "1007152335",
      rating: "4.6", reviews: "3,902", price: 59.97, extracted_price: 59.97, thumbnail: "https://images.thdstatic.com/productImages/ryobi-pcl206k1-64_300.jpg",
      fulfillment: { pickup: { store_id: "6907", store_name: "Manhattan 23rd St", stock: 0 }, delivery: { start_date: "2026-11-17", end_date: "2026-11-19", is_free_shipping: true, stock: 0 } }
    },
    {
      position: 3, product_id: "325471982", title: "M18 FUEL 18V Lithium-Ion Brushless Cordless 1/2 in. Hammer Drill (Tool-Only)",
      link: "https://www.homedepot.com/p/Milwaukee-M18-FUEL-Hammer-Drill-2904-20/325471982", brand: "Milwaukee", model_number: "2904-20", rating: 4.8, reviews: 2210,
      thumbnail: "not-a-url", fulfillment: { pickup: { store_id: "6907", store_name: "Manhattan 23rd St", stock: 4 } }
    }
  ],
  pagination: { current: 1, next: "https://www.homedepot.com/s/cordless%20drill?Nao=24" }
};
