package ai.findly.app.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import ai.findly.app.BuildConfig
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.flow.first

private val Context.authDataStore by preferencesDataStore(name = "findly_auth")

@Singleton class AuthRepository @Inject constructor(@ApplicationContext private val context: Context, private val api: SupabaseAuthApi) {
    private val accessTokenKey = stringPreferencesKey("access_token")
    private val refreshTokenKey = stringPreferencesKey("refresh_token")
    private val expiresAtKey = stringPreferencesKey("expires_at_epoch_seconds")

    suspend fun authorizationHeader(): String? {
        try {
            return authorizationHeaderInternal()
        } catch (error: CancellationException) {
            throw error
        } catch (error: Exception) {
            throw AuthenticationUnavailableException(error)
        }
    }

    private suspend fun authorizationHeaderInternal(): String? {
        if (BuildConfig.SUPABASE_PUBLISHABLE_KEY.isBlank()) return null
        val preferences = context.authDataStore.data.first()
        val existing = preferences[accessTokenKey]
        val expiresAt = preferences[expiresAtKey]?.toLongOrNull() ?: 0L
        val now = System.currentTimeMillis() / 1_000
        if (existing != null && now < expiresAt - REFRESH_SKEW_SECONDS) return "Bearer $existing"

        val refreshToken = preferences[refreshTokenKey]
        val session = if (refreshToken != null) {
            runCatching {
                api.refreshSession(
                    BuildConfig.SUPABASE_PUBLISHABLE_KEY,
                    RefreshTokenRequest(refreshToken),
                )
            }.getOrElse { api.signInAnonymously(BuildConfig.SUPABASE_PUBLISHABLE_KEY) }
        } else {
            api.signInAnonymously(BuildConfig.SUPABASE_PUBLISHABLE_KEY)
        }
        saveSession(session, now)
        return "Bearer ${session.accessToken}"
    }

    private suspend fun saveSession(session: AuthResponse, nowEpochSeconds: Long) {
        context.authDataStore.edit {
            it[accessTokenKey] = session.accessToken
            it[refreshTokenKey] = session.refreshToken
            it[expiresAtKey] = (nowEpochSeconds + session.expiresIn).toString()
        }
    }

    private companion object {
        const val REFRESH_SKEW_SECONDS = 60L
    }
}
