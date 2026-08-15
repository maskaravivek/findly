# Security

- Android receives no model, Browserbase, retailer, database, or administrator credentials.
- Retailer domains are allowlisted at both application and Browserbase session levels.
- Browserbase's supported CAPTCHA solver is enabled for retailer sessions. Authentication requirements, retailer access-denied responses, and other access controls are not bypassed.
- Retailer HTML is untrusted data. Extract only schema-allowed product fields, strip scripts, and never concatenate page instructions into privileged prompts.
- Browser sessions have bounded timeouts, no persistent context by default, explicit release, structured correlation metadata, and redacted logs.
- The model has no purchase, email, secret, arbitrary-network, or authentication-token tools.
- There is no purchase API. `preparePurchaseLink` returns a retailer-controlled link and cannot submit an order.
- Prices use integer CAD minor units. Live claims require `source.liveVerified=true` and a current `observedAt`.
- Authenticate users before lists, watches, saved locations, images, or history are enabled. Apply object-level authorization by `userId`; never trust a client-supplied owner ID.
- Production search, clarification, and SSE routes validate Supabase JWTs. Clarification and SSE access also compare the authenticated subject with the checkpoint owner.
- Cloudflare terminates public TLS and forwards requests through the Worker to the private container instance. PostgreSQL tables and LangGraph checkpoints live in a private `findly_internal` schema; `anon` and `authenticated` have no schema access.
- The Android client contains only the Supabase publishable key. Database credentials, model keys, service-role keys, and retailer/browser credentials remain server-side.
- Production rate-limits requests and bounds request bodies/timeouts. Image uploads are not enabled yet; validate file types, dimensions, malware risk, retention, and object-level authorization before enabling them.

Suspected prompt-injection phrases should be logged as a security event with artifact/request IDs but without the full unsafe page or secrets.
