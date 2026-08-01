# Deployment baseline

Deploy the API container behind HTTPS with managed PostgreSQL, private encrypted artifact storage, workload identity/secret injection, health checks, request limits, and at least two instances. Run migrations and LangGraph checkpoint setup as a one-off release task. Browserbase and model keys are server-only secrets. Do not enable `BROWSER_DEBUG_URLS` in production.

Redis is intentionally omitted from the first slice. Add it only for distributed rate limiting or a durable job queue; it is not required for graph state.
