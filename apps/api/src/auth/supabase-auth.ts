import type { FastifyReply, FastifyRequest } from "fastify";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { Env } from "../config/env.js";

declare module "fastify" { interface FastifyRequest { userId?: string } }

export type RequireAuth = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export function createRequireAuth(config: Env): RequireAuth {
  if (config.AUTH_MODE === "off") return async () => undefined;
  const baseUrl = config.SUPABASE_URL!.replace(/\/$/, "");
  const issuer = `${baseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));
  return async (request, reply) => {
    const header = request.headers.authorization;
    if (!header?.startsWith("Bearer ")) { await reply.code(401).send({ error: "authentication_required" }); return; }
    try {
      const { payload } = await jwtVerify(header.slice(7), jwks, { issuer, audience: "authenticated" });
      if (!payload.sub) throw new Error("JWT subject missing");
      request.userId = payload.sub;
    } catch {
      await reply.code(401).send({ error: "invalid_access_token" });
    }
  };
}
