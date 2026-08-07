package ai.findly.app.ui

import ai.findly.app.data.Offer

enum class OfferLens(val label: String) {
    Recommended("Best"),
    LowestPrice("Cheapest"),
    Fastest("Fastest"),
    All("All"),
}

fun offersForLens(offers: List<Offer>, lens: OfferLens): List<Offer> = when (lens) {
    OfferLens.Recommended -> offers.take(3)
    OfferLens.LowestPrice -> offers.sortedWith(
        compareBy<Offer> { it.price.total.amountMinor }
            .thenByDescending { it.source.liveVerified }
            .thenByDescending { it.confidence },
    ).take(3)
    OfferLens.Fastest -> offers.sortedWith(
        compareBy<Offer> { fulfillmentSpeedBucket(it) }
            .thenBy { it.fulfillment.storeDistanceKm ?: Double.MAX_VALUE }
            .thenBy { it.price.total.amountMinor }
            .thenByDescending { it.source.liveVerified },
    ).take(3)
    OfferLens.All -> offers
}

fun lensBadge(lens: OfferLens, index: Int): String? = when (lens) {
    OfferLens.Recommended -> if (index == 0) "Best overall" else "Also recommended"
    OfferLens.LowestPrice -> if (index == 0) "Lowest price" else "Next lowest"
    OfferLens.Fastest -> if (index == 0) "Fastest option" else "Also fast"
    OfferLens.All -> null
}

fun lensEvidence(offer: Offer, lens: OfferLens, allOffers: List<Offer>): String? = when (lens) {
    OfferLens.Recommended -> listOfNotNull(
        offer.product.rating?.let { rating ->
            val count = offer.product.reviewCount
            if (count != null) "${oneDecimal(rating)} rating from ${formatCount(count)} reviews" else "${oneDecimal(rating)} rating"
        },
        pickupEvidence(offer),
        if (offer.source.liveVerified) "Verified now" else null,
    ).take(2).joinToString(" • ").ifBlank { "Strong balance of price and availability" }
    OfferLens.LowestPrice -> {
        val minimum = allOffers.minOfOrNull { it.price.total.amountMinor } ?: offer.price.total.amountMinor
        val difference = offer.price.total.amountMinor - minimum
        if (difference == 0) "Lowest listed total in these results" else "${moneyDifference(difference)} more than the lowest option"
    }
    OfferLens.Fastest -> pickupEvidence(offer)
        ?: offer.fulfillment.estimate?.let { "Retailer estimate: $it" }
        ?: if (offer.fulfillment.shipping) "Available for shipping; no delivery time was exposed" else "Availability timing is not exposed"
    OfferLens.All -> null
}

private fun fulfillmentSpeedBucket(offer: Offer): Int {
    val fulfillment = offer.fulfillment
    val estimate = fulfillment.estimate.orEmpty()
    return when {
        fulfillment.status == "out_of_stock" -> 7
        fulfillment.pickup -> 0
        fulfillment.inStore -> 1
        fulfillment.delivery && Regex("today|same.day", RegexOption.IGNORE_CASE).containsMatchIn(estimate) -> 2
        fulfillment.delivery && Regex("tomorrow|next.day", RegexOption.IGNORE_CASE).containsMatchIn(estimate) -> 3
        fulfillment.delivery && estimate.isNotBlank() -> 4
        fulfillment.shipping -> 5
        else -> 6
    }
}

private fun pickupEvidence(offer: Offer): String? {
    if (!offer.fulfillment.pickup && !offer.fulfillment.inStore) return null
    val stock = offer.fulfillment.inventoryQuantity?.takeIf { it > 0 }?.let { "$it in stock" }
    val distance = offer.fulfillment.storeDistanceKm?.let { "${oneDecimal(it)} km away" }
    return listOfNotNull(stock, if (offer.fulfillment.pickup) "Pickup available" else "Available in store", distance)
        .joinToString(" • ")
        .ifBlank { null }
}

private fun oneDecimal(value: Double) = String.format(java.util.Locale.CANADA, "%.1f", value)
private fun formatCount(value: Int) = java.text.NumberFormat.getIntegerInstance(java.util.Locale.CANADA).format(value)
private fun moneyDifference(amountMinor: Int) = java.text.NumberFormat.getCurrencyInstance(java.util.Locale.CANADA).apply {
    currency = java.util.Currency.getInstance("CAD")
}.format(amountMinor / 100.0)
