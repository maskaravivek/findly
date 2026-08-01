# Retailer adapters

Every retailer declares capabilities separately from its methods. The UI must check these flags before showing stock quantity, pickup estimates, or aisle/bay location.

| Adapter | Demo fixture | Live browser adapter | Current scope |
|---|---:|---:|---|
| Home Depot Canada | Yes | Yes | Nearest-store selection, store-specific price, stock quantity, pickup eligibility, and aisle/bay when supplied by the retailer response |
| Amazon Canada | Yes | Yes | Current online search prices; seller, bundle and delivery details remain explicitly unverified unless validated |
| Walmart Canada | Contract | No | Store selection and pickup |
| Canadian Tire | Yes | No | Store inventory and aisle extraction |
| RONA | Contract | No | Product and store inventory |
| Best Buy Canada | Contract | No | Product and pickup inventory |

`DemoRetailerAdapter` implements the full interface without claiming live data. Live adapters must use the backend-only `BrowserService`, domain allowlists, correlation IDs, bounded timeouts, explicit release, no persistent cookies by default, and screenshots on validated extraction failure.

Live mode currently dispatches only Home Depot Canada and Amazon Canada. Home Depot candidates are resolved from the user's postal area, then precise coordinates are used deterministically to choose the closest candidate before the store-specific product response is accepted. Amazon is comparison-only and never claims local inventory.

Retry transient session startup, navigation, timeout, network, and extraction-validation failures at most three times with exponential backoff and jitter. Do not retry CAPTCHA, authentication, access denied, invalid URL, unsupported page, or product-not-found responses. Stagehand is a narrow fallback for locating a changed control or extracting schema-bounded fields—not an open-ended buying agent.

Production may wrap live adapters with `CachedRetailerAdapter`. The cache stores only successful, non-empty, live-verified search responses in the private PostgreSQL schema. Cache keys include retailer, normalized query, product category, store/postal context, and rounded coordinates. Cache hits are marked `cached_verified`, preserve the original verification time, and are excluded from live-verification claims.
