package ai.findly.app.data
import kotlinx.serialization.Serializable
import kotlinx.serialization.SerialName
@Serializable data class SearchRequest(
    val text: String? = null, val barcode: String? = null, val imageIds: List<String> = emptyList(),
    val selectedStoreId: String? = null, val postalCode: String? = null,
    val latitude: Double? = null, val longitude: Double? = null,
    val locationAccuracyMeters: Double? = null, val locationApproximate: Boolean? = null,
)
@Serializable data class ClarificationAnswer(val answer: String)
@Serializable data class AnonymousSignInRequest(val data: Map<String, String> = emptyMap())
@Serializable data class RefreshTokenRequest(@SerialName("refresh_token") val refreshToken: String)
@Serializable data class AuthResponse(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String,
    @SerialName("expires_in") val expiresIn: Long,
)
@Serializable data class Money(val amountMinor: Int, val currency: String)
@Serializable data class Source(val kind: String, val observedAt: String, val liveVerified: Boolean)
@Serializable data class Product(val title: String, val brand: String? = null, val modelNumber: String? = null, val variant: String? = null, val imageUrl: String? = null)
@Serializable data class Retailer(val id: String, val name: String, val domain: String)
@Serializable data class Seller(val name: String? = null, val type: String)
@Serializable data class Price(val item: Money, val shipping: Money? = null, val total: Money)
@Serializable data class Fulfillment(
    val pickup: Boolean, val delivery: Boolean, val shipping: Boolean, val inStore: Boolean, val status: String,
    val inventoryQuantity: Int? = null, val storeId: String? = null, val storeName: String? = null,
    val storeDistanceKm: Double? = null, val aisle: String? = null, val bay: String? = null, val estimate: String? = null,
)
@Serializable data class Offer(val offerId: String, val retailer: Retailer, val seller: Seller, val product: Product, val price: Price, val fulfillment: Fulfillment, val url: String, val source: Source, val confidence: Double, val warnings: List<String> = emptyList())
@Serializable data class Recommendation(val headline: String, val explanation: String, val bestOfferId: String? = null)
@Serializable data class Clarification(val type: String, val requestId: String, val question: String, val options: List<String> = emptyList(), val reason: String? = null)
@Serializable data class SearchResponse(val requestId: String, val threadId: String, val status: String, val clarification: Clarification? = null, val offers: List<Offer> = emptyList(), val recommendation: Recommendation? = null, val warnings: List<String> = emptyList())
