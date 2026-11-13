# LangGraph shopping workflow

The graph is explicit and bounded:

```text
START -> load_request -> understand_request
  -> [clarification?] request_clarification -> INTERRUPT/resume
  -> build_search_plan
       -> [provider has runShoppingAgent] agent_search (tool loop, budgeted)
       -> [otherwise]                     dispatch_retailer_searches (concurrent, allSettled)
  -> normalize_offers -> match_products -> rank_offers
  -> generate_result_summary -> END
```

Graph state is declared with LangGraph `Annotation.Root`. Array reducers preserve progress, warnings, retailer results, and errors. Money, sorting, exact model checks, normalized product-term matching, fulfillment boosts, and score calculation are deterministic. Model nodes operate behind `ModelProvider` and validate shopping-request output with Zod; provider output receives one repair attempt.

Search plans contain a preferred retailer query and bounded canonical variants. Retailers still run concurrently. Within one retailer, a second query is attempted only when the first request succeeded but all returned products failed deterministic relevance matching. Retailer errors such as access challenges and timeouts remain terminal for that adapter invocation. `match_products` is a final shared gate so no adapter can send an unrelated offer into ranking.

`agent_search` runs when the model provider implements `runShoppingAgent` (Anthropic, or the mock provider in `RETAILER_MODE=searchapi`). The model picks retailers and queries through tools built by `buildAgentTools`; code enforces the budget (`AGENT_MAX_TOOL_CALLS`, `AGENT_MAX_RESULTS_PER_CALL`) and only accepts shortlisted offers it has actually seen. The node writes `agentShortlist`, `agentReasoning`, `toolTrace` and one `tool_call` progress event per call. `normalize_offers` uses the shortlist when present, so `match_products` and `rank_offers` still verify everything the model proposes. An exhausted budget or an agent error becomes a warning, not a failure.

All modes use `MemorySaver` with a stable `thread_id`. Resume uses `Command({resume})`, so completed upstream work is not restarted while the current container instance remains awake. If the scale-to-zero container sleeps or restarts, unfinished clarification and event-replay state is intentionally discarded.

SSE publishes only sanitized progress events. It never publishes prompts, hidden reasoning, raw website text, credentials, or cookies.
