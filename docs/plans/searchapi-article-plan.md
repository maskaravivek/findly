# Plan: SearchAPI article + backend changes

Article goal: show how a natural-language shopping request becomes a grounded shortlist by combining an LLM tool-calling loop with SearchAPI's live product-search engines, and how to expose that as an HTTP API.

## 1. Where the backend is today

- `apps/api` is a Fastify server running a fixed LangGraph pipeline (`shopping-graph.ts`): understand → plan → fan out to retailer adapters → match → rank → summarize.
- Live retailer data comes from two bespoke adapters: `home-depot.ts` (scrapes homedepot.ca JSON endpoints via curl) and `amazon-browser.ts` (Browser Use managed browser + Playwright). These are exactly the "static scraping" the article argues against, so they become the "before" story.
- Model providers (`providers.ts`) only do structured JSON output (Gemini / OpenAI). There is no tool-calling loop; retailer choice is a hard-coded list in `generateSearchPlan`.
- Contracts (`packages/contracts`) are Canada-only: `currency: z.literal("CAD")`, `country: z.literal("CA")`, `RetailerIdSchema` is a closed enum of 6 Canadian retailers.
- `RetailerAdapter` (`packages/retailer-sdk`) is a good seam: a SearchAPI-backed adapter slots in without touching the graph.
- Working tree has ~55 uncommitted files from the Cloudflare Containers migration. Commit or stash before starting article work so the article branch has a clean base.

## 2. Gaps between the code and the article

| Article promise | Current code | Change needed |
|---|---|---|
| SearchAPI for Amazon / Walmart / Best Buy / Home Depot / Google Shopping | Scraping + managed browser | New `SearchApiAdapter` |
| Agentic loop with tool calling (OpenAI or Claude SDK) | Fixed graph, JSON-only model calls | Tool-calling provider + agent node |
| Shortlist "grounded in current results" | Already deterministic match + rank | Keep; this is the guardrail story |
| Build an API for it | `POST /v1/search` + SSE exists | Keep, trim for the article |
| Adaptable to any country | CAD/CA literals | Loosen to string + config |

## 3. Backend changes (in order)

### 3.1 Prep
- Commit the Cloudflare migration work on `main`, then branch `feat/searchapi-agent`.
- Add `SEARCHAPI_API_KEY`, `RETAILER_MODE=searchapi`, `DEFAULT_COUNTRY`, `SEARCHAPI_ENGINES` (comma list) to `env.ts` and `.env.example`.

