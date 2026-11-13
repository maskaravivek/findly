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
                isEmulator = false,
            ),
        )
    }

    @Test
    fun acceptsEmulatorEndpointsOnEmulator() {
        assertNull(
            clientConfigurationError(
                apiBaseUrl = "http://10.0.2.2:3000/",
                isEmulator = true,
            ),
        )
    }

    @Test
    fun acceptsProductionApiOnPhysicalPhone() {
        assertNull(
            clientConfigurationError(
                apiBaseUrl = "https://findly.example/",
                isEmulator = false,
            ),
        )
    }
}
