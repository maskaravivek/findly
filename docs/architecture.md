# Architecture

```text
Android (Compose, UDF/MVVM)
       | HTTPS + SSE
       v
Fastify API -> LangGraph shopping graph -> model-sdk
                         |              -> retailer-sdk adapters
                         |                    -> Browserbase + Playwright
                         -> deterministic normalization, matching and ranking
                         -> PostgreSQL checkpoints
```

The current vertical slice accepts a natural-language query, may interrupt for one material/compatibility clarification, searches six adapters concurrently, preserves partial results, distinguishes the tool-only marketplace fixture, ranks with integer money, and returns provenance. Demo mode uses a mock model, fixture adapters, and an in-memory checkpointer. Non-demo startup requires PostgreSQL; production deployments must run the LangGraph checkpointer setup before serving.

Images are represented by artifact IDs. Raw images, screenshots, and browser traces belong in encrypted object storage, not graph state. PostgreSQL stores stable `thread_id` checkpoints so clarification resumes the same workflow after a process restart.

The Android source includes the requested platform dependencies and boundaries for CameraX, ML Kit barcode scanning, Room, DataStore, location, WorkManager, and Coil. The first UI slice exercises typed Retrofit requests, clarification resume, offer provenance, package variants, fulfillment, and aisle/bay presentation. Camera capture, barcode analyzer, offline Room history, saved lists, and watches are the next vertical slices rather than simulated controls.
