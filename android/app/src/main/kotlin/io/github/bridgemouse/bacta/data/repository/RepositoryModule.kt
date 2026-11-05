package io.github.bridgemouse.bacta.data.repository

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
abstract class RepositoryModule {
    @Binds @Singleton abstract fun auth(impl: DefaultAuthRepository): AuthRepository
    @Binds @Singleton abstract fun metrics(impl: DefaultMetricsRepository): MetricsRepository
    @Binds @Singleton abstract fun briefing(impl: DefaultBriefingRepository): BriefingRepository
    @Binds @Singleton abstract fun activity(impl: DefaultActivityRepository): ActivityRepository
    @Binds @Singleton abstract fun server(impl: DefaultServerRepository): ServerRepository
}
