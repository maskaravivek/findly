import { Container, getContainer } from "@cloudflare/containers";
import { env } from "cloudflare:workers";
import { rateLimitKey } from "./rate-limit.js";

type FindlyBindings = {
  FINDLY_API_CONTAINER: DurableObjectNamespace<FindlyApiContainer>;
  API_RATE_LIMITER: RateLimit;
  SEARCH_RATE_LIMITER: RateLimit;
  DATABASE_URL: string;
  GEMINI_API_KEY: string;
  BROWSERBASE_API_KEY: string;
  BROWSERBASE_PROJECT_ID: string;
  NODE_ENV: string;
  HOST: string;
  PORT: string;
  DEMO_MODE: string;
  CHECKPOINTER_MODE: string;
  RETAILER_MODE: string;
  CHECKPOINT_SCHEMA: string;
  AUTH_MODE: string;
  SUPABASE_URL: string;
  ENABLE_DOCS: string;
  RATE_LIMIT_MAX: string;
  MODEL_PROVIDER: string;
  PRIMARY_MODEL: string;
  BRAND_NAME: string;
  BROWSER_PROXY_COUNTRY: string;
  BROWSER_PROXY_CITY: string;
  RETAILER_CACHE_ENABLED: string;
  RETAILER_CACHE_TTL_SECONDS: string;
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
    CHECKPOINTER_MODE: bindings.CHECKPOINTER_MODE,
    RETAILER_MODE: bindings.RETAILER_MODE,
    CHECKPOINT_SCHEMA: bindings.CHECKPOINT_SCHEMA,
    AUTH_MODE: bindings.AUTH_MODE,
    SUPABASE_URL: bindings.SUPABASE_URL,
    ENABLE_DOCS: bindings.ENABLE_DOCS,
    RATE_LIMIT_MAX: bindings.RATE_LIMIT_MAX,
    MODEL_PROVIDER: bindings.MODEL_PROVIDER,
    PRIMARY_MODEL: bindings.PRIMARY_MODEL,
    BRAND_NAME: bindings.BRAND_NAME,
    BROWSER_PROXY_COUNTRY: bindings.BROWSER_PROXY_COUNTRY,
    BROWSER_PROXY_CITY: bindings.BROWSER_PROXY_CITY,
    RETAILER_CACHE_ENABLED: bindings.RETAILER_CACHE_ENABLED,
    RETAILER_CACHE_TTL_SECONDS: bindings.RETAILER_CACHE_TTL_SECONDS,
    DATABASE_URL: bindings.DATABASE_URL,
    GEMINI_API_KEY: bindings.GEMINI_API_KEY,
    BROWSERBASE_API_KEY: bindings.BROWSERBASE_API_KEY,
    BROWSERBASE_PROJECT_ID: bindings.BROWSERBASE_PROJECT_ID,
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
