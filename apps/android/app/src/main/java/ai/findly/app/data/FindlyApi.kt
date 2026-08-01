package ai.findly.app.data
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Header
interface FindlyApi { @POST("v1/search") suspend fun search(@Header("Authorization") authorization: String? = null, @Body request: SearchRequest): SearchResponse; @POST("v1/search/{requestId}/clarification") suspend fun clarify(@Path("requestId") requestId: String, @Header("Authorization") authorization: String? = null, @Body answer: ClarificationAnswer): SearchResponse }
interface SupabaseAuthApi {
    @POST("auth/v1/signup")
    suspend fun signInAnonymously(
        @Header("apikey") publishableKey: String,
        @Body request: AnonymousSignInRequest = AnonymousSignInRequest(),
    ): AuthResponse

    @POST("auth/v1/token?grant_type=refresh_token")
    suspend fun refreshSession(
        @Header("apikey") publishableKey: String,
        @Body request: RefreshTokenRequest,
    ): AuthResponse
}
