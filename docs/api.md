# API

Interactive OpenAPI is served at `/docs` only when `ENABLE_DOCS=true`. It is disabled on the current production deployment.

Search routes do not require an account or access token. The Cloudflare Worker applies IP-based global and search-specific rate limits before requests reach the container.

## `POST /v1/search`

Accepts one of `text`, `barcode`, `productUrl`, or `imageIds`, plus optional postal code, coordinates, selected store, and image artifact IDs. Returns `requestId`, stable `threadId`, status, normalized offers, provenance, warnings, and recommendation. Status may be `awaiting_clarification` with a structured question.

## `POST /v1/search/:requestId/clarification`

Body: `{ "answer": "Concrete" }`. Resumes the same in-memory checkpoint with a LangGraph command. A request returns `404` if its container instance has slept or restarted.

## `GET /v1/search/:requestId/events`

Returns an SSE replay of sanitized progress from the current container instance. Event types are `progress`, `clarification`, `warning`, `complete`, and `failure`.

## `GET /health`

Returns container liveness and the configured brand. `GET /ready` reports the in-memory state mode. `GET /edge-health` verifies the Cloudflare Worker without waking the scale-to-zero container.
