import "dotenv/config";
import { z } from "zod";
const bool = (fallback = false) => z.preprocess(v => v === undefined ? fallback : v === true || v === "true", z.boolean());
const int = (fallback: number) => z.coerce.number().int().positive().default(fallback);
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"), PORT: int(3000), HOST: z.string().default("0.0.0.0"),
  BRAND_NAME: z.string().default("Findly"),
  DEFAULT_COUNTRY: z.string().regex(/^[A-Z]{2}$/).default("US"), DEFAULT_CURRENCY: z.string().regex(/^[A-Z]{3}$/).default("USD"), DEFAULT_REGION: z.string().optional(),
  ENABLE_DOCS: bool(true), RATE_LIMIT_MAX: int(30),
  // "mock" exists for tests only; it never calls a model.
  MODEL_PROVIDER: z.enum(["anthropic", "mock"]).default("anthropic"), PRIMARY_MODEL: z.string().default(""),
  ANTHROPIC_API_KEY: z.string().optional(),
  // Required at startup (see validateConfig); optional in the schema so tests can inject a SearchApiClient instead.
  SEARCHAPI_API_KEY: z.string().min(1).optional(), SEARCHAPI_ENGINES: z.string().default("amazon_search,walmart_search,home_depot_search,bestbuy_search,google_shopping"),
  SEARCHAPI_TIMEOUT_MS: int(20_000), SEARCHAPI_CACHE_TTL_MS: z.coerce.number().int().nonnegative().default(300_000),
  AGENT_MAX_TOOL_CALLS: int(6), AGENT_MAX_RESULTS_PER_CALL: int(8)
});
export type Env = z.infer<typeof EnvSchema>;
export const env = EnvSchema.parse(process.env);
export const searchApiEngines = (value: Env) => value.SEARCHAPI_ENGINES.split(",").map(s => s.trim()).filter(Boolean);
/** hasSearchApiClient: a test injected its own SearchApiClient, so no SearchAPI key is needed. */
export function validateConfig(value: Env, options: { hasSearchApiClient?: boolean } = {}): void {
  if (!options.hasSearchApiClient && !value.SEARCHAPI_API_KEY) throw new Error("SEARCHAPI_API_KEY is required");
  if (value.MODEL_PROVIDER === "anthropic" && !value.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required");
}
