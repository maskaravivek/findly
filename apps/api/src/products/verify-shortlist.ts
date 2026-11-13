// Verification for the agent path. The model already chose from real retailer results and grounding is
// enforced by validateShortlist, so this checks only what the model can get wrong against the request's
// hard constraints: exact identifiers, the price cap and exclusions. It does not re-judge product type.
import type { Money, NormalizedRetailOffer, ShoppingRequest } from "../contracts.js";
import { assessProductRelevance } from "./product-relevance.js";

export type ShortlistRule = "exact_identifier" | "price_limit" | "excluded_retailer" | "excluded_brand";
export type ShortlistVerification = {
  kept: NormalizedRetailOffer[];
  dropped: Array<{ offer: NormalizedRetailOffer; rule: ShortlistRule }>;
  warnings: string[];
  /** Term coverage per kept offer; informational only, never used to reject. */
  coverage: Array<{ offerId: string; coverage: number }>;
};

const normalize = (value: string) => value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

export function formatPriceLimit(money: Money): string {
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency: money.currency }).resolvedOptions().maximumFractionDigits ?? 2;
    const major = money.amountMinor / 10 ** digits;
    return new Intl.NumberFormat("en", { style: "currency", currency: money.currency, minimumFractionDigits: Number.isInteger(major) ? 0 : digits }).format(major);
  } catch {
    return `${(money.amountMinor / 100).toFixed(2)} ${money.currency}`;
  }
}

const plural = (count: number) => `${count} ${count === 1 ? "offer" : "offers"}`;

function brandExcluded(offer: NormalizedRetailOffer, excluded: string[]) {
  if (offer.product.brand) return excluded.includes(normalize(offer.product.brand));
  // No structured brand: only the leading words of the title count, so "case for Apple iPhone" is not an Apple product.
  const title = normalize(offer.product.title);
  return excluded.some(brand => title === brand || title.startsWith(`${brand} `));
}

export function verifyAgentShortlist(request: ShoppingRequest, offers: NormalizedRetailOffer[]): ShortlistVerification {
  const hasExactIdentifier = Boolean(request.modelNumber || request.barcode);
  const limit = request.maximumPrice;
  const excludedRetailers = request.excludedRetailers.map(normalize).filter(Boolean);
  const excludedBrands = request.excludedBrands.map(normalize).filter(Boolean);
  const kept: NormalizedRetailOffer[] = [];
  const dropped: ShortlistVerification["dropped"] = [];
  const coverage: ShortlistVerification["coverage"] = [];
  const unpricedCurrencies = new Set<string>();

  for (const offer of offers) {
    const relevance = assessProductRelevance(request, offer);
    let rule: ShortlistRule | undefined;
    if (hasExactIdentifier && relevance.reason === "unrelated") rule = "exact_identifier";
    else if (excludedRetailers.length && [offer.retailer.id, offer.retailer.name].some(value => excludedRetailers.includes(normalize(value)))) rule = "excluded_retailer";
    else if (excludedBrands.length && brandExcluded(offer, excludedBrands)) rule = "excluded_brand";
    else if (limit) {
      if (offer.price.total.currency !== limit.currency) unpricedCurrencies.add(offer.price.total.currency);
      else if (offer.price.total.amountMinor > limit.amountMinor) rule = "price_limit";
    }
    if (rule) dropped.push({ offer, rule });
    else { kept.push(offer); coverage.push({ offerId: offer.offerId, coverage: relevance.coverage }); }
  }

  const count = (rule: ShortlistRule) => dropped.filter(d => d.rule === rule).length;
  const warnings: string[] = [];
  if (count("exact_identifier")) warnings.push(`Excluded ${plural(count("exact_identifier"))} that did not match the requested model number or barcode`);
  if (count("excluded_retailer")) warnings.push(`Excluded ${plural(count("excluded_retailer"))} from retailers you asked to avoid`);
  if (count("excluded_brand")) warnings.push(`Excluded ${plural(count("excluded_brand"))} from brands you asked to avoid`);
  if (count("price_limit") && limit) warnings.push(`Excluded ${plural(count("price_limit"))} above the ${formatPriceLimit(limit)} price limit`);
  for (const currency of unpricedCurrencies) warnings.push(`Price limit not applied to ${currency} offers`);
  return { kept, dropped, warnings, coverage };
}
