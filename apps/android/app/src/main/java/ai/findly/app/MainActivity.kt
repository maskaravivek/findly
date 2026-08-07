package ai.findly.app

import android.Manifest
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.LocationOff
import androidx.compose.material.icons.outlined.MyLocation
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.Verified
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CenterAlignedTopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import ai.findly.app.data.Offer
import ai.findly.app.ui.SearchUiState
import ai.findly.app.ui.SearchViewModel
import ai.findly.app.ui.OfferLens
import ai.findly.app.ui.lensEvidence
import ai.findly.app.ui.offersForLens
import coil3.compose.AsyncImage
import dagger.hilt.android.AndroidEntryPoint
import java.text.NumberFormat
import java.time.Duration
import java.time.Instant
import java.util.Currency
import java.util.Locale

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { FindlyTheme { FindlyApp() } }
    }
}

private val Evergreen = Color(0xFF176B52)
private val Cream = Color(0xFFF7F5EF)
private val Ink = Color(0xFF17201C)
private val MutedInk = Color(0xFF5D6661)
private val LiveGreen = Color(0xFF0E6245)
private val WarningAmber = Color(0xFF8A5A00)

@Composable
fun FindlyTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = Evergreen,
            onPrimary = Color.White,
            background = Cream,
            onBackground = Ink,
            surface = Color.White,
            onSurface = Ink,
            surfaceVariant = Color(0xFFEAEDE8),
        ),
        typography = Typography(),
        content = content,
    )
}