### 3.2 SearchAPI client + adapter (`apps/api/src/retailers/searchapi/`)
- `client.ts`: one `fetch` wrapper for `GET https://www.searchapi.io/api/v1/search` with `Authorization: Bearer`, timeout, retry on 429/5xx, and an in-memory TTL cache keyed on `(engine, params)` to protect credits during dev and tests.
- One adapter class parameterised by engine, each with a small Zod schema for the fields we actually read:
  - `amazon_search` (`q`, `amazon_domain`, `delivery_country`, `postal_code`, `sort_by`, `price_min/max`) → `organic_results[]`: `asin, title, link, brand, price, extracted_price, rating, reviews, thumbnail, is_prime, fulfillment.standard_delivery/fastest_delivery`.
  - `walmart_search` → organic results (docs page 404'd during research; confirm `store_id` / zip param and item keys against the live docs nav before coding).
  - `home_depot_search`, `bestbuy_search` → same pattern; confirm engine slugs.
  - `google_shopping` (`q`, `gl`, `hl`, `location`, `price_min/max`, `sort_by`) → `shopping_results[]`: `product_id, title, product_link, seller, price, extracted_price, rating, reviews, delivery, thumbnail, product_token`. Note `product_link` is a Google page, not the merchant URL.
  - Optional detail tools: `amazon_product` (by `asin`), `walmart_product` (by `product_id`).
- Map every result to `NormalizedRetailOffer` with `source.kind = "search_api"`, `liveVerified: true`, `observedAt` from `search_metadata`.
- Drop `amazon-browser.ts`, `browser-service.ts`, `playwright-core`, `BROWSER_USE_API_KEY` from the article branch (keep `home-depot.ts` only if you want a "before vs after" code comparison in the article; otherwise remove).

### 3.3 Contracts
- `MoneySchema.currency` and `ShoppingLocationSchema.country` become `z.string()` (3-letter / 2-letter regex) with defaults from env.
- `RetailerIdSchema` → open string, or extend with `amazon`, `walmart`, `best_buy`, `home_depot`, `google_shopping`. Prefer open string plus a `KNOWN_RETAILERS` map for display names.
- Add `"search_api"` to `source.kind`.
- Update `test-fixtures` and Android `Models.kt` if the enum changes (Android can stay on the Canadian build; article only needs the API).

### 3.4 Agentic loop (the core of the article)
- New `packages/model-sdk` method: `runShoppingAgent({ request, tools }) → { candidates, toolTrace }`.
- Tools exposed to the LLM (thin wrappers over the adapter):
  - `search_products({ engine, query, maxPrice?, sortBy? })`
  - `get_product_details({ engine, id })`
  - `finalize_shortlist({ offerIds, reasoning })`
- Loop: system prompt describes the engines and budget (max N tool calls, max M results per call); LLM picks engines + queries, inspects results, re-queries if relevance is poor, then calls `finalize_shortlist`. Code enforces the budget and returns whatever was found when it runs out.
- Provider (decided 2026-11-12): Anthropic SDK (`@anthropic-ai/sdk`) with `claude-sonnet-5-5`. Use the tool runner (`client.beta.messages.toolRunner`) for the article's main loop, and show the manual `tool_use` / `tool_result` loop once so readers see what the runner does for them. Add an `AnthropicModelProvider` next to the existing ones; `ANTHROPIC_API_KEY` in env.
  - OpenAI Responses API function-tool variant goes in a short aside, not the main code path.
  - Keep Gemini provider in repo but out of the article.
- Graph wiring: replace `build_search_plan` + `dispatch_retailer_searches` with a single `agent_search` node, or keep the plan node and let the agent run inside `dispatch`. Keep `match_products` and `rank_offers` as deterministic guardrails so the article can say "the LLM proposes, the code verifies".
- Emit each tool call as a `ProgressEvent` (`stage: "tool_call"`, engine, query, hits) so SSE shows the agent thinking without leaking prompts.

### 3.5 API surface for the article
- `POST /v1/search` body: `{ text, country?, postalCode?, maxPrice? }`.
- Response: `understoodRequest`, `shortlist` (ranked offers with retailer, price, link, rating, delivery), `recommendation`, `toolTrace` (engine/query/hits per call), `warnings`.
- Keep `/v1/search/:id/events` SSE; drop clarification endpoint from the article (mention as extension).

### 3.6 Tests
- Record 3–4 real SearchAPI responses once into `packages/test-fixtures/searchapi/*.json` (strip keys), use them for adapter mapping tests and a mocked agent-loop test in vitest.
- Fake tool runner for the loop: assert budget enforcement and that `finalize_shortlist` ids are validated against seen results (no hallucinated offers).

### 3.7 Article-sized example
- `examples/searchapi-shopping-agent/` (~250 lines, single `index.ts` + `tools.ts` + `server.ts`) with no LangGraph, Zod only. Article walks through this; links to the full findly repo for the production shape (LangGraph, SSE, ranking).

## 4. Article outline

1. **Why** — natural-language shopping queries, the "which platform should I buy from" question, Findly background.
2. **Why not scrape** — what the old Amazon (managed browser) and Home Depot (JSON endpoint) adapters cost: bot challenges, layout churn, per-retailer parsers, no shared schema. SearchAPI: one endpoint, `engine=` switch, JSON with `extracted_price`/rating/delivery, localisation via `gl`/`amazon_domain`/`postal_code`.
3. **Architecture** — diagram: request → LLM understanding → tool loop (SearchAPI engines) → deterministic match/rank → summary → API.
4. **Setup** — keys, `curl` to SearchAPI for one engine, show raw JSON.
5. **Normalising results** — one `Offer` type across engines; Zod schema; mapping table.
6. **The agent loop** — tool definitions, system prompt, budget, `finalize_shortlist`; full code of the loop with the Anthropic SDK; OpenAI variant in a short aside.
7. **Grounding** — validating shortlist ids against seen results, relevance filter, ranking by price/rating/delivery; "LLM proposes, code verifies".
8. **Exposing it as an API** — Fastify route, request/response JSON, SSE progress of tool calls, sample run with the drill query showing Amazon vs Walmart vs Home Depot.
9. **Cost, caching, rate limits** — credits per call, TTL cache, budget per request.
10. **Extending** — more engines (eBay, Best Buy), product-detail tools, clarification interrupt, mobile client.

## 5. Decisions to make before coding

- Country for the article demo: SearchAPI's Walmart / Home Depot / Best Buy engines are US stores. Use `gl=us` + `amazon.com` for the article, keep Canada as config.
- Primary SDK for the article: Anthropic (decided).
- Keep LangGraph in the article code or only in the repo (recommended: repo only).
