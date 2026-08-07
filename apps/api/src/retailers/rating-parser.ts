const compact = (value: string) => value.replace(/\s+/g, " ").trim();

export function parseRating(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  const parsed = typeof value === "number" ? value : Number(compact(value).match(/\d+(?:\.\d+)?/)?.[0]);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 5) return undefined;
  return Math.round(parsed * 10) / 10;
}

export function parseReviewCount(value: unknown): number | undefined {
  if (typeof value !== "number" && typeof value !== "string") return undefined;
  if (typeof value === "number") return Number.isSafeInteger(value) && value >= 0 ? value : undefined;
  const normalized = compact(value).replace(/[(),]/g, "");
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([KM])?/i);
  if (!match) return undefined;
  const multiplier = match[2]?.toUpperCase() === "M" ? 1_000_000 : match[2]?.toUpperCase() === "K" ? 1_000 : 1;
  const parsed = Math.round(Number(match[1]) * multiplier);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : undefined;
}

const ratingKeys = new Set(["averagerating", "ratingaverage", "rating", "ratingvalue", "stars"]);
const reviewKeys = new Set(["reviewcount", "reviews", "reviewsnumber", "numberofreviews", "totalreviews", "ratingcount"]);

export function extractProductRatingMetadata(value: unknown): { rating?: number; reviewCount?: number } {
  let rating: number | undefined;
  let reviewCount: number | undefined;

  const visit = (candidate: unknown, depth: number) => {
    if (depth > 5 || candidate === null || candidate === undefined || typeof candidate !== "object") return;
    for (const [key, child] of Object.entries(candidate as Record<string, unknown>)) {
      const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
      if (rating === undefined && ratingKeys.has(normalizedKey)) rating = parseRating(child);
      if (reviewCount === undefined && reviewKeys.has(normalizedKey)) reviewCount = parseReviewCount(child);
      if ((rating === undefined || reviewCount === undefined) && child !== null && typeof child === "object") visit(child, depth + 1);
      if (rating !== undefined && reviewCount !== undefined) return;
    }
  };

  visit(value, 0);
  return { ...(rating !== undefined ? { rating } : {}), ...(reviewCount !== undefined ? { reviewCount } : {}) };
}