@Composable
private fun FindlyApp(viewModel: SearchViewModel = hiltViewModel()) {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = "search") {
        composable("search") {
            ShoppingScreen(
                viewModel = viewModel,
                openSettings = { navController.navigate("settings") },
            )
        }
        composable("settings") {
            LocationSettingsScreen(
                viewModel = viewModel,
                navigateBack = { navController.popBackStack() },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ShoppingScreen(
    viewModel: SearchViewModel,
    openSettings: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current
    var requestedLocation by rememberSaveable { mutableStateOf(false) }
    var selectedLens by rememberSaveable(state.result?.requestId) { mutableStateOf(OfferLens.Recommended) }
    val locationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        viewModel.onLocationPermissionResult(permissions.values.any { it })
    }

    LaunchedEffect(state.useAutomaticLocation) {
        if (!state.useAutomaticLocation) return@LaunchedEffect
        if (viewModel.hasLocationPermission()) {
            viewModel.refreshAutomaticLocation()
        } else if (!requestedLocation) {
            requestedLocation = true
            locationPermission.launch(
                arrayOf(
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                ),
            )
        }
    }

    Scaffold(
        containerColor = Cream,
        topBar = {
            CenterAlignedTopAppBar(
                title = { Text(BuildConfig.BRAND_NAME, fontWeight = FontWeight.ExtraBold) },
                actions = {
                    IconButton(onClick = openSettings) {
                        Icon(Icons.Outlined.Settings, contentDescription = "Location settings")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 20.dp, vertical = 18.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(
                        "Find the right product",
                        style = MaterialTheme.typography.headlineMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Describe the job, item, or model number. We’ll compare the best matches.",
                        color = MutedInk,
                    )
                }
            }

            item {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    OutlinedTextField(
                        value = state.query,
                        onValueChange = viewModel::setQuery,
                        modifier = Modifier.fillMaxWidth().heightIn(min = 104.dp),
                        placeholder = { Text("Try “I need a drill for hanging shelves”") },
                        shape = RoundedCornerShape(18.dp),
                        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
                        keyboardActions = KeyboardActions(onSearch = {
                            focusManager.clearFocus()
                            viewModel.search()
                        }),
                    )
                    Button(
                        onClick = {
                            focusManager.clearFocus()
                            viewModel.search()
                        },
                        enabled = !state.loading && state.query.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(54.dp),
                        shape = RoundedCornerShape(16.dp),
                    ) {
                        Icon(Icons.Outlined.Search, contentDescription = null)
                        Spacer(Modifier.width(8.dp))
                        Text("Find products")
                    }
                }
            }

            if (!state.locationResolving && state.postalCode == null) {
                item { LocationFallbackCard(openSettings = openSettings) }
            }

            if (state.loading) {
                item { SearchProgressCard(state.loadingMessage) }
            }

            state.error?.let { message ->
                item {
                    ErrorCard(message = message, retry = viewModel::search)
                }
            }

            state.result?.clarification?.let { clarification ->
                item {
                    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                        Column(
                            Modifier.padding(18.dp),
                            verticalArrangement = Arrangement.spacedBy(12.dp),
                        ) {
                            Text("One detail will improve the match", color = Evergreen, fontWeight = FontWeight.SemiBold)
                            Text(
                                clarification.question,
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                            )
                            clarification.options.forEach { option ->
                                OutlinedButton(
                                    onClick = { viewModel.answerClarification(option) },
                                    enabled = !state.loading,
                                    modifier = Modifier.fillMaxWidth(),
                                ) { Text(option) }
                            }
                        }
                    }
                }
            }

            state.result?.takeIf { it.clarification == null }?.let { result ->
                item {
                    ResultSummary(
                        liveOfferCount = result.offers.count { it.source.liveVerified },
                        cachedOfferCount = result.offers.count { it.source.kind == "cached_verified" },
                        totalOfferCount = result.offers.size,
                        headline = result.recommendation?.headline,
                        explanation = result.recommendation?.explanation,
                        locationLabel = state.locationLabel,
                        locationApproximate = state.locationApproximate,
                    )
                }
                if (result.warnings.isNotEmpty()) {
                    item { RetailerWarningCard(result.warnings) }
                }
                if (result.offers.isNotEmpty()) {
                    item {
                        ResultLensTabs(selected = selectedLens, select = { selectedLens = it })
                    }
                    if (selectedLens == OfferLens.All) {
                        val nearbyOffers = result.offers.filter { it.fulfillment.storeName != null }
                        val onlineOffers = result.offers.filter { it.fulfillment.storeName == null }
                        if (nearbyOffers.isNotEmpty()) {
                            item { ResultSectionTitle("Nearby pickup", "Stock checked at your closest Home Depot") }
                        }
                        items(nearbyOffers, key = { "all-${it.offerId}" }) { offer -> OfferCard(offer) }
                        if (onlineOffers.isNotEmpty()) {
                            item { ResultSectionTitle("Online options", "Current online prices for comparison") }
                        }
                        items(onlineOffers, key = { "all-${it.offerId}" }) { offer -> OfferCard(offer) }
                    } else {
                        val lensOffers = offersForLens(result.offers, selectedLens)
                        item {
                            Text(
                                when (selectedLens) {
                                    OfferLens.Recommended -> "Top matches for product fit, value, and availability"
                                    OfferLens.LowestPrice -> "Listed totals, before unknown shipping or tax"
                                    OfferLens.Fastest -> "Pickup first, then retailer-provided delivery timing"
                                    OfferLens.All -> "Every current result"
                                },
                                style = MaterialTheme.typography.bodySmall,
                                color = MutedInk,
                            )
                        }
                        items(lensOffers, key = { offer -> "${selectedLens.name}-${offer.offerId}" }) { offer ->
                            OfferCard(
                                offer = offer,
                                evidence = lensEvidence(offer, selectedLens, result.offers),
                            )
                        }
                    }
                }
                if (result.offers.isEmpty()) {
                    item {
                        Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text("No verified matches yet", fontWeight = FontWeight.Bold)
                                Text("Try a model number, brand, or a more specific description.", color = MutedInk)
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ResultLensTabs(selected: OfferLens, select: (OfferLens) -> Unit) {
    TabRow(
        selectedTabIndex = OfferLens.entries.indexOf(selected),
        containerColor = Cream,
        contentColor = Evergreen,
    ) {
        OfferLens.entries.forEach { lens ->
            Tab(
                selected = selected == lens,
                onClick = { select(lens) },
                modifier = Modifier.heightIn(min = 48.dp),
                text = { Text(lens.label, fontWeight = if (selected == lens) FontWeight.Bold else FontWeight.Medium) },
            )
        }
    }
}

@Composable
private fun LocationFallbackCard(openSettings: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant)) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(Icons.Outlined.LocationOff, contentDescription = null, tint = MutedInk)
            Spacer(Modifier.width(12.dp))
            Text("Add a location for nearby results", modifier = Modifier.weight(1f), color = MutedInk)
            TextButton(onClick = openSettings) { Text("Settings") }
        }
    }
}

@Composable
private fun SearchProgressCard(message: String) {
    Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
        Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(message, fontWeight = FontWeight.SemiBold)
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth())
            Text("Live retailer checks can take a few moments.", style = MaterialTheme.typography.bodySmall, color = MutedInk)
        }
    }
}

