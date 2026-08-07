import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";
export type Ranked = { offer: NormalizedRetailOffer; score: number; reasons: string[] };

const knownTotalScore = (amountMinor: number, minimum: number, maximum: number) => {
  if (maximum <= minimum) return 30;
  return 30 * (1 - (amountMinor - minimum) / (maximum - minimum));
};

const ratingScore = (offer: NormalizedRetailOffer) => {
  const rating = offer.product.rating;
  if (rating === undefined) return 18;
  const count = offer.product.reviewCount ?? 0;
  const adjusted = (rating * count + 4 * 25) / (count + 25);
  return adjusted / 5 * 25;
};

const speedScore = (offer: NormalizedRetailOffer, urgent: boolean) => {
  const fulfillment = offer.fulfillment;
  const estimate = fulfillment.estimate?.toLowerCase() ?? "";
  if (fulfillment.pickup && fulfillment.status !== "out_of_stock") return urgent ? 40 : 32;
  if (fulfillment.inStore && fulfillment.status !== "out_of_stock") return urgent ? 35 : 28;
  if (fulfillment.delivery && /today|same.day/.test(estimate)) return urgent ? 34 : 30;
  if (fulfillment.delivery && /tomorrow|next.day/.test(estimate)) return urgent ? 25 : 24;
  if (fulfillment.delivery && estimate) return 18;
  if (fulfillment.shipping) return urgent ? 4 : 10;
  return 0;
};

const genericProductWords = new Set(["cordless", "power", "tool", "tools", "product", "products", "machine", "compatible", "kit"]);
const token = (value: string) => value.length > 4 && value.endsWith("s") ? value.slice(0, -1) : value;
const words = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean).map(token);

const productTypeScore = (request: ShoppingRequest, offer: NormalizedRetailOffer) => {
  const brandWords = new Set(words([request.manufacturer, ...request.preferredBrands].filter(Boolean).join(" ")));
  const anchors = new Set(
    words([request.category, ...request.possibleProductNames].filter(Boolean).join(" "))
      .filter(value => value.length >= 3 && !genericProductWords.has(value) && !brandWords.has(value))
  );
  if (!anchors.size) return { score: 0, matches: false };
  const titleWords = new Set(words(`${offer.product.title} ${offer.product.category ?? ""}`));
  const matched = [...anchors].filter(value => titleWords.has(value)).length;
  if (!matched) return { score: -120, matches: false };
  return { score: 20 + 10 * matched / anchors.size, matches: true };
};

export function rankOffers(request: ShoppingRequest, offers: NormalizedRetailOffer[]): Ranked[] {
  const urgent = request.urgency === "today" || request.urgency === "immediate" || request.fulfillmentPreferences.some(value => value === "pickup" || value === "in_store");
  const totals = offers.map(offer => offer.price.total.amountMinor);
  const minimumTotal = Math.min(...totals);
  const maximumTotal = Math.max(...totals);
  return offers.map(offer => {
    let score = offer.confidence * 15;
    const reasons: string[] = [];
    const typeMatch = productTypeScore(request, offer);
    score += typeMatch.score;
    if (typeMatch.matches) reasons.push("Matches the requested product type");
    const modelMatches = request.modelNumber && offer.product.modelNumber?.toLowerCase() === request.modelNumber.toLowerCase();
    if (modelMatches) { score += 100; reasons.push("Exact model number"); }
    else if (request.modelNumber && offer.product.modelNumber) score -= 75;

    const cost = knownTotalScore(offer.price.total.amountMinor, minimumTotal, maximumTotal);
    score += cost;
    if (offer.price.total.amountMinor === minimumTotal) reasons.push("Lowest listed total");

    const speed = speedScore(offer, urgent);
    score += speed;
    if (offer.fulfillment.pickup && offer.fulfillment.status !== "out_of_stock") reasons.push("Pickup available nearby");
    else if (offer.fulfillment.delivery && offer.fulfillment.estimate) reasons.push(offer.fulfillment.estimate);

    score += ratingScore(offer);
    if (offer.product.rating !== undefined) {
      reasons.push(`${offer.product.rating.toFixed(1)} rating${offer.product.reviewCount ? ` from ${offer.product.reviewCount} reviews` : ""}`);
    }
    if (offer.seller.type === "first_party") score += 3;
    if (offer.source.liveVerified) { score += 5; reasons.push("Verified during this search"); }
    if ((offer.fulfillment.inventoryQuantity ?? 0) > 0) { score += 4; reasons.push("Store stock verified"); }
    if (offer.fulfillment.storeDistanceKm !== undefined) score += Math.max(0, 4 - offer.fulfillment.storeDistanceKm / 5);
    return { offer, score: Math.round(score * 10) / 10, reasons };
  }).sort((a, b) => b.score - a.score || a.offer.price.total.amountMinor - b.offer.price.total.amountMinor);
}
