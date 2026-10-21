package com.localsavedmessages.app.core

import java.util.UUID

/**
 * Client-generated identifiers.
 *
 * The web app assigns ids on the server; this app generates them locally and
 * never changes them. That keeps the rows stable and means a future sync
 * layer can carry the id across without re-keying existing data.
 */
object Ids {
    fun newId(): String = UUID.randomUUID().toString()

    /** A provisional id for an entry that has not been committed yet. */
    fun provisionalId(): String = "local-${UUID.randomUUID()}"
}
