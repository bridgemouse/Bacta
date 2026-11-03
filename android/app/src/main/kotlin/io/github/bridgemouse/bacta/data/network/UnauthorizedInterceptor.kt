package io.github.bridgemouse.bacta.data.network

import java.io.IOException
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.Interceptor
import okhttp3.Response

/** Extends IOException because an unchecked exception thrown from an interceptor crashes the process on OkHttp's dispatcher thread. */
class SessionExpiredException : IOException("Session expired")

class SessionEvents {
    private val _expired = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val expired: SharedFlow<Unit> = _expired.asSharedFlow()

    fun emitExpired() {
        _expired.tryEmit(Unit)
    }
}

class UnauthorizedInterceptor(private val events: SessionEvents) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        val isAuthEndpoint = chain.request().url.encodedPath.startsWith("/api/auth/")
        if (response.code == 401 && !isAuthEndpoint) {
            response.close()
            events.emitExpired()
            throw SessionExpiredException()
        }
        return response
    }
}
