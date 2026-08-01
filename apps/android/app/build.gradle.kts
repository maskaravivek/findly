plugins { alias(libs.plugins.android.application); alias(libs.plugins.kotlin.android); alias(libs.plugins.kotlin.compose); alias(libs.plugins.kotlin.serialization); alias(libs.plugins.hilt); id("org.jetbrains.kotlin.kapt") }
android {
    namespace = "ai.findly.app"; compileSdk = 35
    defaultConfig {
        applicationId = "ai.findly.app"; minSdk = 26; targetSdk = 35; versionCode = 1; versionName = "0.1.0"
        fun quoted(value: String) = "\"${value.replace("\\", "\\\\").replace("\"", "\\\"")}\""
        val brand = providers.gradleProperty("brandName").orElse("Findly").get()
        val apiBaseUrl = providers.gradleProperty("apiBaseUrl").orElse("http://10.0.2.2:3000/").get()
        val supabaseUrl = providers.gradleProperty("supabaseUrl").orElse("http://10.0.2.2:54321/").get()
        val supabasePublishableKey = providers.gradleProperty("supabasePublishableKey").orElse("").get()
        if (apiBaseUrl.startsWith("https://") && supabasePublishableKey.isBlank()) {
            throw GradleException("A Supabase publishable key is required for a production API build.")
        }
        resValue("string", "app_name", brand)
        buildConfigField("String", "BRAND_NAME", quoted(brand)); buildConfigField("String", "API_BASE_URL", quoted(apiBaseUrl)); buildConfigField("String", "SUPABASE_URL", quoted(supabaseUrl)); buildConfigField("String", "SUPABASE_PUBLISHABLE_KEY", quoted(supabasePublishableKey))
        manifestPlaceholders["usesCleartextTraffic"] = providers.gradleProperty("usesCleartextTraffic").orElse("true").get()
    }
    buildFeatures { compose = true; buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
    packaging { resources.excludes += "/META-INF/{AL2.0,LGPL2.1}" }
}
dependencies {
    implementation(platform(libs.compose.bom)); implementation(libs.compose.ui); implementation(libs.compose.ui.tooling.preview); implementation(libs.compose.material3); implementation(libs.compose.icons); debugImplementation(libs.compose.ui.tooling)
    implementation(libs.activity.compose); implementation(libs.lifecycle.runtime); implementation(libs.lifecycle.compose); implementation(libs.lifecycle.viewmodel.compose); implementation(libs.navigation.compose)
    implementation(libs.hilt.android); kapt(libs.hilt.compiler); implementation(libs.hilt.navigation.compose)
    implementation(libs.kotlinx.serialization.json); implementation(libs.retrofit); implementation(libs.retrofit.serialization); implementation(libs.okhttp)
    implementation(libs.room.runtime); implementation(libs.room.ktx); kapt(libs.room.compiler); implementation(libs.datastore)
    implementation(libs.camera.camera2); implementation(libs.camera.lifecycle); implementation(libs.camera.view); implementation(libs.mlkit.barcode); implementation(libs.play.location); implementation(libs.work.runtime)
    implementation(libs.coil.compose); implementation(libs.coil.network)
    testImplementation(libs.junit)
}
