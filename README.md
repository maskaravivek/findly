# Findly

Findly is a configurable shopping utility: describe, photograph, or scan an item, then compare exact products and ways to get them online or nearby. Country and currency are configuration, not hard-coded. Live retailer data comes from [SearchAPI](https://www.searchapi.io) (Amazon, Walmart, Home Depot, Best Buy, Google Shopping), and an Anthropic tool-calling agent picks retailers and queries while deterministic code verifies, matches, and ranks everything it proposes. The repository contains a native Android app and a Node.js/TypeScript API orchestrated with LangGraph.js.

## Run the credential-free demo

Requirements: Node 24+, pnpm 10+, JDK 17+, Android SDK 35.

```bash
cp .env.example .env
pnpm install
pnpm demo
```

Open `http://localhost:3000/docs`, or send:

```bash
curl -X POST http://localhost:3000/v1/search \
  -H 'content-type: application/json' \
  -d '{"text":"Find this DeWalt drill cheaper nearby","postalCode":"L1G 0A1","imageIds":[]}'
```

Demo mode uses a mock model and fixture adapters with sample retailer data. All fixture offers visibly say `liveVerified: false`; demo prices, stock, pickup times, aisles, and bays are never presented as live.

## Live mode

Set these in `.env` (see [`.env.example`](.env.example) for every variable):

```text
DEMO_MODE=false
RETAILER_MODE=searchapi
SEARCHAPI_API_KEY=<searchapi.io key>
MODEL_PROVIDER=anthropic
ANTHROPIC_API_KEY=<Anthropic API key>
DEFAULT_COUNTRY=US            # ISO 3166-1 alpha-2, used when a request omits country
DEFAULT_CURRENCY=USD          # ISO 4217, used when a request omits currency
SEARCHAPI_ENGINES=amazon_search,walmart_search,home_depot_search,bestbuy_search,google_shopping
AGENT_MAX_TOOL_CALLS=6        # search_products calls per request
```

Then `pnpm dev`. With `MODEL_PROVIDER=anthropic` the graph runs the agent loop (`claude-sonnet-5-5` by default, override with `PRIMARY_MODEL`): the model calls `search_products` against the configured engines, then `finalize_shortlist`; code enforces the budget, drops any offer id no search returned, and still runs relevance matching and ranking. Other providers (`gemini`, `openai`) skip the agent and use the fixed search plan. Walmart, Home Depot, and Best Buy engines are US stores; Amazon and Google Shopping localise by country. See [`docs/retailer-adapters.md`](docs/retailer-adapters.md).

## Android

Build with `pnpm android:build` (or `./gradlew assembleDebug -PbrandName=YourBrand`). The emulator calls the API at `10.0.2.2:3000`. The client has not been updated for the SearchAPI retailers yet: it decodes any retailer id, but formats every price as CAD and labels the pickup section with Home Depot.

## Workspace

- `apps/api`: Fastify, LangGraph with in-memory checkpoints, SSE, model providers (mock, Gemini, OpenAI, Anthropic), the shopping agent, and SearchAPI retailer adapters.
- `apps/android`: Compose/Material 3 client using MVVM and unidirectional Flow state.
- `apps/cloudflare`: Worker and Container configuration for the deployed API.
- `packages/contracts`: Zod wire and domain schemas.
- `packages/model-sdk`: provider-neutral AI contract, including the shopping-agent interface.
- `packages/retailer-sdk`: adapter and capability contract.
- `packages/test-fixtures`: deterministic retailer demo data.
- `examples/searchapi-shopping-agent`: article-sized standalone agent (SearchAPI + Claude, no LangGraph).
- `infra`: the production API container image.
- `docs`: architecture, security, workflow, adapters, deployment, and API details.

Brand display name is configured by `BRAND_NAME` on the API and Android resources/application configuration on the client. No purchasing endpoint exists: offer links hand control to the retailer.

## Deployed API

The phone-test deployment is available at `https://findly-api.maskaravivek.workers.dev`. It uses a scale-to-zero Cloudflare Container behind a Worker for the Node.js API, in-memory workflow state, Gemini for shopping-request understanding, and SearchAPI retailer adapters (`RETAILER_MODE=searchapi`). The Worker needs `GEMINI_API_KEY` and `SEARCHAPI_API_KEY` as secrets. No account or database service is required. Offers expose stock, pickup, and delivery fields only when the engine returned them.

See [`docs/deployment.md`](docs/deployment.md) for environment variables, secrets, verification commands, and Android build configuration.