@Composable
private fun ErrorCard(message: String, retry: () -> Unit) {
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Row(
            Modifier.fillMaxWidth().padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(message, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onErrorContainer)
            TextButton(onClick = retry) { Text("Try again") }
        }
    }
}

@Composable
private fun ResultSummary(
    liveOfferCount: Int,
    cachedOfferCount: Int,
    totalOfferCount: Int,
    headline: String?,
    explanation: String?,
    locationLabel: String?,
    locationApproximate: Boolean,
) {
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        val provenanceText = when {
            totalOfferCount > 0 && liveOfferCount == totalOfferCount -> "$liveOfferCount live prices verified"
            liveOfferCount > 0 -> "$liveOfferCount of $totalOfferCount offers verified live"
            totalOfferCount > 0 && cachedOfferCount == totalOfferCount -> "$cachedOfferCount recently verified offers"
            cachedOfferCount > 0 -> "$cachedOfferCount of $totalOfferCount offers recently verified"
            totalOfferCount > 0 -> "Sample or unverified results"
            else -> null
        }
        provenanceText?.let {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Outlined.Verified,
                    contentDescription = null,
                    tint = if (liveOfferCount > 0) LiveGreen else WarningAmber,
                    modifier = Modifier.size(20.dp),
                )
                Spacer(Modifier.width(7.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.labelLarge,
                    color = if (liveOfferCount > 0) LiveGreen else WarningAmber,
                )
            }
        }
        headline?.let {
            Text(it, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
        explanation?.let { Text(it, color = MutedInk) }
        if (locationApproximate) {
            Text(
                "Approximate location${locationLabel?.let { " near $it" }.orEmpty()} • enable precise location in Settings for the closest store",
                style = MaterialTheme.typography.bodySmall,
                color = WarningAmber,
            )
        }
    }
}

@Composable
private fun RetailerWarningCard(warnings: List<String>) {
    val messages = warnings.map(::friendlyRetailerWarning).distinct().take(2)
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.tertiaryContainer)) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("Some live results are unavailable", fontWeight = FontWeight.Bold)
            messages.forEach { Text(it, style = MaterialTheme.typography.bodySmall) }
        }
    }
}

private fun friendlyRetailerWarning(warning: String): String = when {
    warning.contains("browser minutes", ignoreCase = true) || warning.contains("402") -> "The live retailer service is temporarily unavailable. Please try again shortly."
    warning.contains("access challenge", ignoreCase = true) -> "A retailer temporarily declined the live lookup. Other available results are still shown."
    warning.contains("timeout", ignoreCase = true) -> "A retailer took too long to respond. Other available results are still shown."
    else -> warning.substringAfter(": ", warning).take(180)
}

@Composable
private fun ResultSectionTitle(title: String, subtitle: String) {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
        Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MutedInk)
    }
}

