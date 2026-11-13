import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env, retailerMode, validateProductionConfig, type Env } from "../config/env.js";
import { createModelProvider } from "../models/providers.js";
import { demoAdapters } from "../retailers/adapters.js";
import { createSearchApiAdapters } from "../retailers/searchapi/adapter.js";
import type { SearchApiClient } from "../retailers/searchapi/client.js";
import { createShoppingGraph } from "../graph/shopping-graph.js";
import { SearchService } from "./search-service.js";
import { searchRoutes } from "../routes/search.js";
import type { RetailerAdapter } from "@findly/retailer-sdk";
/** options.searchApiClient lets tests serve recorded SearchAPI responses without the network. */
export async function buildApp(config: Env = env, options: { searchApiClient?: SearchApiClient } = {}) {
  validateProductionConfig(config);
  const app = Fastify({ bodyLimit: 1_000_000, requestTimeout: 100_000, trustProxy: true, logger: { level: config.NODE_ENV === "test" ? "silent" : "info", redact: ["*.apiKey", "*.cookies", "*.GEMINI_API_KEY", "*.OPENAI_API_KEY", "*.ANTHROPIC_API_KEY", "*.SEARCHAPI_API_KEY"] }, genReqId: req => String(req.headers["x-correlation-id"] ?? crypto.randomUUID()) });
  await app.register(cors, { origin: false });
  await app.register(rateLimit, { global: true, max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  if (config.ENABLE_DOCS) { await app.register(swagger, { openapi: { info: { title: `${config.BRAND_NAME} API`, version: "0.1.0", description: "Shopping workflow API. Retailer data declares whether it was live verified." } } }); await app.register(swaggerUi, { routePrefix: "/docs" }); }
  const rawAdapters: RetailerAdapter[] = retailerMode(config) === "demo" ? demoAdapters : createSearchApiAdapters(config, options.searchApiClient);
  const graph = createShoppingGraph(createModelProvider(config), rawAdapters, { currency: config.DEFAULT_CURRENCY, country: config.DEFAULT_COUNTRY, maxToolCalls: config.AGENT_MAX_TOOL_CALLS, maxResultsPerCall: config.AGENT_MAX_RESULTS_PER_CALL });
  const service = new SearchService(graph);
  await app.register(searchRoutes, { service });
  app.get("/health", async () => ({ status: "ok", brand: config.BRAND_NAME }));
  app.get("/ready", async () => ({ status: "ready", state: "memory" }));
  return app;
}
