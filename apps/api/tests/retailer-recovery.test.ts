import { describe, expect, it, vi } from "vitest";
import { readHomeDepotSearchPayload } from "../src/retailers/home-depot-browserbase.js";
import { publicRetailerError } from "../src/retailers/retailer-errors.js";

describe("retailer failure recovery", () => {
  it("replays Home Depot search data when the intercepted body is no longer available", async () => {
    const primary = vi.fn().mockRejectedValue(
      new Error("Protocol error (Network.getResponseBody): No resource with given identifier found")
    );
    const replay = vi.fn().mockResolvedValue({ products: [{ code: "123" }] });

    await expect(readHomeDepotSearchPayload(primary, replay)).resolves.toEqual({ products: [{ code: "123" }] });
    expect(primary).toHaveBeenCalledOnce();
    expect(replay).toHaveBeenCalledOnce();
  });

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
