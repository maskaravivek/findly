import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";
import { rateLimitKey } from "./rate-limit.js";

type FindlyBindings = {
  FINDLY_API_CONTAINER: DurableObjectNamespace<FindlyApiContainer>;
  API_RATE_LIMITER: RateLimit;
  SEARCH_RATE_LIMITER: RateLimit;
  GEMINI_API_KEY: string;
  BROWSER_USE_API_KEY: string;
  NODE_ENV: string;
  HOST: string;
  PORT: string;
  DEMO_MODE: string;
  RETAILER_MODE: string;
  ENABLE_DOCS: string;
  RATE_LIMIT_MAX: string;
  MODEL_PROVIDER: string;
  PRIMARY_MODEL: string;
  BRAND_NAME: string;
};

const bindings = env as unknown as FindlyBindings;

export class FindlyApiContainer extends Container {
  defaultPort = 3000;
  sleepAfter = "90s";
  envVars = {
    NODE_ENV: bindings.NODE_ENV,
    HOST: bindings.HOST,
    PORT: bindings.PORT,
    DEMO_MODE: bindings.DEMO_MODE,
    RETAILER_MODE: bindings.RETAILER_MODE,
    ENABLE_DOCS: bindings.ENABLE_DOCS,
    RATE_LIMIT_MAX: bindings.RATE_LIMIT_MAX,
    MODEL_PROVIDER: bindings.MODEL_PROVIDER,
    PRIMARY_MODEL: bindings.PRIMARY_MODEL,
    BRAND_NAME: bindings.BRAND_NAME,
    GEMINI_API_KEY: bindings.GEMINI_API_KEY,
    BROWSER_USE_API_KEY: bindings.BROWSER_USE_API_KEY,
  };
}

export default {
  async fetch(request, runtimeEnv): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/edge-health") {
      return Response.json({ status: "ok", edge: "cloudflare", container: "on_demand" });
    }

    const key = await rateLimitKey(request);
    const globalLimit = await runtimeEnv.API_RATE_LIMITER.limit({ key });
    if (!globalLimit.success) return Response.json({ error: "rate_limit_exceeded" }, { status: 429 });

    if (request.method === "POST" && url.pathname === "/v1/search") {
      const searchLimit = await runtimeEnv.SEARCH_RATE_LIMITER.limit({ key });
      if (!searchLimit.success) return Response.json({ error: "search_rate_limit_exceeded" }, { status: 429 });
    }

    return getContainer(runtimeEnv.FINDLY_API_CONTAINER, "primary").fetch(request);
  },
} satisfies ExportedHandler<FindlyBindings>;
