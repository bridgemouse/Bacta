package io.github.bridgemouse.bacta.data

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import java.time.Clock

@Module
@InstallIn(SingletonComponent::class)
object ClockModule {
    @Provides
    fun clock(): Clock = Clock.systemDefaultZone()
}
