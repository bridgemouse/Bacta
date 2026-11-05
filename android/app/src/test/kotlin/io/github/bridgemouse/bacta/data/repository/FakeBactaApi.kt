package io.github.bridgemouse.bacta.data.repository

import io.github.bridgemouse.bacta.data.network.ActivitiesDto
import io.github.bridgemouse.bacta.data.network.AuthStatusDto
import io.github.bridgemouse.bacta.data.network.HypnoDto
import io.github.bridgemouse.bacta.data.network.IntensityDto
import io.github.bridgemouse.bacta.data.network.WeeksDto
import io.github.bridgemouse.bacta.data.network.BactaApi
import io.github.bridgemouse.bacta.data.network.BriefingDto
import io.github.bridgemouse.bacta.data.network.LoginRequest
import io.github.bridgemouse.bacta.data.network.OkDto
import io.github.bridgemouse.bacta.data.network.SummaryDto
import io.github.bridgemouse.bacta.data.network.TrendDto
import io.github.bridgemouse.bacta.data.network.VersionDto
import retrofit2.Response

open class FakeBactaApi : BactaApi {
    var versionHandler: suspend () -> VersionDto = { error("version not stubbed") }
    var statusHandler: suspend () -> AuthStatusDto = { error("status not stubbed") }
    var loginHandler: suspend (LoginRequest) -> Response<OkDto> = { error("login not stubbed") }
    var logoutHandler: suspend () -> OkDto = { OkDto(true) }
    var summaryHandler: suspend () -> SummaryDto = { error("summary not stubbed") }
    var trendHandler: suspend (String, String, String) -> TrendDto = { _, _, _ -> error("trend not stubbed") }
    var briefingHandler: suspend (String) -> BriefingDto = { error("briefing not stubbed") }

    var hypnoHandler: suspend () -> HypnoDto = { error("hypno not stubbed") }
    var activitiesHandler: suspend (Int) -> ActivitiesDto = { error("activities not stubbed") }
    var weeklyVolumeHandler: suspend (Int) -> WeeksDto = { error("weekly volume not stubbed") }
    var weeklyAvgHrHandler: suspend (Int) -> WeeksDto = { error("weekly avg hr not stubbed") }
    var weeklyIntensityHandler: suspend () -> IntensityDto = { error("weekly intensity not stubbed") }

    override suspend fun sleepHypno() = hypnoHandler()
    override suspend fun activities(days: Int) = activitiesHandler(days)
    override suspend fun weeklyVolume(weeks: Int) = weeklyVolumeHandler(weeks)
    override suspend fun weeklyAvgHr(weeks: Int) = weeklyAvgHrHandler(weeks)
    override suspend fun weeklyIntensity() = weeklyIntensityHandler()
    override suspend fun version() = versionHandler()
    override suspend fun authStatus() = statusHandler()
    override suspend fun login(request: LoginRequest) = loginHandler(request)
    override suspend fun logout() = logoutHandler()
    override suspend fun summary() = summaryHandler()
    override suspend fun trend(metric: String, from: String, to: String) = trendHandler(metric, from, to)
    override suspend fun briefing(section: String) = briefingHandler(section)
}
