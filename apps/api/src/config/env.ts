import "dotenv/config";
import { z } from "zod";
const bool = (fallback = false) => z.preprocess(v => v === undefined ? fallback : v === true || v === "true", z.boolean());
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"), PORT: z.coerce.number().int().positive().default(3000), HOST: z.string().default("0.0.0.0"),
  DEMO_MODE: bool(true), BRAND_NAME: z.string().default("Findly"), DEFAULT_COUNTRY: z.literal("CA").default("CA"), DEFAULT_REGION: z.string().default("ON"),
  CHECKPOINTER_MODE: z.enum(["memory", "postgres"]).optional(), RETAILER_MODE: z.enum(["demo", "live"]).optional(), CHECKPOINT_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/).default("findly_internal"),
  AUTH_MODE: z.enum(["off", "supabase"]).default("off"), SUPABASE_URL: z.url().optional(), SUPABASE_PUBLISHABLE_KEY: z.string().optional(), ENABLE_DOCS: bool(true), RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  MODEL_PROVIDER: z.enum(["mock", "gemini", "openai"]).default("mock"), PRIMARY_MODEL: z.string().default(""), VISION_MODEL: z.string().default(""), FAST_MODEL: z.string().default(""),
  GEMINI_API_KEY: z.string().optional(), OPENAI_API_KEY: z.string().optional(), DATABASE_URL: z.string().optional(), BROWSERBASE_API_KEY: z.string().optional(), BROWSERBASE_PROJECT_ID: z.string().optional(), BROWSER_DEBUG_URLS: bool(),
  BROWSER_PROXY_COUNTRY: z.string().regex(/^[A-Z]{2}$/).optional(), BROWSER_PROXY_CITY: z.string().optional(),
  RETAILER_CONCURRENCY: z.coerce.number().int().positive().default(2), RETAILER_CACHE_ENABLED: bool(), RETAILER_CACHE_TTL_SECONDS: z.coerce.number().int().positive().max(3_600).default(300)
});
export type Env = z.infer<typeof EnvSchema>;
export const env = EnvSchema.parse(process.env);
export const checkpointerMode = (value: Env) => value.CHECKPOINTER_MODE ?? (value.DEMO_MODE ? "memory" : "postgres");
export const retailerMode = (value: Env) => value.RETAILER_MODE ?? (value.DEMO_MODE ? "demo" : "live");
export function validateProductionConfig(value: Env): void {
  if (checkpointerMode(value) === "postgres" && !value.DATABASE_URL) throw new Error("DATABASE_URL is required for PostgreSQL checkpointing");
  if (retailerMode(value) === "live" && (!value.BROWSERBASE_API_KEY || !value.BROWSERBASE_PROJECT_ID)) throw new Error("Browserbase credentials are required for live retailer mode");
  if (value.AUTH_MODE === "supabase" && !value.SUPABASE_URL) throw new Error("SUPABASE_URL is required for Supabase authentication");
  if (value.MODEL_PROVIDER === "gemini" && !value.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  if (value.MODEL_PROVIDER === "openai" && !value.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
}
