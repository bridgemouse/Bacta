package io.github.bridgemouse.bacta.domain

/** Only codes confirmed against the phrase Garmin returns alongside them (checked against the live database); the rest show nothing rather than a guess. */
object TrainingStatus {
    private val labels = mapOf(
        3 to "Overreaching",
        4 to "Maintaining",
        5 to "Recovery",
        7 to "Productive",
        8 to "Strained",
    )

    fun label(n: Double?): String? = n?.toInt()?.let(labels::get)
}
