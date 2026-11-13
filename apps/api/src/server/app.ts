import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { env, retailerMode, validateProductionConfig, type Env } from "../config/env.js";
import { createModelProvider } from "../models/providers.js";
import { demoAdapters } from "../retailers/adapters.js";
import { BrowserUseBrowserService } from "../browser/browser-service.js";
import { HomeDepotAdapter } from "../retailers/home-depot.js";
import { AmazonBrowserAdapter } from "../retailers/amazon-browser.js";
import { createShoppingGraph } from "../graph/shopping-graph.js";
import { SearchService } from "./search-service.js";
import { searchRoutes } from "../routes/search.js";
import type { RetailerAdapter } from "@findly/retailer-sdk";
export async function buildApp(config: Env = env) {
  validateProductionConfig(config);
  const app = Fastify({ bodyLimit: 1_000_000, requestTimeout: 100_000, trustProxy: true, logger: { level: config.NODE_ENV === "test" ? "silent" : "info", redact: ["*.apiKey", "*.cookies", "*.GEMINI_API_KEY", "*.BROWSER_USE_API_KEY"] }, genReqId: req => String(req.headers["x-correlation-id"] ?? crypto.randomUUID()) });
  await app.register(cors, { origin: false });
  await app.register(rateLimit, { global: true, max: config.RATE_LIMIT_MAX, timeWindow: "1 minute" });
  if (config.ENABLE_DOCS) { await app.register(swagger, { openapi: { info: { title: `${config.BRAND_NAME} API`, version: "0.1.0", description: "Shopping workflow API. Retailer data declares whether it was live verified." } } }); await app.register(swaggerUi, { routePrefix: "/docs" }); }
  const browserService = retailerMode(config) === "live" ? new BrowserUseBrowserService(config) : null;
  const rawAdapters: RetailerAdapter[] = retailerMode(config) === "demo" ? demoAdapters : [
    new HomeDepotAdapter(),
    new AmazonBrowserAdapter(browserService!, config.DEFAULT_COUNTRY)
  ];
  const graph = createShoppingGraph(createModelProvider(config), rawAdapters);
  const service = new SearchService(graph);
  await app.register(searchRoutes, { service });
  app.get("/health", async () => ({ status: "ok", brand: config.BRAND_NAME }));
  app.get("/ready", async () => ({ status: "ready", state: "memory" }));
  return app;
}
