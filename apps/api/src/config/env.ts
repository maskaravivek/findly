import "dotenv/config";
import { z } from "zod";
const bool = (fallback = false) => z.preprocess(v => v === undefined ? fallback : v === true || v === "true", z.boolean());
export const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"), PORT: z.coerce.number().int().positive().default(3000), HOST: z.string().default("0.0.0.0"),
  DEMO_MODE: bool(true), BRAND_NAME: z.string().default("Findly"), DEFAULT_COUNTRY: z.literal("CA").default("CA"), DEFAULT_REGION: z.string().default("ON"),
  RETAILER_MODE: z.enum(["demo", "live"]).optional(), ENABLE_DOCS: bool(true), RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  MODEL_PROVIDER: z.enum(["mock", "gemini", "openai"]).default("mock"), PRIMARY_MODEL: z.string().default(""), VISION_MODEL: z.string().default(""), FAST_MODEL: z.string().default(""),
  GEMINI_API_KEY: z.string().optional(), OPENAI_API_KEY: z.string().optional(),
  BROWSER_USE_API_KEY: z.string().min(1).optional(),
  RETAILER_CONCURRENCY: z.coerce.number().int().positive().default(2)
});
export type Env = z.infer<typeof EnvSchema>;
export const env = EnvSchema.parse(process.env);
export const retailerMode = (value: Env) => value.RETAILER_MODE ?? (value.DEMO_MODE ? "demo" : "live");
export function validateProductionConfig(value: Env): void {
  if (retailerMode(value) === "live" && !value.BROWSER_USE_API_KEY) throw new Error("BROWSER_USE_API_KEY is required for live retailer mode");
  if (value.MODEL_PROVIDER === "gemini" && !value.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is required");
  if (value.MODEL_PROVIDER === "openai" && !value.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is required");
}
