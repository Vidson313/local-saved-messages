package com.localsavedmessages.app.core

import java.time.Instant

/** Injectable time source, so tests can produce deterministic timestamps. */
fun interface Clock {
    fun now(): Instant

    fun nowMillis(): Long = now().toEpochMilli()
}

object SystemClock : Clock {
    override fun now(): Instant = Instant.now()
}
