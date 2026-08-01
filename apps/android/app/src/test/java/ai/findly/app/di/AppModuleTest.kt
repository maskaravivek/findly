package ai.findly.app.di

import org.junit.Assert.assertEquals
import org.junit.Test

class AppModuleTest {
    @Test
    fun shoppingClientAllowsLiveRetailerWorkflowToComplete() {
        val client = findlyHttpClient()

        assertEquals(FINDLY_READ_TIMEOUT_SECONDS * 1_000, client.readTimeoutMillis.toLong())
        assertEquals(FINDLY_CALL_TIMEOUT_SECONDS * 1_000, client.callTimeoutMillis.toLong())
    }
}
