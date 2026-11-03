package io.github.bridgemouse.bacta.data.network

import android.content.Context
import androidx.datastore.core.DataStore
import androidx.datastore.preferences.core.Preferences
import androidx.datastore.preferences.preferencesDataStore
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.concurrent.TimeUnit
import javax.inject.Singleton
import okhttp3.CookieJar
import okhttp3.HttpUrl.Companion.toHttpUrl
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

private val Context.sessionDataStore: DataStore<Preferences> by preferencesDataStore(name = "session")

private const val PLACEHOLDER_BASE = "http://bacta.invalid/"

/** No logging interceptor on purpose: responses carry health data and the session cookie. */
fun createHttpClient(config: ServerConfig, cookieJar: CookieJar, events: SessionEvents): OkHttpClient =
    OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .addInterceptor(BaseUrlInterceptor(config))
        .addInterceptor(UnauthorizedInterceptor(events))
        .connectTimeout(5, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

fun createBactaApi(client: OkHttpClient): BactaApi =
    Retrofit.Builder()
        .baseUrl(PLACEHOLDER_BASE.toHttpUrl())
        .client(client)
        .addConverterFactory(BactaJson.asConverterFactory("application/json".toMediaType()))
        .build()
        .create(BactaApi::class.java)

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {
    @Provides @Singleton
    fun serverConfig(): ServerConfig = ServerConfig(ServerConfig.DEFAULT_CANDIDATES)

    @Provides @Singleton
    fun sessionEvents(): SessionEvents = SessionEvents()

    @Provides @Singleton
    fun sessionStore(@ApplicationContext context: Context): SessionStore =
        KeystoreSessionStore(context.sessionDataStore)

    @Provides @Singleton
    fun cookieJar(store: SessionStore): CookieJar = SessionCookieJar(store)

    @Provides @Singleton
    fun httpClient(config: ServerConfig, cookieJar: CookieJar, events: SessionEvents): OkHttpClient =
        createHttpClient(config, cookieJar, events)

    @Provides @Singleton
    fun bactaApi(client: OkHttpClient): BactaApi = createBactaApi(client)
}
