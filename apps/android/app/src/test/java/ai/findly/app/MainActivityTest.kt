package ai.findly.app

import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Test

class MainActivityTest {
    @Test
    fun formatsFreshnessWithoutExposingRawTimestamp() {
        val now = Instant.parse("2026-07-13T20:00:00Z")

        assertEquals("checked just now", freshnessLabel("2026-07-13T19:59:20Z", now))
        assertEquals("checked 12 min ago", freshnessLabel("2026-07-13T19:48:00Z", now))
    }
}
