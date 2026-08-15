# Production deployment

The production vertical slice uses:

- Cloudflare Worker `findly-api` with one on-demand `basic` Container constrained to Eastern North America.
- Supabase project `Findly` (`jewvwzxydkfgmhkpxvrm`) in Canada Central.
- Private PostgreSQL schema `findly_internal` for shopping request records, retailer cache entries, browser artifact metadata, and LangGraph checkpoints.
- Supabase anonymous authentication for device-scoped sessions.
- Gemini shopping-request understanding plus Browserbase adapters for Home Depot Canada and Amazon Canada.

The public API base URL is `https://findly-api.maskaravivek.workers.dev/`. The Supabase client URL is `https://jewvwzxydkfgmhkpxvrm.supabase.co/`.

## Cloudflare configuration

The deployment source of truth is `apps/cloudflare/wrangler.jsonc`. Non-sensitive production configuration is declared there. Store these values as Worker secrets:

```text
DATABASE_URL=<Supabase session-pooler connection string>
GEMINI_API_KEY=<server-side Gemini authorization key>
BROWSERBASE_API_KEY=<Browserbase API key>
BROWSERBASE_PROJECT_ID=<Browserbase project ID>
```

Do not place `DATABASE_URL`, model keys, Browserbase keys, retailer credentials, or a Supabase service-role key in the Android build.

Deploy the immutable `linux/amd64` container image and Worker from the repository root:

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

`/ready` must report `database: connected`. A search without a bearer token must return HTTP 401. A production search obtains an anonymous Supabase session first, then sends its access token to the API. Request ownership is enforced for clarification and checkpoint-backed SSE replay.

## Android phone build

Supply the Supabase publishable key as a Gradle property. This key is intended for public clients; Row Level Security and backend authorization remain the security boundaries.

```bash
cd apps/android
./gradlew :app:assembleDebug \
  -PapiBaseUrl=https://findly-api.maskaravivek.workers.dev/ \
  -PsupabaseUrl=https://jewvwzxydkfgmhkpxvrm.supabase.co/ \
  -PsupabasePublishableKey="$SUPABASE_PUBLISHABLE_KEY" \
  -PusesCleartextTraffic=false
```

The APK is written to `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

## Expanding live retailer coverage

Home Depot Canada and Amazon Canada are the only live adapters. Home Depot is the local-inventory source; Amazon is an online comparison source. Walmart, Canadian Tire, RONA, and Best Buy remain omitted until their capabilities are implemented and verified. Retailer challenges and failures produce partial results rather than fabricated availability.

Production uses a Canadian Browserbase proxy located in Toronto. The backend-only PostgreSQL retailer cache retains successful, non-empty results for five minutes. Cached offers retain their original `observedAt`, use `source.kind=cached_verified`, and never claim `liveVerified=true` for the current request. Failures and empty responses are not cached.
