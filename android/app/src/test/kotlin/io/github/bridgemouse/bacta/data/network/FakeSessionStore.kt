package io.github.bridgemouse.bacta.data.network

import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow

class FakeSessionStore(initial: String? = null) : SessionStore {
    private val state = MutableStateFlow(initial)
    override val cookie: Flow<String?> = state
    override suspend fun save(cookie: String) { state.value = cookie }
    override suspend fun clear() { state.value = null }
}
