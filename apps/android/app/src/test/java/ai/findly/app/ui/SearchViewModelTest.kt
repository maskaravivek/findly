package ai.findly.app.ui

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import ai.findly.app.data.InvalidClientConfigurationException
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class SearchViewModelTest {
    @Test
    fun unknownTimeoutDoesNotBlameARetailer() {
        assertEquals(
            "Findly could not reach the service in time. Please try again.",
            userFacingError(SocketTimeoutException()),
        )
    }

    @Test
    fun invalidBuildConfigurationIsExplained() {
        assertEquals(
            "This Findly build is configured for an emulator, not a physical phone.",
            userFacingError(InvalidClientConfigurationException("emulator endpoint")),
        )
    }

    @Test
    fun offlineMessageIsActionable() {
        assertEquals(
            "Findly could not connect. Check your internet connection and try again.",
            userFacingError(UnknownHostException()),
        )
    }

    @Test
    fun rateLimitMessageDoesNotExposeRawHttpError() {
        val error = HttpException(Response.error<String>(429, "".toResponseBody()))

        assertEquals("Findly is receiving too many searches right now. Please wait a moment and try again.", userFacingError(error))
    }
}
