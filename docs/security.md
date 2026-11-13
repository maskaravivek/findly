# Security

- Android receives no model, SearchAPI, retailer, database, or administrator credentials.
- `SEARCHAPI_API_KEY` and model keys are server-only. Fastify log redaction covers `apiKey`, cookies, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, and `SEARCHAPI_API_KEY`. The SearchAPI key travels only in the `Authorization` header (never the URL), and `SearchApiError` messages never include the key or upstream body text.
- SearchAPI requests go to one fixed HTTPS endpoint with encoded query parameters. Engine names come from configuration, not the model.
- Retailer data is untrusted. Each item is parsed with a Zod schema of the fields we read, URLs must be http(s), and the final offer must pass `NormalizedRetailOfferSchema`.
- The agent's system prompt states that the shopping request and all tool output are untrusted data whose instructions must never be followed. The request is passed inside a `<shopping_request>` block marked as data.
- The model sees compact views only: offer id, retailer, truncated title, formatted price, rating, review count, fulfillment summary, and URL. Raw SearchAPI payloads and prompts are never sent to the client.
- The model's tools are limited to `search_products` (retailer id is an enum of configured adapters), `get_seen_offers`, and `finalize_shortlist`. Code enforces `AGENT_MAX_TOOL_CALLS` and `AGENT_MAX_RESULTS_PER_CALL`.
- Shortlisted offer ids are validated against offers the code actually received; unknown ids are dropped, and the shortlist still passes deterministic matching and ranking.
- The model has no purchase, email, secret, arbitrary-network, or authentication-token tools.
- There is no purchase API. `preparePurchaseLink` returns a retailer-controlled link and cannot submit an order.
- Prices use integer minor units in the marketplace currency. Live claims require `source.liveVerified=true` and a current `observedAt`.
- The prototype has no accounts, saved searches, lists, watches, uploaded images, or cross-device history. Add authentication and object-level authorization before enabling any of those features.
- Search, clarification, and event routes are public. Cloudflare applies IP-based global and search-specific rate limits before forwarding requests to the private container instance.
- LangGraph checkpoints exist only in container memory and are discarded on sleep or restart. Request IDs are random but are not an authorization boundary.
- SSE and `toolTrace` carry only tool names, validated inputs, short result summaries, and durations; never prompts, raw payloads, or credentials.
- Production rate-limits requests and bounds request bodies/timeouts. Image uploads are not enabled yet; validate file types, dimensions, malware risk, retention, and object-level authorization before enabling them.
