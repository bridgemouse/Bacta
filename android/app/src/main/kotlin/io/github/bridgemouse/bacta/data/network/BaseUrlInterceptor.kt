package io.github.bridgemouse.bacta.data.network

import okhttp3.Interceptor
import okhttp3.Response

/** Retrofit needs a fixed base URL; the real server is picked per request so the app can fall back between candidates. */
class BaseUrlInterceptor(private val config: ServerConfig) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val target = config.current
        val url = chain.request().url.newBuilder()
            .scheme(target.scheme)
            .host(target.host)
            .port(target.port)
            .build()
        return chain.proceed(chain.request().newBuilder().url(url).build())
    }
}
