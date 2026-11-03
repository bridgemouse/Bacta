package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.LoginRequest
import io.github.bridgemouse.bacta.data.network.SessionEvents
import io.github.bridgemouse.bacta.data.network.SessionStore
import javax.inject.Inject
import kotlinx.coroutines.flow.Flow

interface AuthRepository {
    /** Emits when the server rejected the stored session on a data request. */
    val sessionExpired: Flow<Unit>
    suspend fun status(): Result<AuthStatus>
    suspend fun login(pin: String): LoginResult
    suspend fun logout()
}

class DefaultAuthRepository @Inject constructor(
    private val api: BactaApi,
    private val store: SessionStore,
    events: SessionEvents,
) : AuthRepository {
    override val sessionExpired: Flow<Unit> = events.expired

    override suspend fun status(): Result<AuthStatus> =
        resultOf { api.authStatus().let { AuthStatus(it.configured, it.authed) } }

    override suspend fun login(pin: String): LoginResult =
        resultOf { api.login(LoginRequest(pin)) }.fold(
            onSuccess = { response ->
                when {
                    response.isSuccessful && response.body()?.ok == true -> LoginResult.Success
                    response.code() == 401 -> LoginResult.WrongPin
                    else -> LoginResult.Failure
                }
            },
            onFailure = { LoginResult.Failure },
        )

    override suspend fun logout() {
        resultOf { api.logout() }
        store.clear()
    }
}
