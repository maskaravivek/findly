# LangGraph shopping workflow

The graph is explicit and bounded:

```text
START -> load_request -> understand_request
  -> [clarification?] request_clarification -> INTERRUPT/resume
  -> build_search_plan -> dispatch_retailer_searches (concurrent, allSettled)
  -> normalize_offers -> rank_offers -> generate_result_summary -> END
```

Graph state is declared with LangGraph `Annotation.Root`. Array reducers preserve progress, warnings, retailer results, and errors. Money, sorting, exact model checks, fulfillment boosts, and score calculation are deterministic. Model nodes operate behind `ModelProvider` and validate shopping-request output with Zod; provider output receives one repair attempt.

Demo uses `MemorySaver`. Outside demo mode, `PostgresSaver` is mandatory, runs `setup()`, and receives a stable `thread_id`. Resume uses `Command({resume})`, so completed upstream work is not restarted. Cancellation can be added with an authenticated cancellation route and an abort signal stored outside graph state.

SSE publishes only sanitized progress events. It never publishes prompts, hidden reasoning, raw website text, credentials, or cookies.
