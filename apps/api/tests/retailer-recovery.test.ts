import { describe, expect, it } from "vitest";
import { publicRetailerError } from "../src/retailers/retailer-errors.js";

describe("retailer failure recovery", () => {
  it("does not expose upstream diagnostics to the client", () => {
    expect(publicRetailerError("amazon", new Error("SearchAPI 500: secret diagnostic"))).toEqual({
      retailerId: "amazon",
      message: "Amazon live results are temporarily unavailable",
    });
  });

  it("keeps access challenges and timeouts distinct without exposing diagnostics", () => {
    expect(publicRetailerError("home_depot_ca", new Error("Retailer access challenge; not retried"))).toEqual({
      retailerId: "home_depot_ca",
      message: "Home Depot Canada requires verification right now",
    });
    expect(publicRetailerError("google_shopping", new Error("Request timed out after 20000ms")).message).toBe("Google Shopping did not respond in time");
  });

  it("falls back to a generic name for unknown retailers", () => {
    expect(publicRetailerError("some_shop", "boom").message).toBe("The retailer live results are temporarily unavailable");
  });
});
