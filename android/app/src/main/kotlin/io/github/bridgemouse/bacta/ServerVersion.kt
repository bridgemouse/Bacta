package io.github.bridgemouse.bacta

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject

data class ServerVersion(val server: String, val minApp: String)

suspend fun fetchServerVersion(baseUrl: String): Result<ServerVersion> = withContext(Dispatchers.IO) {
    runCatching {
        val conn = URL("$baseUrl/api/version").openConnection() as HttpURLConnection
        try {
            conn.connectTimeout = 5000
            conn.readTimeout = 5000
            val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
            ServerVersion(json.getString("server"), json.getString("minApp"))
        } finally {
            conn.disconnect()
        }
    }
}
