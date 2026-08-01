package ai.findly.app.data

import android.os.Build
import java.net.URI

class AuthenticationUnavailableException(cause: Throwable) :
    RuntimeException("Unable to establish an authenticated Findly session", cause)

class InvalidClientConfigurationException(message: String) : RuntimeException(message)

internal fun clientConfigurationError(
    apiBaseUrl: String,
    supabaseUrl: String,
    supabasePublishableKey: String,
    isEmulator: Boolean,
): String? {
    if (!isEmulator && (apiBaseUrl.isEmulatorOnlyEndpoint() || supabaseUrl.isEmulatorOnlyEndpoint())) {
        return "emulator_endpoint_on_physical_device"
    }

    if (apiBaseUrl.startsWith("https://") &&
        (supabaseUrl.isBlank() || supabasePublishableKey.isBlank())
    ) {
        return "missing_supabase_client_configuration"
    }

    return null
}

internal fun isProbablyEmulator(): Boolean =
    Build.FINGERPRINT.startsWith("generic") ||
        Build.FINGERPRINT.startsWith("unknown") ||
        Build.MODEL.contains("google_sdk", ignoreCase = true) ||
        Build.MODEL.contains("Emulator", ignoreCase = true) ||
        Build.MODEL.contains("Android SDK built for", ignoreCase = true) ||
        Build.PRODUCT.contains("sdk", ignoreCase = true)

private fun String.isEmulatorOnlyEndpoint(): Boolean = runCatching {
    URI(this).host in setOf("10.0.2.2", "localhost", "127.0.0.1", "::1")
}.getOrDefault(false)
