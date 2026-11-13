# Retailer adapters

Every retailer declares capabilities separately from its methods. The UI must check these flags before showing stock quantity, pickup estimates, or aisle/bay location.

| Adapter | Demo fixture | Live browser adapter | Current scope |
|---|---:|---:|---|
| Home Depot Canada | Yes | Public JSON | Nearest-store selection, store-specific price, stock quantity, pickup eligibility, and aisle/bay when supplied by the retailer response |
| Amazon Canada | Yes | Yes | Current online search prices; seller, bundle and delivery details remain explicitly unverified unless validated |
| Walmart Canada | Contract | No | Store selection and pickup |
| Canadian Tire | Yes | No | Store inventory and aisle extraction |
| RONA | Contract | No | Product and store inventory |
| Best Buy Canada | Contract | No | Product and pickup inventory |

`DemoRetailerAdapter` implements the full interface without claiming live data. Amazon uses the backend-only `BrowserService`, an application domain allowlist, bounded sessions, explicit browser closure, and no persistent cookies by default. Home Depot uses fixed-host, encoded requests to the retailer's public Canadian JSON endpoints and rejects any product response that is not bound to the selected store.

Live mode currently dispatches only Home Depot Canada and Amazon Canada. Home Depot candidates are resolved from the user's postal area, then precise coordinates are used deterministically to choose the closest candidate before the store-specific product response is accepted. Amazon is comparison-only and never claims local inventory.

Retry transient session startup, navigation, timeout, network, and extraction-validation failures at most three times with exponential backoff and jitter. Do not retry CAPTCHA, authentication, access denied, invalid URL, unsupported page, or product-not-found responses.

Production does not cache retailer responses. Each search invokes the configured live adapters, and only data observed during that request may be marked `liveVerified=true`.
