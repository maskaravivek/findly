import { describe, expect, it } from "vitest";
import { ShoppingRequestSchema } from "@findly/contracts";
import { MockModelProvider } from "../src/models/providers.js";

describe("retailer search planning", () => {
  it("provides a concise canonical fallback for verbose product wording", async () => {
    const request = ShoppingRequestSchema.parse({
      intent: "find_product_for_task", originalQuery: "drilling machine", possibleProductNames: ["drilling machine"],
      requiredFeatures: [], optionalFeatures: [], excludedFeatures: [], existingEquipment: [], compatibilityConstraints: [],
      preferredBrands: [], excludedBrands: [], preferredRetailers: [], excludedRetailers: [], currency: "CAD",
      urgency: "no_preference", fulfillmentPreferences: [], clarificationNeeded: false, confidence: 0.8,
    });

    const plan = await new MockModelProvider().generateSearchPlan({ request });

    expect(plan.queries.slice(0, 2)).toEqual(["drilling machine", "drill"]);
  });
});
