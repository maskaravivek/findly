package ai.findly.app.di
import ai.findly.app.BuildConfig
import ai.findly.app.data.FindlyApi
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
@Module @InstallIn(SingletonComponent::class) object AppModule {
    @Provides @Singleton fun json() = Json { ignoreUnknownKeys = true; explicitNulls = false }
    @Provides @Singleton fun api(json: Json): FindlyApi = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(findlyHttpClient())
        .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(FindlyApi::class.java)

}

internal const val FINDLY_CALL_TIMEOUT_SECONDS = 120L
internal const val FINDLY_READ_TIMEOUT_SECONDS = 105L

internal fun findlyHttpClient(): OkHttpClient = OkHttpClient.Builder()
    .connectTimeout(15, TimeUnit.SECONDS)
    .writeTimeout(30, TimeUnit.SECONDS)
    .readTimeout(FINDLY_READ_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .callTimeout(FINDLY_CALL_TIMEOUT_SECONDS, TimeUnit.SECONDS)
    .build()
