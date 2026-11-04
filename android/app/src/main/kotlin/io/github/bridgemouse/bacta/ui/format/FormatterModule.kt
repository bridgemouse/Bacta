package io.github.bridgemouse.bacta.ui.format

import android.content.Context
import android.icu.util.LocaleData
import android.icu.util.ULocale
import android.text.format.DateFormat
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import java.util.Locale

/** Asks ICU which measurement system the locale uses (US and UK use imperial distances). Verified on the device, not in JVM tests. */
object IcuMeasurementSystemProvider : MeasurementSystemProvider {
    override fun systemFor(locale: Locale): MeasurementSystem =
        when (LocaleData.getMeasurementSystem(ULocale.forLocale(locale))) {
            LocaleData.MeasurementSystem.US, LocaleData.MeasurementSystem.UK -> MeasurementSystem.Imperial
            else -> MeasurementSystem.Metric
        }
}

@Module
@InstallIn(SingletonComponent::class)
object FormatterModule {
    /** Not a singleton: each screen reads the locale and clock setting current when it is created. */
    @Provides
    fun formatters(@ApplicationContext context: Context): Formatters =
        LocaleFormatters(Locale.getDefault(), DateFormat.is24HourFormat(context), IcuMeasurementSystemProvider)
}
