# Production deployment

The initial production vertical slice uses:

- Railway project `Findly`, service `findly-api`, one US East replica.
- Supabase project `Findly` (`jewvwzxydkfgmhkpxvrm`) in Canada Central.
- Private PostgreSQL schema `findly_internal` for shopping request records, browser artifact metadata, and LangGraph checkpoints.
- Supabase anonymous authentication for device-scoped sessions.
- Gemini shopping-request understanding plus Browserbase adapters for Home Depot Canada and Amazon Canada. Home Depot offers include selected-store stock and pickup fields when the retailer verifies them; Amazon supplies a current online price comparison with unverified seller/bundle details called out.

The public API base URL is `https://findly-api-production-6df6.up.railway.app/`. The Supabase client URL is `https://jewvwzxydkfgmhkpxvrm.supabase.co/`.

## Railway variables

Configure the service with:

```text
NODE_ENV=production
HOST=0.0.0.0
CHECKPOINTER_MODE=postgres
RETAILER_MODE=live
CHECKPOINT_SCHEMA=findly_internal
AUTH_MODE=supabase
SUPABASE_URL=https://jewvwzxydkfgmhkpxvrm.supabase.co
ENABLE_DOCS=false
RATE_LIMIT_MAX=30
MODEL_PROVIDER=gemini
PRIMARY_MODEL=gemini-3.1-flash-lite
BRAND_NAME=Findly
DATABASE_URL=<Supabase session-pooler connection string>
GEMINI_API_KEY=<server-side Gemini authorization key>
BROWSERBASE_API_KEY=<Browserbase API key>
BROWSERBASE_PROJECT_ID=<Browserbase project ID>
```

Do not place `DATABASE_URL`, model keys, Browserbase keys, retailer credentials, or a Supabase service-role key in the Android build.

Deploy from the repository root:

```bash
railway up --detach --service findly-api --environment production
railway deployment list --service findly-api --environment production --limit 1 --json
```

## Verification

```bash
curl --fail https://findly-api-production-6df6.up.railway.app/health
curl --fail https://findly-api-production-6df6.up.railway.app/ready
```

`/ready` must report `database: connected`. A search without a bearer token must return HTTP 401. A production search obtains an anonymous Supabase session first, then sends its access token to the API. Request ownership is enforced for clarification and SSE replay.

## Android phone build

Supply the Supabase publishable key as a Gradle property. This key is intended for public clients; Row Level Security and backend authorization remain the security boundaries.

```bash
cd apps/android
./gradlew :app:assembleDebug \
  -PapiBaseUrl=https://findly-api-production-6df6.up.railway.app/ \
  -PsupabaseUrl=https://jewvwzxydkfgmhkpxvrm.supabase.co/ \
  -PsupabasePublishableKey="$SUPABASE_PUBLISHABLE_KEY" \
  -PusesCleartextTraffic=false
```

The APK is written to `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

## Expanding live retailer coverage

Home Depot Canada and Amazon Canada are the only live adapters. Home Depot is the local-inventory source; Amazon is an online comparison source. Walmart, Canadian Tire, RONA, and Best Buy remain omitted until their capabilities are implemented and verified. Retailer challenges and failures produce partial results rather than fabricated availability.

For the Canada-first demo, configure `BROWSER_PROXY_COUNTRY=CA` and optionally `BROWSER_PROXY_CITY=TORONTO`. Browserbase's supported CAPTCHA solver is enabled for all retailer sessions. `RETAILER_CACHE_ENABLED=true` enables the backend-only PostgreSQL cache; `RETAILER_CACHE_TTL_SECONDS=300` keeps successful, non-empty retailer responses for five minutes. Cached offers retain their original `observedAt`, use `source.kind=cached_verified`, and never claim `liveVerified=true` for the current request. Failures and empty responses are not cached.
