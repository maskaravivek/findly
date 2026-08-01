package ai.findly.app.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import com.google.android.gms.location.Priority

class LocationRepositoryTest {
    @Test
    fun normalizesCanadianPostalCode() {
        assertEquals("L1G 0A1", normalizeCanadianPostalCode("l1g0a1"))
        assertEquals("M5V 3A8", normalizeCanadianPostalCode("M5V 3A8"))
    }

    @Test
    fun validatesCanadianPostalCode() {
        assertTrue(isValidCanadianPostalCode("L1G 0A1"))
        assertFalse(isValidCanadianPostalCode("12345"))
        assertFalse(isValidCanadianPostalCode("D1G 0A1"))
    }

    @Test
    fun usesHighAccuracyOnlyWithFinePermission() {
        assertEquals(Priority.PRIORITY_HIGH_ACCURACY, locationPriority(true))
        assertEquals(Priority.PRIORITY_BALANCED_POWER_ACCURACY, locationPriority(false))
    }
}
