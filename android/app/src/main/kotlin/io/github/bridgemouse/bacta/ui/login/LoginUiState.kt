package io.github.bridgemouse.bacta.ui.login

enum class LoginError { WrongPin, Connection }

data class LoginUiState(
    val pin: String = "",
    val busy: Boolean = false,
    val error: LoginError? = null,
    val done: Boolean = false,
) {
    val canSubmit: Boolean get() = !busy && pin.length >= MIN_PIN_LENGTH

    companion object {
        const val MIN_PIN_LENGTH = 4
        const val MAX_PIN_LENGTH = 12
    }
}

/** The server accepts 4–12 digits; anything else typed or pasted is dropped. */
fun sanitizePin(raw: String): String = raw.filter(Char::isDigit).take(LoginUiState.MAX_PIN_LENGTH)
