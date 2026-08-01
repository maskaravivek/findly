import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { checkpointerMode, env, retailerMode, validateProductionConfig, type Env } from "../config/env.js";
import { createModelProvider } from "../models/providers.js";
import { demoAdapters } from "../retailers/adapters.js";
import { BrowserbaseService } from "../browser/browser-service.js";
import { HomeDepotBrowserbaseAdapter } from "../retailers/home-depot-browserbase.js";
import { AmazonBrowserbaseAdapter } from "../retailers/amazon-browserbase.js";
import { CachedRetailerAdapter, PostgresRetailerSearchCache } from "../retailers/retailer-cache.js";
import { createCheckpointer, createShoppingGraph } from "../graph/shopping-graph.js";
import { SearchService } from "./search-service.js";
import { searchRoutes } from "../routes/search.js";
import { createRequireAuth } from "../auth/supabase-auth.js";
import postgres from "postgres";
import type { RetailerAdapter } from "@findly/retailer-sdk";
export async function buildApp(config: Env = env) {
  validateProductionConfig(config);
  const app = Fastify({ bodyLimit: 1_000_000, requestTimeout: 100_000, trustProxy: true, logger: { level: config.NODE_ENV === "test" ? "silent" : "info", redact: ["req.headers.authorization", "*.apiKey", "*.cookies", "*.DATABASE_URL", "*.GEMINI_API_KEY"] }, genReqId: req => String(req.headers["x-correlation-id"] ?? crypto.randomUUID()) });
  await app.register(cors, { origin: false });
  await app.register(rateLimit, { global: true, max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  if (config.ENABLE_DOCS) { await app.register(swagger, { openapi: { info: { title: `${config.BRAND_NAME} API`, version: "0.1.0", description: "Shopping workflow API. Retailer data declares whether it was live verified." } } }); await app.register(swaggerUi, { routePrefix: "/docs" }); }
  const mode = checkpointerMode(config);
  const checkpointer = await createCheckpointer(mode, config.DATABASE_URL, config.CHECKPOINT_SCHEMA);
  const browserService = retailerMode(config) === "live" ? new BrowserbaseService(config) : null;
  const rawAdapters: RetailerAdapter[] = retailerMode(config) === "demo" ? demoAdapters : [
    new HomeDepotBrowserbaseAdapter(browserService!),
    new AmazonBrowserbaseAdapter(browserService!)
  ];
  const retailerCache = config.RETAILER_CACHE_ENABLED && mode === "postgres" ? new PostgresRetailerSearchCache(config.DATABASE_URL!, config.CHECKPOINT_SCHEMA) : null;
  const adapters = retailerCache ? rawAdapters.map(adapter => new CachedRetailerAdapter(adapter, retailerCache, config.RETAILER_CACHE_TTL_SECONDS)) : rawAdapters;
  const graph = createShoppingGraph(createModelProvider(config), adapters, checkpointer);
  const service = new SearchService(graph);
  await app.register(searchRoutes, { service, requireAuth: createRequireAuth(config) });
  const readinessDb = mode === "postgres" ? postgres(config.DATABASE_URL!, { max: 1, idle_timeout: 10, connect_timeout: 10 }) : null;
  if (readinessDb) app.addHook("onClose", async () => { await readinessDb.end(); });
  if (retailerCache) app.addHook("onClose", async () => { await retailerCache.close(); });
  app.get("/health", async () => ({ status: "ok", brand: config.BRAND_NAME }));
  app.get("/ready", async (_request, reply) => { try { if (readinessDb) await readinessDb`select 1`; return { status: "ready", database: readinessDb ? "connected" : "memory" }; } catch { return reply.code(503).send({ status: "not_ready", database: "unavailable" }); } });
  return app;
}
