# SearchAPI engine reference (from docs, 2026-11-12; not verified against live calls)

Endpoint: `GET https://www.searchapi.io/api/v1/search?engine=<engine>&q=...`
Auth: `Authorization: Bearer <SEARCHAPI_API_KEY>` (or `api_key` query param). Top-level keys always include `search_metadata` (id, status, created_at), `search_parameters`, `pagination`.

| engine | required | useful optional params | results array | per-item keys we read |
|---|---|---|---|---|
| `amazon_search` | q | amazon_domain (default amazon.com), delivery_country (ISO2), postal_code, currency, sort_by (featured, price_low_to_high, price_high_to_low, average_review, newest_arrivals, bestsellers), price_min, price_max, page | `organic_results` | position, asin, title, link, brand, rating, reviews, price, extracted_price, original_price, extracted_original_price, is_prime, thumbnail, fulfillment.standard_delivery{text,type,date}, fulfillment.fastest_delivery{text,type,date}, more_offers{lowest_price, extracted_lowest_price, offers_count} |
| `amazon_product` | asin | amazon_domain, delivery_country, postal_code, currency | (single product object) | title, brand, price fields, rating, reviews, link |
| `walmart_search` | q | store_id, price_min, price_max, sort_by (best_match, price_low_to_high, price_high_to_low, best_seller), page (≤10) | `organic_results` | position, id, product_id, title, description, link, seller_id, seller_name, rating, reviews, price, extracted_price, unit_price, price_range{text,from,extracted_from_price}, fulfillment.pickup{text,expected_date}, fulfillment.delivery{text,expected_date}, is_free_shipping, is_sponsored, stock, thumbnail, badges[{key,text,group_name}] |
| `walmart_product` | product_id | store_id | (single product) | |
| `home_depot_search` | q or category_id | store_id (3–4 digit, needed for pickup), postal_code (5-digit US ZIP, for delivery), price_min, price_max (whole dollars), sort_by (best_match, best_selling, most_popular, customer_rating, price_low_to_high, price_high_to_low, new_arrivals), page (≤31, 24/page) | `organic_results` | position, product_id, parent_product_id, title, link, brand, model_number, sku, rating, reviews, price, extracted_price, unit_of_measure, badges[string], thumbnail, fulfillment.pickup{store_id,store_name,stock}, fulfillment.delivery{start_date,end_date,price,is_free_shipping,stock}, fulfillment.express_delivery{store_id,start_date,end_date,price} |
| `bestbuy_search` | q | category_id, filters, sort_by (best_match, best_selling, best_discount, price_low_to_high, price_high_to_low, customer_rating, new_arrivals), page | `organic_results` | position, product_id, title, short_title, link, brand, model_number, condition, rating, reviews, seller{id,name}, is_sponsored, price, extracted_price, original_price, extracted_original_price, discount, thumbnail, badges[string] (no fulfillment/stock fields) |
| `google_shopping` | q, gl (default us) | hl, location, price_min, price_max, sort_by (price_low_to_high, price_high_to_low, rating_high_to_low), condition (new/used), is_free_delivery, is_on_sale, page | `shopping_results` (also `shopping_ads`, `popular_products`) | position, product_id, title, product_link (Google page, not merchant), seller, price, extracted_price, original_price, extracted_original_price, rating, reviews, delivery (text), durability, thumbnail, product_token, offers, extracted_offers |

Notes
- Walmart / Home Depot / Best Buy engines are US stores. Amazon localises via `amazon_domain` + `delivery_country`; Google Shopping via `gl`/`hl`/`location`.
- `extracted_price` is a number in the marketplace currency; `price` is display text. Prefer `extracted_price`.
- Google Shopping items have no merchant URL; `product_link` opens a Google product page. Use `seller` for the merchant name.
- Errors: 400 (bad params), 401 (auth), 429 (rate limit), 503 "Timeout".
