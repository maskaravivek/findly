import { buildApp } from "./app.js";
import { env } from "../config/env.js";
const app = await buildApp();
await app.listen({ host: env.HOST, port: env.PORT });
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void app.close().finally(() => process.exit(0)));
