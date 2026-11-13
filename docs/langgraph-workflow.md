# LangGraph shopping workflow

The graph is explicit and bounded:

```text
START -> load_request -> understand_request
  -> [clarification?] prepare_clarification -> request_clarification -> INTERRUPT/resume
  -> agent_search (Claude tool loop over SearchAPI adapters, budgeted)
  -> match_products (verifyAgentShortlist: hard constraints only)
  -> rank_offers -> generate_result_summary -> END
```

Graph state is declared with LangGraph `Annotation.Root`. Array reducers preserve progress, warnings, and the tool trace. Money, sorting, exact model checks, normalized product-term matching, fulfillment boosts, and score calculation are deterministic. Model nodes operate behind `ModelProvider` and validate shopping-request output with Zod; provider output receives one repair attempt.

`match_products` runs `verifyAgentShortlist`, which enforces only the hard constraints the model can get wrong (exact model number or barcode, `maximumPrice` in the same currency, excluded retailers and brands) and leaves product type to the model, so `rank_offers` skips the keyword relevance filter and uses term coverage only as a soft score. Retailer errors such as access challenges and timeouts surface to the model as tool warnings (via `publicRetailerError`), never as raw diagnostics.

`agent_search` calls `ModelProvider.runShoppingAgent` (required on every provider). The model picks retailers and queries through tools built by `buildAgentTools`; code enforces the budget (`AGENT_MAX_TOOL_CALLS`, `AGENT_MAX_RESULTS_PER_CALL`) and only accepts shortlisted offers it has actually seen. The node writes `agentShortlist`, `agentReasoning`, `toolTrace`, a `searching` progress event, and one `tool_call` progress event per call. If the model never finalizes, code ranks everything it found (`fallbackShortlist`). An exhausted budget or an agent error becomes a warning, not a failure.

The graph uses `MemorySaver` with a stable `thread_id`. Resume uses `Command({resume})`, so completed upstream work is not restarted while the current container instance remains awake. If the scale-to-zero container sleeps or restarts, unfinished clarification and event-replay state is intentionally discarded.

SSE publishes only sanitized progress events. It never publishes prompts, hidden reasoning, raw website text, credentials, or cookies.
