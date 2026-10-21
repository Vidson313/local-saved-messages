package com.localsavedmessages.app.core

/**
 * Every fallible operation in the app returns one of these.
 *
 * There is no `Offline` or `Http` variant: the app has no network layer, so
 * those failure modes cannot occur. What remains are the failures that are
 * specific to storing things on a device, and each maps to a distinct,
 * actionable message.
 */
sealed interface AppResult<out T> {
    data class Success<T>(val value: T) : AppResult<T>
    data class Failure(val reason: Reason) : AppResult<Nothing>
}

sealed interface Reason {
    /** The device is out of space, or below the safety threshold. */
    data object StorageFull : Reason

    /** The shared file was deleted, moved, or its grant was revoked. */
    data object SourceUnavailable : Reason

    /** The file exceeds the per-file or total-archive size ceiling. */
    data class FileTooLarge(val limitBytes: Long) : Reason

    /** The user denied a runtime permission the action needs. */
    data object PermissionDenied : Reason

    /** The input failed a domain rule, e.g. an empty folder name. */
    data class InvalidData(val detail: String) : Reason

    data class Unknown(val cause: Throwable) : Reason
}

inline fun <T, R> AppResult<T>.map(transform: (T) -> R): AppResult<R> = when (this) {
    is AppResult.Success -> AppResult.Success(transform(value))
    is AppResult.Failure -> this
}

inline fun <T> AppResult<T>.onSuccess(action: (T) -> Unit): AppResult<T> = apply {
    if (this is AppResult.Success) action(value)
}

inline fun <T> AppResult<T>.onFailure(action: (Reason) -> Unit): AppResult<T> = apply {
    if (this is AppResult.Failure) action(reason)
}

fun <T> AppResult<T>.getOrNull(): T? = (this as? AppResult.Success)?.value
