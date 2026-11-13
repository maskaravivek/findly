package ai.findly.app.data
import ai.findly.app.BuildConfig
import javax.inject.Inject
class ShoppingRepository @Inject constructor(private val api: FindlyApi) {
    suspend fun search(query: String, location: ShoppingLocationSettings): SearchResponse {
        validateClientConfiguration()
        return api.search(
            SearchRequest(
                text = query, postalCode = location.postalCode, latitude = location.latitude, longitude = location.longitude,
                locationAccuracyMeters = location.accuracyMeters, locationApproximate = location.approximate,
            ),
        )
    }

    suspend fun clarify(requestId: String, answer: String): SearchResponse {
        validateClientConfiguration()
        return api.clarify(requestId, ClarificationAnswer(answer))
    }

    private fun validateClientConfiguration() {
        val error = clientConfigurationError(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            isEmulator = isProbablyEmulator(),
        ) ?: return
        throw InvalidClientConfigurationException(error)
    }
}
