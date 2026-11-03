package io.github.bridgemouse.bacta.data.repository

import kotlin.coroutines.cancellation.CancellationException

/** runCatching that lets cancellation through, so a cancelled screen does not turn into a "failed" result. */
internal suspend inline fun <T> resultOf(block: () -> T): Result<T> =
    try {
        Result.success(block())
    } catch (e: CancellationException) {
        throw e
    } catch (e: Exception) {
        Result.failure(e)
    }
