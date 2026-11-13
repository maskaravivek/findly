# Security

- Android receives no model, Browser Use, retailer, database, or administrator credentials.
- Amazon's domain is allowlisted by the application before a Browser Use browser session is created. Home Depot requests use a fixed HTTPS origin and encoded query parameters.
- CAPTCHA, authentication, retailer access-denied responses, and other access controls are not bypassed. A challenged retailer returns a partial failure.
- Retailer HTML is untrusted data. Extract only schema-allowed product fields, strip scripts, and never concatenate page instructions into privileged prompts.
- Browser sessions have bounded timeouts, no persistent context by default, explicit release, structured correlation metadata, and redacted logs.
- The model has no purchase, email, secret, arbitrary-network, or authentication-token tools.
- There is no purchase API. `preparePurchaseLink` returns a retailer-controlled link and cannot submit an order.
- Prices use integer CAD minor units. Live claims require `source.liveVerified=true` and a current `observedAt`.
- The prototype has no accounts, saved searches, lists, watches, uploaded images, or cross-device history. Add authentication and object-level authorization before enabling any of those features.
- Search, clarification, and event routes are public. Cloudflare applies IP-based global and search-specific rate limits before forwarding requests to the private container instance.
- LangGraph checkpoints exist only in container memory and are discarded on sleep or restart. Request IDs are random but are not an authorization boundary.
- The Android client contains no service credentials. Model and Browser Use keys remain server-side as Worker secrets.
- Production rate-limits requests and bounds request bodies/timeouts. Image uploads are not enabled yet; validate file types, dimensions, malware risk, retention, and object-level authorization before enabling them.

Suspected prompt-injection phrases should be logged as a security event with artifact/request IDs but without the full unsafe page or secrets.
