# Findly

Findly is a configurable, Canada-first shopping utility: describe, photograph, or scan an item, then compare exact products and ways to get them online or nearby. The repository contains a native Android app and a Node.js/TypeScript API orchestrated with LangGraph.js.

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

Build Android with `pnpm android:build` (or `./gradlew assembleDebug -PbrandName=YourBrand`). The emulator calls the API at `10.0.2.2:3000`. All fixture offers visibly say `liveVerified: false`; demo prices, stock, pickup times, aisles, and bays are never presented as live.

## Workspace

- `apps/api`: Fastify, LangGraph, SSE, model providers, adapters, and PostgreSQL checkpointing.
- `apps/android`: Compose/Material 3 client using MVVM and unidirectional Flow state.
- `packages/contracts`: Zod wire and domain schemas.
- `packages/model-sdk`: provider-neutral AI contract.
- `packages/retailer-sdk`: adapter and capability contract.
- `packages/test-fixtures`: deterministic Canadian retailer demo data.
- `infra`: local PostgreSQL and deployment starting points.
- `docs`: architecture, security, workflow, adapters, and API details.

Brand display name is configured by `BRAND_NAME` on the API and Android resources/application configuration on the client. No purchasing endpoint exists: offer links hand control to the retailer.

## Production vertical slice

The phone-test deployment is available at `https://findly-api.maskaravivek.workers.dev`. It uses a scale-to-zero Cloudflare Container behind a Worker for the Node.js API, a Canada Central Supabase project for PostgreSQL checkpointing and anonymous JWT authentication, Gemini for shopping-request understanding, and Browserbase for Home Depot Canada plus Amazon Canada. Home Depot results are bound to a validated nearby store and expose stock/pickup/aisle fields only when supplied by the retailer; Amazon is an online price comparison and does not claim local inventory.

See [`docs/deployment.md`](docs/deployment.md) for environment variables, verification commands, Android build configuration, and the boundary between the deployed demo slice and future live retailer/model credentials.
