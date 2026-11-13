# Architecture

```text
Android (Compose, UDF/MVVM)
       | HTTPS + SSE
       v
Fastify API -> LangGraph shopping graph -> models/types.ts (AnthropicModelProvider)
                         |
                         |-- agent_search: Claude tool loop over retailer adapters, budgeted
                         |        -> retailers/types.ts adapters
                         |             -> SearchApiRetailerAdapter (one per engine) -> searchapi.io
                         -> deterministic verification (hard constraints) and ranking
                         -> in-memory checkpoints
```

The current vertical slice accepts a natural-language query, may interrupt for one material/compatibility clarification, then runs the `agent_search` node: Claude chooses retailers and queries through tools, while code enforces the call budget and accepts only shortlisted offers it has seen. `match_products` and `rank_offers` then verify and order the shortlist, so the model proposes and code verifies. Partial results are preserved, money is ranked as integer minor units, and every offer carries provenance.

Retailers are SearchAPI engines configured by `SEARCHAPI_ENGINES`; country and currency come from the request or `DEFAULT_COUNTRY` / `DEFAULT_CURRENCY`. State lives in an in-memory checkpointer. Tests swap in a mock model provider and a SearchAPI client that serves recorded responses; there is no other runtime mode.

Images are represented by artifact IDs. Raw images and raw retailer payloads must not be placed in graph state. Stable `thread_id` checkpoints allow clarification to resume while the current container instance remains awake. State is intentionally lost when the scale-to-zero container sleeps or restarts.

The Android source includes the requested platform dependencies and boundaries for CameraX, ML Kit barcode scanning, Room, DataStore, location, WorkManager, and Coil. The first UI slice exercises typed Retrofit requests, clarification resume, offer provenance, package variants, fulfillment, and aisle/bay presentation. Camera capture, barcode analyzer, offline Room history, saved lists, and watches are the next vertical slices rather than simulated controls.

See [`langgraph-workflow.md`](langgraph-workflow.md) for node details and [`retailer-adapters.md`](retailer-adapters.md) for engines.
