package ai.findly.app.data
import retrofit2.http.Body
import retrofit2.http.POST
import retrofit2.http.Path
interface FindlyApi { @POST("v1/search") suspend fun search(@Body request: SearchRequest): SearchResponse; @POST("v1/search/{requestId}/clarification") suspend fun clarify(@Path("requestId") requestId: String, @Body answer: ClarificationAnswer): SearchResponse }
