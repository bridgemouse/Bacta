package io.github.bridgemouse.bacta.data.network

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface BactaApi {
    @GET("api/version")
    suspend fun version(): VersionDto

    @GET("api/auth/status")
    suspend fun authStatus(): AuthStatusDto

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): Response<OkDto>

    @POST("api/auth/logout")
    suspend fun logout(): OkDto

    @GET("api/garmin/summary")
    suspend fun summary(): SummaryDto

    @GET("api/garmin/{metric}")
    suspend fun trend(
        @Path("metric") metric: String,
        @Query("from") from: String,
        @Query("to") to: String,
    ): TrendDto

    @GET("api/insights/{section}")
    suspend fun briefing(@Path("section") section: String): BriefingDto
}
