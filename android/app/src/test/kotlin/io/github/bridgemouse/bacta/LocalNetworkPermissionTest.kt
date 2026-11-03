package io.github.bridgemouse.bacta

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LocalNetworkPermissionTest {
    @Test
    fun isRequiredOnAndroid17AndLater() {
        assertTrue(localNetworkPermissionRequired(37))
        assertTrue(localNetworkPermissionRequired(38))
    }

    @Test
    fun isNotRequiredBeforeAndroid17BecauseThePermissionDoesNotExistThere() {
        assertFalse(localNetworkPermissionRequired(36))
        assertFalse(localNetworkPermissionRequired(34))
    }
}