@Composable
private fun OfferCard(offer: Offer, evidence: String? = null) {
    val uriHandler = LocalUriHandler.current
    val fulfillment = fulfillmentSummary(offer)
    val caveat = compactOfferCaveat(offer)
    val imageUrl = offer.product.imageUrl
    var imageFailed by remember(imageUrl) { mutableStateOf(false) }
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(horizontal = 16.dp, vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                if (imageUrl != null && !imageFailed) {
                    Surface(
                        modifier = Modifier.size(72.dp),
                        shape = RoundedCornerShape(14.dp),
                        color = MaterialTheme.colorScheme.surfaceVariant,
                    ) {
                        AsyncImage(
                            model = imageUrl,
                            contentDescription = offer.product.title,
                            contentScale = ContentScale.Fit,
                            modifier = Modifier.fillMaxSize().padding(7.dp),
                            onError = { imageFailed = true },
                        )
                    }
                }
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            offer.retailer.name,
                            modifier = Modifier.weight(1f),
                            style = MaterialTheme.typography.labelMedium,
                            color = Evergreen,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            cad(offer.price.total.amountMinor),
                            style = MaterialTheme.typography.titleLarge,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        offer.product.title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    val metadata = productMetadata(offer)
                    if (metadata.isNotBlank()) {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            if (offer.product.rating != null) {
                                Icon(Icons.Outlined.Star, contentDescription = null, tint = WarningAmber, modifier = Modifier.size(15.dp))
                            }
                            Text(
                                metadata,
                                style = MaterialTheme.typography.bodySmall,
                                color = MutedInk,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                            )
                        }
                    }
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
                Text(
                    fulfillment.primary,
                    style = MaterialTheme.typography.bodyMedium,
                    fontWeight = FontWeight.SemiBold,
                    color = if (fulfillment.positive) LiveGreen else Ink,
                )
                fulfillment.secondary?.let {
                    Text(it, style = MaterialTheme.typography.bodySmall, color = MutedInk, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }

            evidence?.let {
                Text(it, style = MaterialTheme.typography.labelMedium, color = Evergreen, fontWeight = FontWeight.SemiBold)
            }

            caveat?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MutedInk, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }

            Row(
                modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Icon(
                    Icons.Outlined.Verified,
                    contentDescription = null,
                    tint = if (offer.source.liveVerified) LiveGreen else WarningAmber,
                    modifier = Modifier.size(17.dp),
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    sourceSummary(offer),
                    modifier = Modifier.weight(1f),
                    style = MaterialTheme.typography.labelMedium,
                    color = if (offer.source.liveVerified) LiveGreen else WarningAmber,
                )
                TextButton(onClick = { uriHandler.openUri(offer.url) }) {
                    Text("View item")
                    Spacer(Modifier.width(5.dp))
                    Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(17.dp))
                }
            }
        }
    }
}

private data class FulfillmentSummary(val primary: String, val secondary: String?, val positive: Boolean)

private fun fulfillmentSummary(offer: Offer): FulfillmentSummary {
    val fulfillment = offer.fulfillment
    val primary = when {
        fulfillment.status == "out_of_stock" -> "Out of stock"
        fulfillment.pickup -> fulfillment.estimate ?: "Pickup available"
        fulfillment.inStore -> "Available in store"
        fulfillment.delivery -> fulfillment.estimate ?: "Delivery available"
        fulfillment.shipping -> "Shipping available"
        else -> "Availability not provided"
    }
    val details = listOfNotNull(
        fulfillment.storeName,
        fulfillment.inventoryQuantity?.takeIf { it > 0 }?.let { "$it in stock" },
        fulfillment.storeDistanceKm?.let { String.format(Locale.CANADA, "%.1f km away", it) },
        fulfillment.aisle?.let { aisle -> "Aisle $aisle${fulfillment.bay?.let { ", bay $it" }.orEmpty()}" },
    ).joinToString(" • ").ifBlank { null }
    return FulfillmentSummary(
        primary = primary,
        secondary = details,
        positive = fulfillment.status != "out_of_stock" && (fulfillment.pickup || fulfillment.inStore),
    )
}

private fun productMetadata(offer: Offer): String = buildList {
    offer.product.rating?.let { rating ->
        add(buildString {
            append(String.format(Locale.CANADA, "%.1f", rating))
            offer.product.reviewCount?.let { append(" (${NumberFormat.getIntegerInstance(Locale.CANADA).format(it)})") }
        })
    }
    offer.product.modelNumber?.let { add("Model $it") }
}.joinToString(" • ")

private fun compactOfferCaveat(offer: Offer): String? {
    val caveats = buildList {
        if (offer.seller.type == "marketplace") add("Marketplace seller")
        if (offer.warnings.any { it.contains("different bundle", ignoreCase = true) }) add("Different bundle or package")
        if (offer.warnings.any { it.contains("pickup was not offered", ignoreCase = true) }) add("Store stock shown, pickup unavailable")
        if (isEmpty() && offer.warnings.any { it.contains("seller and bundle", ignoreCase = true) }) add("Check seller and bundle details")
    }
    return caveats.distinct().take(2).joinToString(" • ").ifBlank { null }
}

