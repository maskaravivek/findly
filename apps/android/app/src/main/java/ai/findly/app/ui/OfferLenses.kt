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

fun lensEvidence(offer: Offer, lens: OfferLens, allOffers: List<Offer>): String? = when (lens) {
    OfferLens.Recommended -> null
    OfferLens.LowestPrice -> {
        val minimum = allOffers.minOfOrNull { it.price.total.amountMinor } ?: offer.price.total.amountMinor
        val difference = offer.price.total.amountMinor - minimum
        if (difference == 0) null else "${moneyDifference(difference)} more than the lowest option"
    }
    OfferLens.Fastest -> null
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

private fun moneyDifference(amountMinor: Int) = java.text.NumberFormat.getCurrencyInstance(java.util.Locale.CANADA).apply {
    currency = java.util.Currency.getInstance("CAD")
}.format(amountMinor / 100.0)
