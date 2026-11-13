# Architecture

```text
Android (Compose, UDF/MVVM)
       | HTTPS + SSE
       v
Fastify API -> LangGraph shopping graph -> model-sdk
                         |              -> retailer-sdk adapters
                         |                    -> Home Depot public JSON endpoints
                         |                    -> Browser Use managed browser + Playwright (Amazon)
                         -> deterministic normalization, matching and ranking
                         -> in-memory checkpoints
```

The current vertical slice accepts a natural-language query, may interrupt for one material/compatibility clarification, searches six adapters concurrently, preserves partial results, distinguishes the tool-only marketplace fixture, ranks with integer money, and returns provenance. All modes use an in-memory checkpointer; demo mode additionally uses a mock model and fixture adapters.

Images are represented by artifact IDs. Raw images, screenshots, and browser traces must not be placed in graph state. Stable `thread_id` checkpoints allow clarification to resume while the current container instance remains awake. State is intentionally lost when the scale-to-zero container sleeps or restarts.

The Android source includes the requested platform dependencies and boundaries for CameraX, ML Kit barcode scanning, Room, DataStore, location, WorkManager, and Coil. The first UI slice exercises typed Retrofit requests, clarification resume, offer provenance, package variants, fulfillment, and aisle/bay presentation. Camera capture, barcode analyzer, offline Room history, saved lists, and watches are the next vertical slices rather than simulated controls.
