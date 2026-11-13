# Architecture

```text
Android (Compose, UDF/MVVM)
       | HTTPS + SSE
       v
Fastify API -> LangGraph shopping graph -> model-sdk (mock | Gemini | OpenAI | Anthropic)
                         |
                         |-- agent_search (Anthropic): tool loop over retailer adapters, budgeted
                         |-- dispatch_retailer_searches (other providers): fixed plan, concurrent
                         |        -> retailer-sdk adapters
                         |             -> SearchApiRetailerAdapter (one per engine) -> searchapi.io
                         |             -> DemoRetailerAdapter (fixtures, demo mode)
                         -> deterministic normalization, matching and ranking
                         -> in-memory checkpoints
```

The current vertical slice accepts a natural-language query, may interrupt for one material/compatibility clarification, then searches retailers in one of two ways. When the model provider implements `runShoppingAgent` (Anthropic, or the mock provider in `RETAILER_MODE=searchapi`), the `agent_search` node lets the model choose retailers and queries through tools; code enforces the call budget and accepts only shortlisted offers it has seen. Otherwise the fixed search plan fans out to the selected adapters concurrently. Both paths feed the same `match_products` and `rank_offers` nodes, so the model proposes and code verifies. Partial results are preserved, money is ranked as integer minor units, and every offer carries provenance.

Retailers are SearchAPI engines configured by `SEARCHAPI_ENGINES`; country and currency come from the request or `DEFAULT_COUNTRY` / `DEFAULT_CURRENCY`. All modes use an in-memory checkpointer; demo mode additionally uses a mock model and fixture adapters.

Images are represented by artifact IDs. Raw images and raw retailer payloads must not be placed in graph state. Stable `thread_id` checkpoints allow clarification to resume while the current container instance remains awake. State is intentionally lost when the scale-to-zero container sleeps or restarts.

The Android source includes the requested platform dependencies and boundaries for CameraX, ML Kit barcode scanning, Room, DataStore, location, WorkManager, and Coil. The first UI slice exercises typed Retrofit requests, clarification resume, offer provenance, package variants, fulfillment, and aisle/bay presentation. Camera capture, barcode analyzer, offline Room history, saved lists, and watches are the next vertical slices rather than simulated controls.

See [`langgraph-workflow.md`](langgraph-workflow.md) for node details and [`retailer-adapters.md`](retailer-adapters.md) for engines.
