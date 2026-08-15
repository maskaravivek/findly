# API

Interactive OpenAPI is served at `/docs` only when `ENABLE_DOCS=true`. It is disabled on the current production deployment.

Production search routes require a Supabase access token in `Authorization: Bearer <token>`.

## `POST /v1/search`

Accepts one of `text`, `barcode`, `productUrl`, or `imageIds`, plus optional postal code, coordinates, selected store, and image artifact IDs. Returns `requestId`, stable `threadId`, status, normalized offers, provenance, warnings, and recommendation. Status may be `awaiting_clarification` with a structured question.

## `POST /v1/search/:requestId/clarification`

Body: `{ "answer": "Concrete" }`. Resumes the same checkpoint with a LangGraph command.

## `GET /v1/search/:requestId/events`

Returns an SSE stream/replay of sanitized progress. Event types are `progress`, `clarification`, `warning`, `complete`, and `failure`. The authenticated user must own the request checkpoint.

## `GET /health`

Returns container liveness and the configured brand. `GET /ready` additionally verifies the PostgreSQL connection. `GET /edge-health` verifies the Cloudflare Worker without waking the scale-to-zero container.
