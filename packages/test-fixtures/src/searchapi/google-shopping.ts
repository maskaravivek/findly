// Hand-written from the field reference in docs/plans/searchapi-engines.md (no API key was available to record a live
// response). Replace with a recorded, key-stripped response when one is captured. Item 3 deliberately lacks a price.
export const googleShoppingCordlessDrill = {
  search_metadata: { id: "search_gsh_01JCDRILLB6F", status: "Success", created_at: "2026-11-12T15:04:29Z", request_time_taken: 2.12, parsing_time_taken: 0.11, total_time_taken: 2.23, request_url: "https://www.google.com/search?q=cordless+drill&tbm=shop&gl=us", html_url: "https://www.searchapi.io/api/v1/searches/search_gsh_01JCDRILLB6F.html", json_url: "https://www.searchapi.io/api/v1/searches/search_gsh_01JCDRILLB6F" },
  search_parameters: { engine: "google_shopping", q: "cordless drill", gl: "us", hl: "en" },
  shopping_results: [
    {
      position: 1, product_id: "14019378181107046593", title: "DeWalt 20V Max Cordless Compact Drill/Driver Kit DCD771C2",
      product_link: "https://www.google.com/shopping/product/14019378181107046593?gl=us", seller: "The Home Depot", price: "$99.00", extracted_price: 99,
      original_price: "$169.00", extracted_original_price: 169, rating: 4.7, reviews: 68412, delivery: "Free delivery by Sat, Nov 15", durability: "Durable",
      thumbnail: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcR_dewalt_dcd771c2", product_token: "eyJlaSI6IkRyaWxsMDEifQ", offers: "& more", extracted_offers: 24
    },
    {
      position: 2, product_id: "8829173351064425170", title: "Ryobi ONE+ 18V Cordless 1/2 in. Drill/Driver Kit PCL206K1",
      product_link: "https://www.google.com/shopping/product/8829173351064425170?gl=us", seller: "eBay - toolsplus_outlet", price: "$54.99", extracted_price: 54.99,
      rating: "4.6", reviews: "4.2K", thumbnail: "https://encrypted-tbn0.gstatic.com/shopping?q=tbn:ANd9GcS_ryobi_pcl206k1", product_token: "eyJlaSI6IkRyaWxsMDIifQ"
    },
    {
      position: 3, product_id: "3360917458251193846", title: "Makita XFD131 18V LXT Brushless Cordless 1/2\" Driver-Drill Kit",
      product_link: "https://www.google.com/shopping/product/3360917458251193846?gl=us", seller: "Acme Tools", price: "See price in store", rating: 4.8, reviews: 1508
    }
  ],
  pagination: { current: 1, next: "https://www.google.com/search?q=cordless+drill&tbm=shop&gl=us&start=60" }
};
