# Findly design system

This document is the implementation contract for Findly's Android experience. Branding values may change through configuration, but the product behavior and information hierarchy should remain consistent.

## Product scene

Findly is used one-handed, often while the shopper is standing in a bright store aisle, working on a home project, or comparing an item already in hand. The interface must remain legible at a glance, make local availability obvious, and distinguish verified retailer facts from recommendations. It should feel like a focused shopping utility, not a chat transcript or a marketplace catalogue.

## Experience principles

1. Answer the shopping decision first. Results lead with the best way to obtain the right product, not the workflow that produced it. Product relevance is a gate before price, rating, or speed can influence any lens.
2. Separate facts from judgment. Price, stock, distance, ratings, and freshness are retailer-derived facts; “Best overall” is Findly's deterministic ranking.
3. Make local usefulness visible. Store name, stock, distance, pickup, aisle, and bay outrank secondary metadata when available.
4. Never imply certainty the source did not provide. Missing ratings, quantities, shipping costs, or delivery times are omitted or explicitly described as unavailable.
5. Keep the primary path shallow. Location is automatic by default, manual postal code belongs in Settings, and a result opens the retailer rather than attempting a purchase.

## Visual language

Findly uses a calm, practical light theme with strong contrast and restrained colour.

| Semantic role | Current value | Use |
| --- | --- | --- |
| Primary / Evergreen | `#176B52` | Primary actions, selected state, brand accents |
| Background / Cream | `#F7F5EF` | Main app canvas |
| Ink | `#17201C` | Primary text |
| Muted ink | `#5D6661` | Secondary text and evidence |
| Live green | `#0E6245` | Verified and available states |
| Warning amber | `#8A5A00` | Approximate, cached, or unavailable-source states |
| Surface | `#FFFFFF` | Offer and status cards |
| Surface variant | `#EAEDE8` | Badges, passive controls, grouped metadata |

Colour never carries meaning alone. Every live, approximate, warning, and selected state also has a text label or icon with an accessible description.

## Layout and spacing

- Use a 4 dp spacing base: 4, 8, 12, 16, 20, 24, and 32 dp.
- Main screen horizontal padding is 20 dp.
- Primary touch targets are at least 48 dp high.
- Offer cards use 18 dp internal padding and a 20 dp corner radius.
- Prefer a single vertical reading path. Do not nest cards inside cards.
- Long tab labels use a horizontally scrollable Material 3 tab row instead of being compressed.
- Product images are supporting evidence, not the primary layout anchor; missing images must not leave an empty placeholder.

## Typography

Use the Android system typeface through Material 3 typography so text respects device settings and remains native. Headline styles identify the user task and result summary. Title styles identify products and section decisions. Body styles carry explanations. Label styles carry retailer, provenance, badges, and compact metadata. Use weight and spacing before increasing font size.

## Result lenses

The result surface has four lenses over the same verified offer set:

- **Recommended** shows up to three offers from the backend ranking. Exact identifiers and compatibility are gates; ratings with review volume, known total, fulfillment speed, confidence, and freshness determine the order.
- **Lowest price** shows up to three offers sorted by the known total in integer CAD minor units. Copy says “listed total” because unknown shipping and tax may change checkout.
- **Fastest** shows up to three currently available offers ordered by verified pickup, in-store availability, explicit same-day or next-day delivery, other retailer delivery estimates, and shipping. Out-of-stock and non-actionable offers stay in All. It never invents an ETA or promotes an unverified delivery phrase over verified local availability.
- **All** preserves the complete ranked result list and groups nearby-store offers separately from online offers.

Focused lenses use a visible badge and a short evidence line. The badge names the lens outcome; the evidence names the underlying facts. Ratings are shown only when extracted from retailer content and schema-validated. Review volume is displayed alongside the rating and is used to reduce the influence of ratings based on very few reviews.

## Offer card hierarchy

The offer card is a compact decision row, not a product-detail page. Lens headings already explain why results are ordered, so cards do not repeat large ranking badges or generic evidence.

1. Product image, retailer, and known total.
2. Product title, limited to two visual lines, followed by rating, review count, and exact model when present.
3. One plain-language fulfillment statement. Store, quantity, distance, aisle, and bay share one supporting line.
4. A concise caveat only when it changes the buying decision, such as marketplace seller or different bundle.
5. Freshness and provenance beside one compact “View item” action.

Do not use fulfillment chips as passive labels, repeat ratings in multiple places, show every raw adapter warning, or use a full-width outlined button when a compact trailing action is sufficient.

The card never contains a checkout or purchase action. Opening a retailer link is the terminal Findly action.

## States and copy

- Loading copy names the current retailer or stage without exposing model reasoning.
- Empty states suggest one concrete improvement such as a brand, model number, or clearer description.
- Partial failures preserve successful retailer results and summarize at most two actionable warnings.
- Cached data is labeled “Recently verified”; only an observation from the current lookup is labeled live.
- Approximate device location is explicitly labeled and directs the user to precise-location settings.
- A missing capability is omitted rather than represented by disabled or misleading UI.

## Interaction and motion

- Search is the primary action; the keyboard Search action submits it.
- Changing a result lens updates the offer list in place and does not trigger a retailer search.
- Lens selection and location preference survive normal Compose recomposition and configuration changes.
- Motion is optional and restrained. State transitions should complete within roughly 150–250 ms and must respect the device's reduced-motion setting.
- Back navigation and Settings use standard Android conventions.

## Accessibility and resilience

- Support system font scaling without clipping critical price, product, and availability text.
- Use flow layouts for fulfillment chips so they wrap on narrow screens.
- Provide text for all semantic states and content descriptions for actionable icons.
- Never make a fixed-height container hold variable product text.
- Keep usable contrast in bright ambient light.
- The screen remains useful with partial retailer failures, missing images, missing ratings, unknown inventory quantities, and cached results.

## Data trust boundary

Retailer pages are untrusted data. Browser extraction accepts only expected fields, validates them with schemas, and strips irrelevant content. Ratings are parsed deterministically from rendered retailer HTML or the browser-loaded product document. Findly does not send arbitrary page instructions to a model, does not expose secrets to browser extraction, and never allows webpage content to initiate a purchase.

Schema-valid retailer data is not automatically product-relevant. A shared deterministic matcher compares exact identifiers and normalized product terms before offers can enter ranking. A successful retailer search with no relevant products may try one bounded canonical query variant; access challenges, timeouts, and other retailer failures do not trigger that fallback. Rejected products produce a recoverable warning and never become a recommendation.
