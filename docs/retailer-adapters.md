# Retailer adapters

Every retailer declares capabilities separately from its methods. The UI must check these flags before showing stock quantity, pickup estimates, or aisle/bay location.

## SearchAPI adapters

SearchAPI is the only retailer source. The API builds one `SearchApiRetailerAdapter` per engine listed in `SEARCHAPI_ENGINES` (`apps/api/src/retailers/searchapi/`). Unknown engine names are logged and skipped.

- `client.ts`: `SearchApiClient` calls `GET https://www.searchapi.io/api/v1/search?engine=...` with `Authorization: Bearer`, a per-request timeout (`SEARCHAPI_TIMEOUT_MS`), one retry on network errors, 429 and 5xx (honouring `Retry-After`, capped at 5 s; timeouts are not retried), and an in-memory TTL cache keyed on engine plus sorted params (`SEARCHAPI_CACHE_TTL_MS`, `0` disables it). Error messages never contain the key or upstream body.
- `engines.ts`: one `SearchApiEngineDefinition` per engine: Zod item schema for the fields we read, `buildParams` (query, location, price ceiling, sort), and `toOffer` mapping into `NormalizedRetailOffer`.
- `adapter.ts`: runs the engine, stamps `observedAt` from `search_metadata.created_at`, validates every offer against `NormalizedRetailOfferSchema`, skips malformed or priceless items with a warning, and returns at most `maxResults`.

Offers use `source.kind = "search_api"` and `liveVerified = true`, and ids of the form `<retailerId>:<engine item id>`.

| Engine | Retailer id | Coverage | Location params | Sort | Fulfillment we map |
|---|---|---|---|---|---|
| `amazon_search` | `amazon` | Storefront chosen by country (US, CA, GB, DE, FR, IT, ES, AU, MX, IN; else amazon.com) | `amazon_domain`, `delivery_country`, `postal_code` | relevance, price both ways, rating | Delivery estimate text |
| `walmart_search` | `walmart` | US only | `store_id` | relevance, price both ways | Pickup/delivery windows, in-stock flag, marketplace seller |
| `home_depot_search` | `home_depot` | US only | `store_id`, 5-digit ZIP | relevance, price both ways, rating | Pickup store, stock quantity, delivery window |
| `bestbuy_search` | `best_buy` | US only | none | relevance, price both ways, rating | None (shipping assumed, status unknown) |
| `google_shopping` | `google_shopping` | Any country via `gl` | `gl` | price both ways, rating | Delivery text; link opens a Google page, `seller` names the merchant |

Not supported: product-detail and store-inventory lookups (`getProductDetails`, `getStoreInventory` throw), aisle/bay location, cart deep links, and Google Shopping merchant URLs. Unsupported sort orders fall back to the engine default with a warning.

### Currency

`extracted_price` is converted to integer minor units in the marketplace currency, never converted between currencies:

- Amazon: from the storefront domain (`.ca` CAD, `.co.uk` GBP, EU domains EUR, `.com.au` AUD, `.com.mx` MXN, `.in` INR, else USD).
- Walmart, Home Depot, Best Buy: always USD. A non-US country adds the warning that results are US listings priced in USD.
- Google Shopping: `DEFAULT_CURRENCY` when the country is `DEFAULT_COUNTRY`, otherwise a small country-to-currency map, else `DEFAULT_CURRENCY`.

Price ceilings are passed in major units (Home Depot rounds up to whole dollars).

### Adding an engine

1. Confirm the engine slug, params, and result keys in SearchAPI's docs and record them in `docs/plans/searchapi-engines.md`.
2. Add the retailer id and display name to `KNOWN_RETAILERS` in `packages/contracts`.
3. Add a `SearchApiEngineDefinition` in `engines.ts`: `resultsKey`, `capabilities` (only what the engine really returns), an item schema built with `opt(...)` so optional fields degrade rather than fail, `buildParams` (with `usOnly` or a currency rule), and `toOffer` via `baseOffer`.
4. Register it in `SEARCHAPI_ENGINES` and add it to `SEARCHAPI_ENGINES` in `.env.example` if it should be on by default.
5. Add a mapping test with a sample response in `apps/api/tests/searchapi-adapter.test.ts`.

## Tests

Tests never call SearchAPI. They pass a `SearchApiClient` with a stubbed `fetch` that serves the recorded responses in `packages/test-fixtures` (`searchApiFixtures`, keyed by engine) to `buildApp(config, { searchApiClient })`; with an injected client no `SEARCHAPI_API_KEY` is needed.

Retailer results are cached only by the SearchAPI client TTL cache; only data observed during a SearchAPI response may be marked `liveVerified=true`.
