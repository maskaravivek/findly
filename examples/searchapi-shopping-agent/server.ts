// The agent as an HTTP API: validate the request, run the loop, return shortlist + reasoning + trace.
import Fastify from "fastify";
import { z } from "zod";
import { runShoppingAgent } from "./agent.js";

for (const key of ["SEARCHAPI_API_KEY", "ANTHROPIC_API_KEY"]) {
  if (!process.env[key]) throw new Error(`Set ${key} before starting the server`);
}

const SearchBody = z.object({
  query: z.string().trim().min(3).max(300),
  country: z.string().length(2).optional(), // ISO code, e.g. "US", "GB"
  maxPrice: z.number().positive().optional(),
});

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));

app.post("/search", async (request, reply) => {
  const body = SearchBody.safeParse(request.body);
  if (!body.success) return reply.code(400).send({ error: z.prettifyError(body.error) });
  const { query, country, maxPrice } = body.data;
  return runShoppingAgent(query, { country, maxPrice });
});

await app.listen({ port: Number(process.env.PORT ?? 3000), host: "127.0.0.1" });
