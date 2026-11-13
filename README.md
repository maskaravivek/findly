# Findly

Findly is a configurable shopping utility: describe, photograph, or scan an item, then compare exact products and ways to get them online or nearby. Country and currency are configuration, not hard-coded. Live retailer data comes from [SearchAPI](https://www.searchapi.io) (Amazon, Walmart, Home Depot, Best Buy, Google Shopping), and an Anthropic tool-calling agent picks retailers and queries while deterministic code verifies, matches, and ranks everything it proposes. The repository contains a native Android app and a Node.js/TypeScript API orchestrated with LangGraph.js.

## Run it

Requirements: Node 24+, pnpm 10+, JDK 17+, Android SDK 35 (Android only). You need a [SearchAPI](https://www.searchapi.io) key and an Anthropic API key; the API refuses to start without them.

Set these in `.env` (see [`.env.example`](.env.example) for every variable):

```text
SEARCHAPI_API_KEY=<searchapi.io key>
ANTHROPIC_API_KEY=<Anthropic API key>
DEFAULT_COUNTRY=US            # ISO 3166-1 alpha-2, used when a request omits country
DEFAULT_CURRENCY=USD          # ISO 4217, used when a request omits currency
SEARCHAPI_ENGINES=amazon_search,walmart_search,home_depot_search,bestbuy_search,google_shopping
AGENT_MAX_TOOL_CALLS=12       # search_products calls per request
```

Then:

```bash
cp .env.example .env   # fill in the two keys
pnpm install
pnpm dev
```

Open `http://localhost:3000/docs`, or send:

```bash
curl -X POST http://localhost:3000/v1/search \
  -H 'content-type: application/json' \
  -d '{"text":"cordless drill","country":"US","maxPrice":150,"imageIds":[]}'
```

Every search runs one path: the Anthropic agent loop (`claude-sonnet-5-5` by default, override with `PRIMARY_MODEL`) calls `search_products` against the configured SearchAPI engines, then `finalize_shortlist`; code enforces the budget, drops any offer id no search returned, verifies hard constraints (price cap, exclusions, exact model), and ranks. Walmart, Home Depot, and Best Buy engines are US stores; Amazon and Google Shopping localise by country. See [`docs/retailer-adapters.md`](docs/retailer-adapters.md).

Tests need no keys: they inject a `SearchApiClient` that serves the recorded responses in `packages/test-fixtures` and use `MODEL_PROVIDER=mock`, a deterministic test-only stand-in for the agent.

## Android

Build with `pnpm android:build` (or `./gradlew assembleDebug -PbrandName=YourBrand`). The emulator calls the API at `10.0.2.2:3000`. The client has not been updated for the SearchAPI retailers yet: it decodes any retailer id, but formats every price as CAD and labels the pickup section with Home Depot.

## Workspace

- `apps/api`: Fastify, LangGraph with in-memory checkpoints, SSE, the Anthropic model provider and shopping agent (plus a test-only mock), and SearchAPI retailer adapters.
- `apps/android`: Compose/Material 3 client using MVVM and unidirectional Flow state.
- `apps/cloudflare`: Worker and Container configuration for the deployed API.
- `packages/contracts`: Zod wire and domain schemas.
- `packages/model-sdk`: provider-neutral AI contract, including the shopping-agent interface.
- `packages/retailer-sdk`: adapter and capability contract.
- `packages/test-fixtures`: recorded SearchAPI responses used by the tests.
- `examples/searchapi-shopping-agent`: article-sized standalone agent (SearchAPI + Claude, no LangGraph).
- `infra`: the production API container image.
- `docs`: architecture, security, workflow, adapters, deployment, and API details.

Brand display name is configured by `BRAND_NAME` on the API and Android resources/application configuration on the client. No purchasing endpoint exists: offer links hand control to the retailer.

## Deployed API

The phone-test deployment is available at `https://findly-api.maskaravivek.workers.dev`. It uses a scale-to-zero Cloudflare Container behind a Worker for the Node.js API, in-memory workflow state, the Anthropic shopping agent, and SearchAPI retailer adapters. The Worker needs `ANTHROPIC_API_KEY` and `SEARCHAPI_API_KEY` as secrets. No account or database service is required. Offers expose stock, pickup, and delivery fields only when the engine returned them.

See [`docs/deployment.md`](docs/deployment.md) for environment variables, secrets, verification commands, and Android build configuration.
