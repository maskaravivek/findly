# SearchAPI shopping agent

A small agent that turns a natural-language shopping request ("battery powered drill under $150")
into a ranked shortlist of real offers from Amazon, Walmart, Home Depot, Best Buy and Google Shopping.

- `searchapi.ts` calls [SearchAPI](https://www.searchapi.io) (one endpoint, `engine=` picks the store) and
  normalises every engine's results into one `Offer` type, with a 10-minute in-memory cache.
- `agent.ts` runs Claude (`claude-sonnet-5-5`) with three tools: `search_products`, `get_seen_offers` and
  `finalize_shortlist`. Code enforces the search budget and drops any shortlist id no search returned.
- `rank.ts` orders the shortlist deterministically by price, rating (with a review-count prior) and pickup/delivery.
- `server.ts` exposes it as `POST /search`; `demo.ts` runs it from the command line.

## Setup

```bash
export SEARCHAPI_API_KEY=...   # https://www.searchapi.io
export ANTHROPIC_API_KEY=...   # https://platform.claude.com
pnpm install
```

## Run

```bash
pnpm demo                                   # or: pnpm tsx demo.ts "4k monitor for a mac"
pnpm dev                                    # http://127.0.0.1:3000
curl -s localhost:3000/search -H 'content-type: application/json' \
  -d '{"query":"battery powered drill","maxPrice":150,"country":"US"}'
pnpm test && pnpm typecheck                 # the test needs no keys and makes no network calls
```

## Response shape

```json
{
  "shortlist": [{ "id": "walmart:123", "retailer": "walmart", "title": "...", "price": 99, "currency": "USD",
                  "url": "https://www.walmart.com/ip/...", "rating": 4.6, "reviews": 2140, "pickup": true }],
  "reasoning": "One or two sentences from the agent on why these offers.",
  "trace": [{ "tool": "search_products", "input": { "retailer": "walmart_search", "query": "cordless drill" }, "summary": "walmart_search: 8 offers" }]
}
```

## Production version

This example is the article-sized core. The full [findly](../../) API (`apps/api`) adds a LangGraph
workflow, server-sent events for live tool-call progress, relevance filtering, ranking lenses
(cheapest, fastest, best rated), retries and timeouts on SearchAPI, and multi-provider model support.
