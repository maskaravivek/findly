import { describe, expect, it } from "vitest";
import { extractProductRatingMetadata, parseRating, parseReviewCount } from "../src/retailers/rating-parser.js";

describe("retailer rating parsing", () => {
  it("parses Amazon rating and abbreviated review text", () => {
    expect(parseRating("4.4 out of 5 stars")).toBe(4.4);
    expect(parseReviewCount("(17.9K)")).toBe(17_900);
  });

  it("extracts nested Home Depot product metadata", () => {
    expect(extractProductRatingMetadata({ reviews: { averageRating: "4.7", totalReviews: 1_248 } })).toEqual({
      rating: 4.7,
      reviewCount: 1_248,
    });
  });

  it("omits out-of-range or malformed values", () => {
    expect(parseRating("9.9 out of 5")).toBeUndefined();
    expect(parseReviewCount("many reviews")).toBeUndefined();
  });
});
