package io.github.bridgemouse.bacta.data.network

import kotlinx.coroutines.flow.Flow

interface SessionStore {
    val cookie: Flow<String?>
    suspend fun save(cookie: String)
    suspend fun clear()
}
