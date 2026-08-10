import type { NormalizedRetailOffer, ShoppingRequest } from "@findly/contracts";

export type ProductRelevance = {
  matches: boolean;
  coverage: number;
  matchedTerms: string[];
  reason: "exact_identifier" | "product_terms" | "no_product_terms" | "unrelated";
};

const genericProductWords = new Set([
  "compatible", "cordless", "find", "item", "kit", "machine", "need", "power", "product", "products",
  "set", "something", "thing", "tool", "tools", "want", "with",
]);

const rawWords = (value: string) => value
  .normalize("NFKD")
  .toLowerCase()
  .split(/[^a-z0-9]+/)
  .filter(Boolean);

const canonicalToken = (value: string) => {
  if (value.length > 5 && value.endsWith("ing")) {
    let root = value.slice(0, -3);
    if (root.length > 3 && root.at(-1) === root.at(-2) && !root.endsWith("ll") && !root.endsWith("ss")) root = root.slice(0, -1);
    return root.endsWith("v") ? `${root}e` : root;
  }
  if (value.length > 4 && value.endsWith("ied")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("ed")) return value.slice(0, -2);
  if (value.length > 4 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("s") && !value.endsWith("ss")) return value.slice(0, -1);
  return value;
};

const tokenVariants = (value: string) => {
  const variants = new Set([value]);
  if (value.length > 5 && value.endsWith("ing")) {
    const root = value.slice(0, -3);
    variants.add(root);
    if (root.length > 3 && root.at(-1) === root.at(-2)) variants.add(root.slice(0, -1));
    if (root.endsWith("v")) variants.add(`${root}e`);
  }
  if (value.length > 4 && value.endsWith("ied")) variants.add(`${value.slice(0, -3)}y`);
  else if (value.length > 4 && value.endsWith("ed")) {
    const root = value.slice(0, -2);
    variants.add(root);
    variants.add(`${root}e`);
  }
  if (value.length > 4 && value.endsWith("ies")) variants.add(`${value.slice(0, -3)}y`);
  else if (value.length > 4 && value.endsWith("es")) variants.add(value.slice(0, -2));
  else if (value.length > 4 && value.endsWith("s")) variants.add(value.slice(0, -1));
  return variants;
};

const identifier = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const exactIdentifierMatch = (request: ShoppingRequest, offer: NormalizedRetailOffer) => {
  const requested = [request.modelNumber, request.barcode].filter((value): value is string => Boolean(value)).map(identifier);
  if (!requested.length) return null;
  const offered = [offer.product.modelNumber, offer.product.manufacturerPartNumber, offer.product.upc, offer.product.gtin, offer.product.ean]
    .filter((value): value is string => Boolean(value))
    .map(identifier);
  const title = identifier(offer.product.title);
  return requested.some(value => offered.includes(value) || title.includes(value));
};

export function assessProductRelevance(request: ShoppingRequest, offer: NormalizedRetailOffer): ProductRelevance {
  const exactMatch = exactIdentifierMatch(request, offer);
  if (exactMatch !== null) {
    return exactMatch
      ? { matches: true, coverage: 1, matchedTerms: [], reason: "exact_identifier" }
      : { matches: false, coverage: 0, matchedTerms: [], reason: "unrelated" };
  }

  const brandWords = new Set(rawWords([request.manufacturer, ...request.preferredBrands].filter(Boolean).join(" ")));
  const source = [request.category, ...request.possibleProductNames].filter(Boolean).join(" ") || request.originalQuery || "";
  const anchorGroups = rawWords(source)
    .filter(value => value.length >= 3 && !genericProductWords.has(value) && !brandWords.has(value))
    .map(value => ({ value, variants: tokenVariants(value) }));
  if (!anchorGroups.length) return { matches: false, coverage: 0, matchedTerms: [], reason: "no_product_terms" };

  const offerWords = rawWords(`${offer.product.title} ${offer.product.category ?? ""}`);
  const offerVariants = new Set(offerWords.flatMap(value => [...tokenVariants(value)]));
  const matchedTerms = anchorGroups.filter(group => [...group.variants].some(value => offerVariants.has(value))).map(group => group.value);
  return matchedTerms.length
    ? { matches: true, coverage: matchedTerms.length / anchorGroups.length, matchedTerms, reason: "product_terms" }
    : { matches: false, coverage: 0, matchedTerms: [], reason: "unrelated" };
}

export function partitionRelevantOffers(request: ShoppingRequest, offers: NormalizedRetailOffer[]) {
  const relevant: NormalizedRetailOffer[] = [];
  const rejected: NormalizedRetailOffer[] = [];
  for (const offer of offers) {
    (assessProductRelevance(request, offer).matches ? relevant : rejected).push(offer);
  }
  return { relevant, rejected };
}

export function buildRetailerSearchQueries(request: ShoppingRequest) {
  const exact = request.modelNumber ?? request.barcode;
  if (exact) return [exact];
  const candidates = [...request.possibleProductNames, request.category, request.originalQuery]
    .filter((value): value is string => Boolean(value?.trim()));
  const queries: string[] = [];
  const add = (value: string) => {
    const clean = value.trim().replace(/\s+/g, " ");
    if (clean && !queries.some(existing => existing.toLowerCase() === clean.toLowerCase())) queries.push(clean);
  };
  for (const candidate of candidates) {
    add(candidate);
    const canonical = rawWords(candidate).map(canonicalToken);
    const concise = canonical.filter(value => !genericProductWords.has(value));
    if (concise.length) add(concise.join(" "));
    if (canonical.length) add(canonical.join(" "));
  }
  return queries.slice(0, 3).length ? queries.slice(0, 3) : ["product"];
}
