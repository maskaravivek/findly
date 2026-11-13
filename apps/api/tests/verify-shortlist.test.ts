import { describe, expect, it } from "vitest";
import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
import { verifyAgentShortlist } from "../src/products/verify-shortlist.js";
import { offer, request } from "./agent-fixtures.js";

const headphones: ShoppingRequest = {
  ...request, originalQuery: "wireless noise cancelling headphones under $200 for running",
  possibleProductNames: ["wireless noise cancelling headphones"], category: "headphones",
  maximumPrice: { amountMinor: 20_000, currency: "USD" },
};
const priced = (id: string, title: string, amountMinor: number, currency = "USD", extra: Partial<NormalizedRetailOffer["product"]> = {}): NormalizedRetailOffer => {
  const base = offer(id, "amazon", title);
  return { ...base, product: { ...base.product, ...extra }, price: { item: { amountMinor, currency }, total: { amountMinor, currency } } };
};

describe("verifyAgentShortlist", () => {
  it("keeps differently-worded products the model chose (earbuds for headphones)", () => {
    const result = verifyAgentShortlist(headphones, [priced("e1", "Beats Powerbeats Pro Wireless Earbuds", 17_999), priced("e2", "Shokz OpenRun Pro", 15_999)]);
    expect(result.kept.map(o => o.offerId)).toEqual(["e1", "e2"]);
    expect(result.dropped).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.coverage.find(c => c.offerId === "e2")?.coverage).toBe(0);
  });

  it("drops offers above the price cap in the same currency", () => {
    const result = verifyAgentShortlist(headphones, [priced("a", "Sony WH-1000XM5 Headphones", 39_999), priced("b", "Bose QC Headphones", 20_001), priced("c", "JBL Headphones", 20_000)]);
    expect(result.kept.map(o => o.offerId)).toEqual(["c"]);
    expect(result.dropped.map(d => [d.offer.offerId, d.rule])).toEqual([["a", "price_limit"], ["b", "price_limit"]]);
    expect(result.warnings).toEqual(["Excluded 2 offers above the $200 price limit"]);
  });

  it("keeps offers in another currency and warns that the limit was not applied", () => {
    const result = verifyAgentShortlist(headphones, [priced("cad", "Sony Headphones", 99_999, "CAD")]);
    expect(result.kept.map(o => o.offerId)).toEqual(["cad"]);
    expect(result.warnings).toEqual(["Price limit not applied to CAD offers"]);
  });

  it("enforces an exact model number", () => {
    const exact: ShoppingRequest = { ...request, modelNumber: "DCD791D2" };
    const result = verifyAgentShortlist(exact, [priced("m1", "DEWALT 20V Drill", 9_900, "USD", { modelNumber: "DCD791D2" }), priced("m2", "DEWALT 20V Drill DCD771C2", 7_900)]);
    expect(result.kept.map(o => o.offerId)).toEqual(["m1"]);
    expect(result.dropped).toMatchObject([{ rule: "exact_identifier" }]);
    expect(result.warnings).toEqual(["Excluded 1 offer that did not match the requested model number or barcode"]);
  });

  it("drops excluded brands and retailers case-insensitively", () => {
    const avoid: ShoppingRequest = { ...headphones, excludedBrands: ["BEATS"], excludedRetailers: ["Walmart"] };
    const walmart = { ...priced("w", "Sony Headphones", 9_900), retailer: { id: "walmart", name: "Walmart", domain: "walmart.com" } };
    const result = verifyAgentShortlist(avoid, [
      priced("b1", "Beats Studio Buds", 9_900), priced("b2", "Studio Buds", 9_900, "USD", { brand: "beats" }),
      priced("ok", "Case compatible with Beats Studio Buds", 1_999), walmart,
    ]);
    expect(result.kept.map(o => o.offerId)).toEqual(["ok"]);
    expect(result.warnings).toEqual(["Excluded 1 offer from retailers you asked to avoid", "Excluded 2 offers from brands you asked to avoid"]);
  });
});
