// "The LLM proposes, code verifies": the model picks candidates, but the final order is
// deterministic, explainable, and testable, and the price ceiling is enforced here, not trusted to the prompt.
import type { Offer } from "./searchapi.js";

const PRIOR_RATING = 4.0; // what we assume about a product before reading its reviews
const PRIOR_WEIGHT = 50;  // how many reviews it takes to outweigh that assumption

export function rankShortlist(offers: Offer[], opts: { maxPrice?: number | undefined } = {}): Offer[] {
  const within = offers.filter(o => opts.maxPrice === undefined || o.price <= opts.maxPrice);
  if (!within.length) return [];
  // Note: offers in different currencies are compared by number only; keep one country per request.
  const min = Math.min(...within.map(o => o.price)), max = Math.max(...within.map(o => o.price));

  const score = (o: Offer) => {
    const price = max === min ? 1 : (max - o.price) / (max - min); // 1 = cheapest, 0 = most expensive
    // Review-count prior (a Bayesian average): 5.0 stars from 3 reviews should not beat 4.6 from 2,000.
    const reviews = o.reviews ?? 0;
    const rating = ((o.rating ?? PRIOR_RATING) * reviews + PRIOR_RATING * PRIOR_WEIGHT) / (reviews + PRIOR_WEIGHT) / 5;
    const fulfilment = o.pickup ? 1 : o.delivery ? 0.5 : 0; // pickup today beats an unknown delivery date
    return 0.5 * price + 0.35 * rating + 0.15 * fulfilment;
  };
  return within
    .map(offer => ({ offer, score: score(offer) }))
    .sort((a, b) => b.score - a.score || a.offer.price - b.offer.price)
    .map(r => r.offer);
}
