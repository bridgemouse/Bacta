package io.github.bridgemouse.bacta.domain

import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import org.junit.Test

class SettingsValidationTest {
    private fun ok(key: String, value: String) = assertTrue(SettingsValidation.validate(key, value), "$key=$value should be valid")
    private fun bad(key: String, value: String) = assertFalse(SettingsValidation.validate(key, value), "$key=$value should be invalid")

    /** Every row mirrors a validator in server/api/settings.ts; if the server table changes, this table must too. */
    @Test
    fun validatorsMatchTheServerTable() {
        ok("ai_provider", "google"); ok("ai_provider", "anthropic"); ok("ai_provider", "openai"); bad("ai_provider", "other"); bad("ai_provider", "")
        ok("ai_api_key", ""); ok("ai_api_key", "x".repeat(400)); bad("ai_api_key", "x".repeat(401))
        ok("mx4_briefing_model", "gemini-2.5-flash"); ok("mx4_chat_model", "claude-3.5:v1_x"); bad("mx4_chat_model", ""); bad("mx4_chat_model", "has space"); bad("mx4_briefing_model", "m".repeat(61)); ok("mx4_briefing_model", "m".repeat(60))
        ok("mx4_nightly_enabled", "true"); ok("mx4_on_sync_enabled", "false"); bad("mx4_nightly_enabled", "yes"); bad("mx4_on_sync_enabled", "TRUE")
        ok("mx4_nightly_time", "00:00"); ok("mx4_nightly_time", "23:59"); bad("mx4_nightly_time", "24:00"); bad("mx4_nightly_time", "7:30"); bad("mx4_nightly_time", "12:60")
        ok("garmin_background_sync_min", "0"); ok("garmin_background_sync_min", "15"); ok("garmin_background_sync_min", "9999"); bad("garmin_background_sync_min", "14"); bad("garmin_background_sync_min", "10000"); bad("garmin_background_sync_min", "-15"); bad("garmin_background_sync_min", "")
    }

    @Test
    fun unknownKeysAreNeverValid() {
        bad("auth_pin_hash", "x"); bad("nonsense", "true")
    }

    @Test
    fun theInUseKeysAreDeclaredAndOnlyTheApiKeyIsSecret() {
        assertEquals(
            setOf("ai_provider", "ai_api_key", "mx4_briefing_model", "mx4_chat_model", "mx4_nightly_enabled", "mx4_nightly_time", "mx4_on_sync_enabled", "garmin_background_sync_min"),
            SettingKey.All.map { it.key }.toSet(),
        )
        assertEquals(listOf("ai_api_key"), SettingKey.All.filter { it.secret }.map { it.key })
        assertTrue(SettingKey.All.all { SettingsValidation.hasValidator(it.key) })
    }

    @Test
    fun pinFormatIsFourToTwelveDigits() {
        assertTrue(SettingsValidation.isPinFormat("1234")); assertTrue(SettingsValidation.isPinFormat("123456789012"))
        assertFalse(SettingsValidation.isPinFormat("123")); assertFalse(SettingsValidation.isPinFormat("1234567890123")); assertFalse(SettingsValidation.isPinFormat("12a4")); assertFalse(SettingsValidation.isPinFormat(""))
    }

    @Test
    fun aMaskedSecretIsRecognised() {
        assertTrue(SettingsValidation.isMasked("••••abcd")); assertFalse(SettingsValidation.isMasked("sk-real")); assertFalse(SettingsValidation.isMasked(""))
    }
}
