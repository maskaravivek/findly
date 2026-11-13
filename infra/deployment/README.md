# Deployment baseline

Deploy the API image through `apps/cloudflare`: a Cloudflare Worker applies IP-based request limits and forwards traffic to one scale-to-zero Container instance. LangGraph state remains in memory and is intentionally discarded when the container sleeps or restarts. The SearchAPI key (`SEARCHAPI_API_KEY`) and model key are server-only Worker secrets. See `docs/deployment.md`.
