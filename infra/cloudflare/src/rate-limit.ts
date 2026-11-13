export const rateLimitKey = async (request: Request) => {
  const actor = `ip:${request.headers.get("cf-connecting-ip") ?? "unknown"}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(actor));
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
};
