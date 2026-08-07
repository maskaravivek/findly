package ai.findly.app.ui

import ai.findly.app.data.Fulfillment
import ai.findly.app.data.Money
import ai.findly.app.data.Offer
import ai.findly.app.data.Price
import ai.findly.app.data.Product
import ai.findly.app.data.Retailer
import ai.findly.app.data.Seller
import ai.findly.app.data.Source
import org.junit.Assert.assertEquals
import org.junit.Test

class OfferLensesTest {
    @Test
    fun lowestPriceUsesKnownTotal() {
        val pickup = offer("pickup", 12_000, pickup = true, distanceKm = 2.0)
        val delivery = offer("delivery", 8_000)
        assertEquals("delivery", offersForLens(listOf(pickup, delivery), OfferLens.LowestPrice).first().offerId)
    }

    @Test
    fun fastestPrioritizesVerifiedPickupOverShipping() {
        val shipping = offer("shipping", 5_000)
        val pickup = offer("pickup", 12_000, pickup = true, distanceKm = 3.0)
        assertEquals("pickup", offersForLens(listOf(shipping, pickup), OfferLens.Fastest).first().offerId)
    }

    @Test
    fun recommendedPreservesBackendRanking() {
        val first = offer("first", 12_000)
        val second = offer("second", 8_000)
        assertEquals(listOf("first", "second"), offersForLens(listOf(first, second), OfferLens.Recommended).map { it.offerId })
    }

    private fun offer(id: String, total: Int, pickup: Boolean = false, distanceKm: Double? = null) = Offer(
        offerId = id,
        retailer = Retailer("home_depot_ca", "Home Depot Canada", "homedepot.ca"),
        seller = Seller(type = "first_party"),
        product = Product("Cordless drill"),
        price = Price(Money(total, "CAD"), total = Money(total, "CAD")),
        fulfillment = Fulfillment(
            pickup = pickup,
            delivery = false,
            shipping = !pickup,
            inStore = pickup,
            status = "in_stock",
            inventoryQuantity = if (pickup) 3 else null,
            storeDistanceKm = distanceKm,
        ),
        url = "https://example.com/$id",
        source = Source("browser_verified", "2026-08-07T00:00:00Z", true),
        confidence = .9,
    )
}
