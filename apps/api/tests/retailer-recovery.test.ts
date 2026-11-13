import { describe, expect, it } from "vitest";
import { publicRetailerError } from "../src/retailers/retailer-errors.js";

describe("retailer failure recovery", () => {
  it("does not expose browser protocol errors to the client", () => {
    expect(publicRetailerError(
      "home_depot_ca",
      new Error("response.json: Protocol error (Network.getResponseBody): secret diagnostic")
    )).toEqual({
      retailerId: "home_depot_ca",
      message: "Home Depot live results are temporarily unavailable",
    });
  });

  it("keeps access challenges distinct without exposing diagnostics", () => {
    expect(publicRetailerError("home_depot_ca", new Error("Retailer access challenge; not retried"))).toEqual({
      retailerId: "home_depot_ca",
      message: "Home Depot requires verification right now",
    });
  });
});