private fun sourceSummary(offer: Offer): String = when {
    offer.source.liveVerified && offer.fulfillment.inventoryQuantity != null -> "Price and stock live • ${freshnessLabel(offer.source.observedAt)}"
    offer.source.liveVerified -> "Price live • ${freshnessLabel(offer.source.observedAt)}"
    offer.source.kind == "cached_verified" -> "Recently verified • ${freshnessLabel(offer.source.observedAt)}"
    offer.source.kind == "fixture" -> "Demo result"
    else -> "Not live verified"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun LocationSettingsScreen(
    viewModel: SearchViewModel,
    navigateBack: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val locationPermission = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { permissions ->
        val granted = permissions.values.any { it }
        viewModel.onLocationPermissionResult(granted)
        if (granted) viewModel.useAutomaticLocation()
    }

    fun selectAutomatic() {
        if (viewModel.hasFineLocationPermission()) {
            viewModel.useAutomaticLocation()
        } else {
            locationPermission.launch(
                arrayOf(
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                    Manifest.permission.ACCESS_FINE_LOCATION,
                ),
            )
        }
    }

    Scaffold(
        containerColor = Cream,
        topBar = {
            TopAppBar(
                title = { Text("Location") },
                navigationIcon = {
                    IconButton(onClick = navigateBack) {
                        Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "Back")
                    }
                },
            )
        },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.padding(padding).fillMaxSize(),
            contentPadding = PaddingValues(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            item {
                Text(
                    "Findly uses your shopping area to prioritize nearby options. Your exact address is not stored.",
                    color = MutedInk,
                )
            }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = state.useAutomaticLocation, onClick = ::selectAutomatic)
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text("Use current location", fontWeight = FontWeight.Bold)
                                Text(
                                    when {
                                        state.locationResolving -> "Detecting your shopping area…"
                                        state.useAutomaticLocation && state.postalCode != null -> buildString {
                                            append(if (state.locationApproximate) "Approximate" else "Precise")
                                            append(" • ")
                                            append(listOfNotNull(state.locationLabel, state.postalCode).joinToString(" • "))
                                        }
                                        else -> "Uses approximate device location"
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MutedInk,
                                )
                            }
                            Icon(Icons.Outlined.MyLocation, contentDescription = null, tint = Evergreen)
                        }
                        OutlinedButton(
                            onClick = ::selectAutomatic,
                            enabled = !state.locationResolving,
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text(if (state.locationResolving) "Detecting…" else if (state.locationApproximate) "Improve location accuracy" else "Use my current location")
                        }
                    }
                }
            }
            item {
                Card(colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = !state.useAutomaticLocation, onClick = null)
                            Spacer(Modifier.width(8.dp))
                            Text("Set postal code", fontWeight = FontWeight.Bold)
                        }
                        OutlinedTextField(
                            value = state.manualPostalCode,
                            onValueChange = viewModel::setManualPostalCode,
                            label = { Text("Canadian postal code") },
                            placeholder = { Text("L1G 0A1") },
                            singleLine = true,
                            isError = state.manualPostalError != null,
                            supportingText = state.manualPostalError?.let { message -> { Text(message) } },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Button(onClick = viewModel::saveManualPostalCode, modifier = Modifier.fillMaxWidth()) {
                            Text("Save postal code")
                        }
                    }
                }
            }
            state.locationMessage?.let { message ->
                item { Text(message, style = MaterialTheme.typography.bodySmall, color = MutedInk) }
            }
        }
    }
}

private fun cad(minor: Int): String = NumberFormat.getCurrencyInstance(Locale.CANADA).apply {
    currency = Currency.getInstance("CAD")
}.format(minor / 100.0)

internal fun freshnessLabel(observedAt: String, now: Instant = Instant.now()): String {
    val observed = runCatching { Instant.parse(observedAt) }.getOrNull() ?: return "recently checked"
    val minutes = Duration.between(observed, now).toMinutes().coerceAtLeast(0)
    return when {
        minutes < 2 -> "checked just now"
        minutes < 60 -> "checked $minutes min ago"
        else -> "checked ${minutes / 60} hr ago"
    }
}
