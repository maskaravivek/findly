# Production deployment

The production vertical slice uses:

- Cloudflare Worker `findly-api` with one on-demand `basic` Container constrained to Eastern North America.
- In-memory LangGraph checkpoints that last for the lifetime of the current container instance.
- IP-based Cloudflare rate limits with no account or authentication service.
- The Anthropic shopping agent (`claude-sonnet-5-5`) over SearchAPI retailer adapters.

The public API base URL is `https://findly-api.maskaravivek.workers.dev/`.

## Environment variables

`apps/api/src/config/env.ts` is the source of truth; `.env.example` lists every variable with its default. The ones that matter in production:

| Variable | Default | Purpose |
|---|---|---|
| `SEARCHAPI_API_KEY` | none | Required |
| `SEARCHAPI_ENGINES` | all five engines | Comma list of enabled engines |
| `SEARCHAPI_TIMEOUT_MS` / `SEARCHAPI_CACHE_TTL_MS` | `20000` / `300000` | Per-request timeout; response cache TTL (`0` disables) |
| `ANTHROPIC_API_KEY` | none | Required |
| `MODEL_PROVIDER` | `anthropic` | `mock` is for tests only |
| `PRIMARY_MODEL` | `claude-sonnet-5-5` | Anthropic model id |
| `DEFAULT_COUNTRY` / `DEFAULT_CURRENCY` | `US` / `USD` | Used when a request omits them |
| `AGENT_MAX_TOOL_CALLS` / `AGENT_MAX_RESULTS_PER_CALL` | `6` / `8` | Agent search budget |

The API refuses to start without `SEARCHAPI_API_KEY`, or without `ANTHROPIC_API_KEY` when `MODEL_PROVIDER=anthropic`.

## Cloudflare configuration

The deployment source of truth is `apps/cloudflare/wrangler.jsonc`. Non-sensitive production configuration is declared in `vars` there (`MODEL_PROVIDER=anthropic`, `PRIMARY_MODEL`). `apps/cloudflare/src/index.ts` forwards an explicit list of bindings to the container, so a new variable (for example `DEFAULT_COUNTRY`) must be added there as well as in `wrangler.jsonc` or as a secret. Store keys as Worker secrets:

```bash
pnpm --filter @findly/cloudflare exec wrangler secret put ANTHROPIC_API_KEY
pnpm --filter @findly/cloudflare exec wrangler secret put SEARCHAPI_API_KEY
```

Do not place the Anthropic key, the SearchAPI key, or retailer credentials in the Android build.

Deploy the container image and Worker from the repository root. Wrangler builds the image from `infra/docker/api.Dockerfile`, publishes a content-addressed image, and immediately rolls the updated container application forward:

```bash
pnpm cloudflare:deploy
pnpm --filter @findly/cloudflare exec wrangler containers list
```

The Worker routes every API request to one stable container instance, applies global and search-specific edge rate limits, and lets the container sleep after 90 idle seconds. Use `/edge-health` for monitoring that should not wake the container.

## Verification

```bash
BASE=https://findly-api.maskaravivek.workers.dev
curl --fail $BASE/edge-health
curl --fail $BASE/health
curl --fail $BASE/ready
curl --fail -X POST $BASE/v1/search \
  -H 'content-type: application/json' \
  -d '{"text":"cordless drill","country":"US","maxPrice":150,"imageIds":[]}'
```

`/ready` must report `state: memory`. A live search returns offers with `source.kind: "search_api"` and `liveVerified: true`; a rejected SearchAPI key or engine error shows up as retailer warnings rather than a failed request. Search routes are intentionally unauthenticated for this prototype. Clarification and event replay work only while the current container instance remains awake; after sleep or restart, the client must begin a new search.

## Android phone build

```bash
cd apps/android
./gradlew :app:assembleDebug \
  -PapiBaseUrl=https://findly-api.maskaravivek.workers.dev/ \
  -PusesCleartextTraffic=false
```

The APK is written to `apps/android/app/build/outputs/apk/debug/app-debug.apk`.

## Retailer coverage

Coverage is set by `SEARCHAPI_ENGINES`. Walmart, Home Depot, and Best Buy engines are US stores; Amazon and Google Shopping localise by country. Engine failures produce partial results with warnings rather than fabricated availability. See [`retailer-adapters.md`](retailer-adapters.md) for per-engine capabilities and currency rules.
