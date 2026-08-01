import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
export type Ranked = { offer: NormalizedRetailOffer; score: number; reasons: string[] };

export function rankOffers(request: ShoppingRequest, offers: NormalizedRetailOffer[]): Ranked[] {
  const urgent = request.urgency === "today" || request.urgency === "immediate" || request.fulfillmentPreferences.some(value => value === "pickup" || value === "in_store");
  return offers.map(offer => {
    let score = Math.round(offer.confidence * 40);
    const reasons: string[] = [];
    if (request.modelNumber && offer.product.modelNumber?.toLowerCase() === request.modelNumber.toLowerCase()) { score += 30; reasons.push("Exact model number"); }
    if (offer.seller.type === "first_party") { score += 8; reasons.push("First-party seller"); }
    if (offer.source.liveVerified) { score += 6; reasons.push("Verified during this search"); }
    if (offer.fulfillment.pickup && offer.fulfillment.status !== "out_of_stock") { score += urgent ? 28 : 14; reasons.push("Pickup available nearby"); }
    if (offer.fulfillment.inventoryQuantity !== undefined && offer.fulfillment.inventoryQuantity > 0) { score += 8; reasons.push("Store stock verified"); }
    if (offer.fulfillment.storeDistanceKm !== undefined) score += Math.max(0, 6 - Math.floor(offer.fulfillment.storeDistanceKm));
    if (urgent && !offer.fulfillment.pickup) score -= 8;
    score -= Math.min(20, Math.floor(offer.price.total.amountMinor / 10_000));
    return { offer, score, reasons };
  }).sort((a, b) => b.score - a.score || a.offer.price.total.amountMinor - b.offer.price.total.amountMinor);
}
