# Production deployment

The production vertical slice uses:

- Cloudflare Worker `findly-api` with one on-demand `basic` Container constrained to Eastern North America.
- In-memory LangGraph checkpoints that last for the lifetime of the current container instance.
- IP-based Cloudflare rate limits with no account or authentication service.
- Gemini shopping-request understanding, Home Depot Canada's public JSON endpoints, and Browser Use managed browsers for Amazon Canada.

The public API base URL is `https://findly-api.maskaravivek.workers.dev/`.

## Cloudflare configuration

The deployment source of truth is `apps/cloudflare/wrangler.jsonc`. Non-sensitive production configuration is declared there. Store these values as Worker secrets:

```text
GEMINI_API_KEY=<server-side Gemini authorization key>
BROWSER_USE_API_KEY=<Browser Use API key starting with bu_>
```

Do not place model keys, the Browser Use API key, or retailer credentials in the Android build.

Deploy the container image and Worker from the repository root. Wrangler builds the image from `infra/docker/api.Dockerfile`, publishes a content-addressed image, and immediately rolls the updated container application forward:

```bash
pnpm cloudflare:deploy
pnpm --filter @findly/cloudflare exec wrangler containers list
```

The Worker routes every API request to one stable container instance, applies global and search-specific edge rate limits, and lets the container sleep after 90 idle seconds. Use `/edge-health` for monitoring that should not wake the container.

## Verification

```bash
curl --fail https://findly-api.maskaravivek.workers.dev/edge-health
curl --fail https://findly-api.maskaravivek.workers.dev/health
curl --fail https://findly-api.maskaravivek.workers.dev/ready
```

`/ready` must report `state: memory`. Search routes are intentionally unauthenticated for this prototype. Clarification and event replay work only while the current container instance remains awake; after sleep or restart, the client must begin a new search.

## Android phone build

```bash
cd apps/android
./gradlew :app:assembleDebug \
  -PapiBaseUrl=https://findly-api.maskaravivek.workers.dev/ \
  -PusesCleartextTraffic=false
```

The APK is written to `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

## Expanding live retailer coverage

Home Depot Canada and Amazon Canada are the only live adapters. Home Depot is the local-inventory source; Amazon is an online comparison source. Walmart, Canadian Tire, RONA, and Best Buy remain omitted until their capabilities are implemented and verified. Retailer challenges and failures produce partial results rather than fabricated availability.

Amazon sessions run in Browser Use managed browsers with a residential proxy geolocated to the user's country (the requested country, defaulting to CA). Amazon's adapter still attempts to set the postal code in the retailer UI and does not claim local inventory. Home Depot's store lookup and product query include the requested Canadian postal code or resolved store ID before location-dependent data is accepted. Retailer results are not cached; every search invokes the configured live adapters and preserves partial failures rather than fabricating availability.
