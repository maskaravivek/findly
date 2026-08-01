package ai.findly.app.data
import ai.findly.app.BuildConfig
import javax.inject.Inject
class ShoppingRepository @Inject constructor(private val api: FindlyApi, private val auth: AuthRepository) {
    suspend fun search(query: String, location: ShoppingLocationSettings): SearchResponse {
        validateClientConfiguration()
        return api.search(
            auth.authorizationHeader(),
            SearchRequest(
                text = query, postalCode = location.postalCode, latitude = location.latitude, longitude = location.longitude,
                locationAccuracyMeters = location.accuracyMeters, locationApproximate = location.approximate,
            ),
        )
    }

    suspend fun clarify(requestId: String, answer: String): SearchResponse {
        validateClientConfiguration()
        return api.clarify(requestId, auth.authorizationHeader(), ClarificationAnswer(answer))
    }

    private fun validateClientConfiguration() {
        val error = clientConfigurationError(
            apiBaseUrl = BuildConfig.API_BASE_URL,
            supabaseUrl = BuildConfig.SUPABASE_URL,
            supabasePublishableKey = BuildConfig.SUPABASE_PUBLISHABLE_KEY,
            isEmulator = isProbablyEmulator(),
        ) ?: return
        throw InvalidClientConfigurationException(error)
    }
}
