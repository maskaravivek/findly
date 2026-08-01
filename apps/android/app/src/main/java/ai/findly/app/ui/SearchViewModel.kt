package ai.findly.app.ui

import ai.findly.app.data.LocationRepository
import ai.findly.app.data.SearchResponse
import ai.findly.app.data.ShoppingRepository
import ai.findly.app.data.ShoppingLocationSettings
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import ai.findly.app.data.AuthenticationUnavailableException
import ai.findly.app.data.InvalidClientConfigurationException
import javax.inject.Inject
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import retrofit2.HttpException

data class SearchUiState(
    val query: String = "",
    val loading: Boolean = false,
    val loadingMessage: String = "Understanding what you need",
    val result: SearchResponse? = null,
    val error: String? = null,
    val useAutomaticLocation: Boolean = true,
    val postalCode: String? = null,
    val locationLabel: String? = null,
    val latitude: Double? = null,
    val longitude: Double? = null,
    val locationAccuracyMeters: Double? = null,
    val locationApproximate: Boolean = false,
    val locationResolving: Boolean = false,
    val locationMessage: String? = null,
    val manualPostalCode: String = "",
    val manualPostalError: String? = null,
)

@HiltViewModel
class SearchViewModel @Inject constructor(
    private val repository: ShoppingRepository,
    private val locationRepository: LocationRepository,
) : ViewModel() {
    private val mutableState = MutableStateFlow(SearchUiState())
    val state: StateFlow<SearchUiState> = mutableState.asStateFlow()

    init {
        viewModelScope.launch {
            locationRepository.settings.collectLatest { settings ->
                mutableState.update {
                    it.copy(
                        useAutomaticLocation = settings.useAutomatic,
                        postalCode = settings.postalCode,
                        locationLabel = settings.locality,
                        latitude = settings.latitude,
                        longitude = settings.longitude,
                        locationAccuracyMeters = settings.accuracyMeters,
                        locationApproximate = settings.approximate,
                        manualPostalCode = if (settings.useAutomatic) it.manualPostalCode else settings.postalCode.orEmpty(),
                    )
                }
            }
        }
    }

    fun setQuery(value: String) = mutableState.update { it.copy(query = value) }

    fun setManualPostalCode(value: String) = mutableState.update {
        it.copy(manualPostalCode = value.uppercase(), manualPostalError = null)
    }

    fun hasLocationPermission(): Boolean = locationRepository.hasLocationPermission()
    fun hasFineLocationPermission(): Boolean = locationRepository.hasFineLocationPermission()

    fun onLocationPermissionResult(granted: Boolean) {
        if (granted) {
            refreshAutomaticLocation()
        } else {
            mutableState.update {
                it.copy(locationMessage = "Location access is off. Set a postal code in Settings for nearby results.")
            }
        }
    }

    fun refreshAutomaticLocation() {
        if (state.value.locationResolving) return
        if (!locationRepository.hasLocationPermission()) {
            mutableState.update {
                it.copy(locationMessage = "Allow location access or set a postal code below.")
            }
            return
        }
        viewModelScope.launch {
            mutableState.update { it.copy(locationResolving = true, locationMessage = null) }
            locationRepository.resolveAutomaticLocation()
                .onSuccess { location ->
                    mutableState.update {
                        it.copy(
                            locationResolving = false,
                            postalCode = location.postalCode,
                            locationLabel = location.locality,
                            latitude = location.latitude,
                            longitude = location.longitude,
                            locationAccuracyMeters = location.accuracyMeters,
                            locationApproximate = location.approximate,
                            locationMessage = if (location.approximate) "Using an approximate shopping area. Allow precise location for the closest store." else "Using your precise location for the closest store.",
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update {
                        it.copy(
                            locationResolving = false,
                            locationMessage = error.message ?: "Could not detect your shopping area.",
                        )
                    }
                }
        }
    }

    fun useAutomaticLocation() {
        viewModelScope.launch {
            locationRepository.useAutomaticLocation()
            if (locationRepository.hasLocationPermission()) refreshAutomaticLocation()
        }
    }

    fun saveManualPostalCode() {
        val value = state.value.manualPostalCode
        viewModelScope.launch {
            locationRepository.saveManualPostalCode(value)
                .onSuccess { postalCode ->
                    mutableState.update {
                        it.copy(
                            postalCode = postalCode,
                            manualPostalCode = postalCode,
                            manualPostalError = null,
                            latitude = null,
                            longitude = null,
                            locationAccuracyMeters = null,
                            locationApproximate = false,
                            locationMessage = "Nearby results will use $postalCode.",
                        )
                    }
                }
                .onFailure { error ->
                    mutableState.update { it.copy(manualPostalError = error.message) }
                }
        }
    }

    fun search() {
        val current = state.value
        if (current.query.isBlank()) return
        runSearch(clearPreviousResult = true) {
            repository.search(
                current.query.trim(),
                ShoppingLocationSettings(
                    useAutomatic = current.useAutomaticLocation,
                    postalCode = current.postalCode,
                    locality = current.locationLabel,
                    latitude = current.latitude,
                    longitude = current.longitude,
                    accuracyMeters = current.locationAccuracyMeters,
                    approximate = current.locationApproximate,
                ),
            )
        }
    }

    fun answerClarification(answer: String) {
        val requestId = state.value.result?.requestId ?: return
        runSearch(clearPreviousResult = false) { repository.clarify(requestId, answer) }
    }

    private fun runSearch(clearPreviousResult: Boolean, request: suspend () -> SearchResponse) {
        viewModelScope.launch {
            mutableState.update {
                it.copy(
                    loading = true,
                    loadingMessage = "Understanding what you need",
                    result = if (clearPreviousResult) null else it.result,
                    error = null,
                )
            }
            val progress = launch {
                delay(3_000)
                mutableState.update { it.copy(loadingMessage = "Checking live retailer prices") }
                delay(7_000)
                mutableState.update { it.copy(loadingMessage = "Verifying product matches") }
            }
            runCatching { request() }
                .onSuccess { result ->
                    mutableState.update { it.copy(loading = false, result = result, error = null) }
                }
                .onFailure { error ->
                    mutableState.update { it.copy(loading = false, error = userFacingError(error)) }
                }
            progress.cancel()
        }
    }
}

internal fun userFacingError(error: Throwable): String = when (error) {
    is AuthenticationUnavailableException -> "Findly could not start a secure session. Please try again."
    is InvalidClientConfigurationException -> "This Findly build is configured for an emulator, not a physical phone."
    is SocketTimeoutException -> "Findly could not reach the service in time. Please try again."
    is UnknownHostException -> "Findly could not connect. Check your internet connection and try again."
    is HttpException -> when (error.code()) {
        401 -> "Your Findly session expired. Please try again."
        429 -> "Findly is receiving too many searches right now. Please wait a moment and try again."
        else -> "Findly could not complete this search. Please try again."
    }
    else -> error.message ?: "Search failed. Please try again."
}
