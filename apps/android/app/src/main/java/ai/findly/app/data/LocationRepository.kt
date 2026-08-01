package ai.findly.app.data

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Address
import android.location.Geocoder
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.doublePreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.google.android.gms.tasks.Task
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull

private val Context.shoppingLocationDataStore by preferencesDataStore(name = "shopping_location")

data class ShoppingLocationSettings(
    val useAutomatic: Boolean = true,
    val postalCode: String? = null,
    val locality: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val accuracyMeters: Double? = null,
    val approximate: Boolean = false,
)

data class ResolvedShoppingLocation(
    val postalCode: String,
    val locality: String?,
    val latitude: Double,
    val longitude: Double,
    val accuracyMeters: Double,
    val approximate: Boolean,
)

@Singleton
class LocationRepository @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val fusedLocationClient = LocationServices.getFusedLocationProviderClient(context)
    private val automaticKey = booleanPreferencesKey("use_automatic")
    private val manualPostalCodeKey = stringPreferencesKey("manual_postal_code")
    private val detectedPostalCodeKey = stringPreferencesKey("detected_postal_code")
    private val detectedLocalityKey = stringPreferencesKey("detected_locality")
    private val detectedLatitudeKey = doublePreferencesKey("detected_latitude")
    private val detectedLongitudeKey = doublePreferencesKey("detected_longitude")
    private val detectedAccuracyKey = doublePreferencesKey("detected_accuracy_meters")
    private val detectedApproximateKey = booleanPreferencesKey("detected_approximate")

    val settings: Flow<ShoppingLocationSettings> = context.shoppingLocationDataStore.data.map { preferences ->
        val useAutomatic = preferences[automaticKey] ?: true
        ShoppingLocationSettings(
            useAutomatic = useAutomatic,
            postalCode = if (useAutomatic) preferences[detectedPostalCodeKey] else preferences[manualPostalCodeKey],
            locality = if (useAutomatic) preferences[detectedLocalityKey] else null,
            latitude = if (useAutomatic) preferences[detectedLatitudeKey] else null,
            longitude = if (useAutomatic) preferences[detectedLongitudeKey] else null,
            accuracyMeters = if (useAutomatic) preferences[detectedAccuracyKey] else null,
            approximate = useAutomatic && (preferences[detectedApproximateKey] ?: false),
        )
    }

    fun hasLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    fun hasFineLocationPermission(): Boolean =
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("MissingPermission")
    suspend fun resolveAutomaticLocation(): Result<ResolvedShoppingLocation> = runCatching {
        check(hasLocationPermission()) { "Location permission is needed to detect your shopping area." }
        check(Geocoder.isPresent()) { "Location lookup is not available on this device." }

        val cancellationSource = CancellationTokenSource()
        val currentLocation = try {
            withTimeoutOrNull(15_000) {
                runCatching {
                    fusedLocationClient
                        .getCurrentLocation(locationPriority(hasFineLocationPermission()), cancellationSource.token)
                        .await()
                }.getOrNull()
            }
        } finally {
            cancellationSource.cancel()
        }
        val location = currentLocation ?: withTimeoutOrNull(5_000) { fusedLocationClient.lastLocation.await() }
            ?: error("Could not determine your current location.")

        val address = withTimeoutOrNull(10_000) { reverseGeocode(location.latitude, location.longitude) }
            ?: error("Could not determine a postal code for your location.")
        val postalCode = normalizeCanadianPostalCode(address.postalCode.orEmpty())
        require(isValidCanadianPostalCode(postalCode)) { "The detected location did not return a Canadian postal code." }

        val locality = address.locality ?: address.subAdminArea ?: address.adminArea
        val approximate = !hasFineLocationPermission()
        context.shoppingLocationDataStore.edit { preferences ->
            preferences[automaticKey] = true
            preferences[detectedPostalCodeKey] = postalCode
            locality?.let { preferences[detectedLocalityKey] = it }
                ?: preferences.remove(detectedLocalityKey)
            preferences[detectedLatitudeKey] = location.latitude
            preferences[detectedLongitudeKey] = location.longitude
            preferences[detectedAccuracyKey] = location.accuracy.toDouble()
            preferences[detectedApproximateKey] = approximate
        }
        ResolvedShoppingLocation(
            postalCode = postalCode,
            locality = locality,
            latitude = location.latitude,
            longitude = location.longitude,
            accuracyMeters = location.accuracy.toDouble(),
            approximate = approximate,
        )
    }

    suspend fun saveManualPostalCode(value: String): Result<String> = runCatching {
        val postalCode = normalizeCanadianPostalCode(value)
        require(isValidCanadianPostalCode(postalCode)) { "Enter a valid Canadian postal code." }
        context.shoppingLocationDataStore.edit { preferences ->
            preferences[automaticKey] = false
            preferences[manualPostalCodeKey] = postalCode
        }
        postalCode
    }

    suspend fun useAutomaticLocation() {
        context.shoppingLocationDataStore.edit { it[automaticKey] = true }
    }

    private suspend fun reverseGeocode(latitude: Double, longitude: Double): Address? {
        val geocoder = Geocoder(context, Locale.CANADA)
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            suspendCancellableCoroutine { continuation ->
                geocoder.getFromLocation(latitude, longitude, 1, object : Geocoder.GeocodeListener {
                    override fun onGeocode(addresses: MutableList<Address>) {
                        if (continuation.isActive) continuation.resume(addresses.firstOrNull())
                    }

                    override fun onError(errorMessage: String?) {
                        if (continuation.isActive) {
                            continuation.resumeWithException(IOException(errorMessage ?: "Postal-code lookup failed."))
                        }
                    }
                })
            }
        } else {
            @Suppress("DEPRECATION")
            withContext(Dispatchers.IO) { geocoder.getFromLocation(latitude, longitude, 1)?.firstOrNull() }
        }
    }
}

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
    addOnSuccessListener { result -> if (continuation.isActive) continuation.resume(result) }
    addOnFailureListener { error -> if (continuation.isActive) continuation.resumeWithException(error) }
    addOnCanceledListener { continuation.cancel() }
}

internal fun normalizeCanadianPostalCode(value: String): String {
    val compact = value.uppercase(Locale.CANADA).filterNot(Char::isWhitespace)
    return if (compact.length == 6) "${compact.take(3)} ${compact.drop(3)}" else compact
}

internal fun isValidCanadianPostalCode(value: String): Boolean =
    Regex("^[ABCEGHJ-NPRSTVXY]\\d[ABCEGHJ-NPRSTV-Z] \\d[ABCEGHJ-NPRSTV-Z]\\d$").matches(value)

internal fun locationPriority(hasFinePermission: Boolean): Int =
    if (hasFinePermission) Priority.PRIORITY_HIGH_ACCURACY else Priority.PRIORITY_BALANCED_POWER_ACCURACY
