package ai.findly.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ClientConfigurationTest {
    @Test
    fun rejectsEmulatorEndpointsOnPhysicalPhone() {
        assertEquals(
            "emulator_endpoint_on_physical_device",
            clientConfigurationError(
                apiBaseUrl = "http://10.0.2.2:3000/",
                supabaseUrl = "http://10.0.2.2:54321/",
                supabasePublishableKey = "",
                isEmulator = false,
            ),
        )
    }

    @Test
    fun acceptsEmulatorEndpointsOnEmulator() {
        assertNull(
            clientConfigurationError(
                apiBaseUrl = "http://10.0.2.2:3000/",
                supabaseUrl = "http://10.0.2.2:54321/",
                supabasePublishableKey = "",
                isEmulator = true,
            ),
        )
    }

    @Test
    fun productionApiRequiresSupabaseClientConfiguration() {
        assertEquals(
            "missing_supabase_client_configuration",
            clientConfigurationError(
                apiBaseUrl = "https://findly.example/",
                supabaseUrl = "https://project.supabase.co/",
                supabasePublishableKey = "",
                isEmulator = false,
            ),
        )
    }

    @Test
    fun acceptsCompleteProductionConfiguration() {
        assertNull(
            clientConfigurationError(
                apiBaseUrl = "https://findly.example/",
                supabaseUrl = "https://project.supabase.co/",
                supabasePublishableKey = "sb_publishable_example",
                isEmulator = false,
            ),
        )
    }
}
